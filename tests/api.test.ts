import "reflect-metadata";
import { createApplication } from "../apps/api/src/factory";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { AppModule } from "../apps/api/src/app";
import { Store } from "../apps/api/src/store";
import { PlatformService } from "../apps/api/src/platform";
process.env.MOCK_MODE = "true";
describe("HTTP + workflow integrado no mock", () => {
  let app: INestApplication,
    token: string,
    store: Store,
    platform: PlatformService;
  beforeAll(async () => {
    app = await createApplication({ logger: false });
    await app.init();
    store = app.get(Store);
    platform = app.get(PlatformService);
    platform.onModuleDestroy();
    const r = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email: "admin@example.local", password: "demo-seller-2026" });
    expect(r.status).toBe(201);
    token = r.body.token;
  });
  afterAll(async () => {
    await app.close();
  });
  const post = (path: string, data: object) =>
    request(app.getHttpServer())
      .post(path)
      .set("Authorization", `Bearer ${token}`)
      .send(data);
  test("nega acesso anônimo e assinatura alterada", async () => {
    expect((await request(app.getHttpServer()).get("/products")).status).toBe(
      401,
    );
    expect(
      (
        await request(app.getHttpServer())
          .get("/products")
          .set("Authorization", `Bearer ${token}x`)
      ).status,
    ).toBe(401);
  });
  test("preço inválido retorna erro de validação", async () => {
    const r = await post("/pricing/simulate", { cost: -10 });
    expect(r.status).toBe(400);
  });
  test("job é idempotente, gera proposta e não publica após aprovação", async () => {
    const input = {
      agent: "seo",
      productId: "p1",
      channel: "MERCADO_LIVRE",
      idempotencyKey: "test-idempotency-1",
    };
    const first = await post("/agents/runs", input);
    expect(first.status).toBe(201);
    const second = await post("/agents/runs", input);
    expect(second.body.id).toBe(first.body.id);
    await platform.tick();
    const proposals = await store.all("approval");
    expect(proposals).toHaveLength(1);
    expect(proposals[0].payload.draft.title).toBeTruthy();
    expect(
      (
        await post(`/approvals/${proposals[0].id}/review`, {
          decision: "APPROVED",
        })
      ).status,
    ).toBe(201);
    expect(
      (
        await post(`/approvals/${proposals[0].id}/review`, {
          decision: "REJECTED",
        })
      ).status,
    ).toBe(409);
    expect(
      (await post(`/approvals/${proposals[0].id}/execute`, {})).status,
    ).toBe(409);
  });
  test("kill switch bloqueia fila", async () => {
    await post("/agents/kill-switch", { enabled: true });
    expect(
      (
        await post("/agents/runs", {
          agent: "growth",
          productId: "p1",
          channel: "SHOPEE",
          idempotencyKey: "test-kill-switch",
        })
      ).status,
    ).toBe(409);
    await post("/agents/kill-switch", { enabled: false });
  });
  test("observações atuais ficam separadas do histórico e alimentam agentes", async () => {
    const row = {
      productId: "p1",
      date: "2025-10-15",
      channel: "MERCADO_LIVRE",
      orders: 3,
      visits: 100,
      price: 59.9,
      revenue: 179.7,
      adSpend: 10,
      cost: 80,
    };
    expect((await post("/performance/observations", row)).status).toBe(201);
    const h = await platform.history();
    expect(h.current).toHaveLength(1);
    expect(h.historical.every((r) => r.historical)).toBe(true);
    for (const agent of ["pricing", "competition", "growth"]) {
      const run = await platform.enqueue(
        {
          agent,
          productId: "p1",
          channel: "MERCADO_LIVRE",
          idempotencyKey: `test-agent-${agent}`,
        },
        "test",
      );
      await platform.tick();
      const complete = await store.find("agentRun", run.id);
      expect(complete.status).toBe("SUCCEEDED");
      if (agent === "competition")
        expect(complete.result.equivalents[0].sales).toBeNull();
      if (agent === "growth")
        expect(complete.result.observations[0].conversion).toBe(0.03);
    }
  });
  test("rejeita preço inviável e título longo pela API", async () => {
    expect(
      (
        await post("/pricing/simulate", {
          cost: 24,
          packaging: 2,
          shipping: 7,
          fixedFee: 0,
          feeRate: 0.5,
          taxRate: 0.2,
          adRate: 0.1,
          marginRate: 0.2,
          minimumPrice: 49.9,
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await post("/listings/draft", {
          productId: "p1",
          channel: "MERCADO_LIVRE",
          title: "x".repeat(61),
          description: "Ficha validada",
          price: 60,
        })
      ).status,
    ).toBe(400);
  });
  test("importação valida antes de gravar e deduplica", async () => {
    const input = {
      csv: "SKU,Data,Canal,Pedidos,Visitas,Receita,Ads,Custo\nCONJ-001,2023-08-10,SHOPEE,2,,100,3,40",
      mapping: {
        sku: "SKU",
        date: "Data",
        channel: "Canal",
        orders: "Pedidos",
        visits: "Visitas",
        revenue: "Receita",
        adSpend: "Ads",
        cost: "Custo",
      },
      dryRun: true,
    };
    const before = (await store.all("performance")).length;
    const preview = await platform.importHistorical(input, "test");
    expect(preview.validRows).toBe(1);
    expect((await store.all("performance")).length).toBe(before);
    expect(
      (await platform.importHistorical({ ...input, dryRun: false }, "test"))
        .imported,
    ).toBe(1);
    expect(
      (await platform.importHistorical({ ...input, dryRun: false }, "test"))
        .imported,
    ).toBe(0);
  });
  test("importação inválida é integralmente cancelada", async () => {
    const result = await platform.importHistorical(
      {
        csv: "sku,date,channel,orders,visits,revenue,adSpend,cost\nCONJ-001,2024-02-30,SHOPEE,1,,30,2,10",
        mapping: Object.fromEntries(
          [
            "sku",
            "date",
            "channel",
            "orders",
            "visits",
            "revenue",
            "adSpend",
            "cost",
          ].map((k) => [k, k]),
        ),
        dryRun: false,
      },
      "test",
    );
    expect(result.errors).toHaveLength(1);
    expect(result.imported).toBe(0);
  });
});
