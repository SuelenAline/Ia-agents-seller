import { Store } from "../apps/api/src/store";
import { PlatformService } from "../apps/api/src/platform";
import { AiService } from "../apps/api/src/ai";
import { demoProducts } from "../packages/domain/src";
import { randomUUID } from "node:crypto";
const suite = process.env.RUN_DB_TESTS === "true" ? describe : describe.skip;
suite("PostgreSQL real: persistência, claim e transações", () => {
  let store: Store, platform: PlatformService, product: any;
  const prefix = `integration-${randomUUID()}`;
  beforeAll(async () => {
    process.env.MOCK_MODE = "false";
    store = new Store();
    platform = new PlatformService(store, new AiService());
    product = await platform.createProduct(
      { ...demoProducts[0], sku: prefix },
      prefix,
    );
  });
  afterAll(async () => {
    if (store?.db && product) {
      const jobs = await store.db.agentRun.findMany({
        where: { productId: product.id },
      });
      const imports = await store.db.auditLog.findMany({
        where: { actor: prefix, action: "HISTORICAL_IMPORT" },
      });
      await store.db.importBatch.deleteMany({
        where: { digest: { in: imports.map((x) => x.entityId) } },
      });
      await store.db.approval.deleteMany({ where: { productId: product.id } });
      await store.db.agentRun.deleteMany({ where: { productId: product.id } });
      await store.db.performance.deleteMany({
        where: { productId: product.id },
      });
      await store.db.variation.deleteMany({ where: { productId: product.id } });
      await store.db.product.delete({ where: { id: product.id } });
      // Remove only audit records created by this suite, preserving seeded/operator data.
      await store.db.auditLog.deleteMany({
        where: {
          OR: [{ actor: prefix }, { entityId: { in: jobs.map((j) => j.id) } }],
        },
      });
    }
    await store?.onModuleDestroy();
    process.env.MOCK_MODE = "true";
  });
  test("salva variações e Decimal", async () => {
    const p = await store.find("product", product.id);
    expect(p.variations).toHaveLength(2);
    expect(Number(p.cost)).toBe(24);
  });
  test("enfileiramentos concorrentes compartilham uma execução; claim produz uma aprovação", async () => {
    const input = {
      agent: "seo",
      productId: product.id,
      channel: "MERCADO_LIVRE",
      idempotencyKey: prefix,
    };
    const [a, b] = await Promise.all([
      platform.enqueue(input, prefix),
      platform.enqueue(input, prefix),
    ]);
    expect(a.id).toBe(b.id);
    await Promise.all([
      platform.tick(),
      new PlatformService(store, new AiService()).tick(),
    ]);
    const p = await store.db!.approval.findMany({
      where: { productId: product.id },
    });
    expect(p).toHaveLength(1);
    expect((await store.find("agentRun", a.id)).status).toBe("SUCCEEDED");
  });
  test("apenas uma decisão concorrente é aceita", async () => {
    const a = await store.db!.approval.findFirstOrThrow({
      where: { productId: product.id },
    });
    const results = await Promise.allSettled([
      platform.review(a.id, "APPROVED", prefix),
      platform.review(a.id, "REJECTED", prefix),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
  });
  test("importação persiste atomicamente e não duplica", async () => {
    const input = {
      csv: `sku,date,channel,orders,visits,revenue,adSpend,cost\n${prefix},2024-10-01,SHOPEE,2,,100,2,40`,
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
    };
    const first = await platform.importHistorical(input, prefix);
    expect(first.imported).toBe(1);
    expect((await platform.importHistorical(input, prefix)).imported).toBe(0);
    expect(
      await store.db!.performance.count({ where: { productId: product.id } }),
    ).toBe(1);
  });
});
