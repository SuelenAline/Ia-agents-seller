import {
  Inject,
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from "@nestjs/common";
import { Store, mockMode } from "./store";
import { AiService } from "./ai";
import {
  channelSchema,
  competitorSchema,
  equivalent,
  historicalRowSchema,
  price,
  productSchema,
  seo,
} from "@seller/domain";
import { parse } from "csv-parse/sync";
import { createHash } from "node:crypto";
import { z } from "zod";
import { trace, SpanStatusCode } from "@opentelemetry/api";

export const runSchema = z.object({
  agent: z.enum(["competition", "seo", "pricing", "growth"]),
  productId: z.string(),
  channel: channelSchema,
  idempotencyKey: z.string().min(8).max(120),
});
export const importSchema = z.object({
  csv: z.string().min(1).max(1000000),
  mapping: z.record(z.string(), z.string()),
  delimiter: z.enum([",", ";"]).default(","),
  dryRun: z.boolean().default(true),
});
@Injectable()
export class PlatformService implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;
  private busy = false;
  private logger = new Logger("AgentWorker");
  constructor(
    @Inject(Store) public store: Store,
    @Inject(AiService) private ai: AiService,
  ) {}
  onModuleInit() {
    this.timer = setInterval(
      () =>
        void this.tick().catch(() =>
          this.logger.error("Worker indisponível; consulte infraestrutura"),
        ),
      500,
    );
  }
  onModuleDestroy() {
    clearInterval(this.timer);
  }
  async dashboard() {
    const [products, performance, approvals, runs] = await Promise.all([
      this.store.all("product"),
      this.store.all("performance"),
      this.store.all("approval"),
      this.store.all("agentRun"),
    ]);
    const current = performance.filter((x) => !x.historical);
    const historical = performance.filter((x) => x.historical);
    const aggregate = (rows: any[]) => ({
      orders: rows.reduce((s, r) => s + r.orders, 0),
      revenue: rows.reduce((s, r) => s + Number(r.revenue), 0),
      adSpend: rows.reduce((s, r) => s + Number(r.adSpend), 0),
      records: rows.length,
    });
    return {
      mode: mockMode() ? "MOCK" : "REAL",
      products: products.length,
      stock: products.reduce(
        (s, p) =>
          s + p.variations.reduce((a: number, v: any) => a + v.stock, 0),
        0,
      ),
      pending: approvals.filter((x) => x.status === "PENDING").length,
      current: aggregate(current),
      historical: aggregate(historical),
      runs: runs.length,
      killSwitch: await this.store.killSwitch(),
    };
  }
  async createProduct(input: unknown, actor: string) {
    const p = productSchema.parse(input);
    if ((await this.store.all("product")).some((x) => x.sku === p.sku))
      throw new ConflictException("SKU já existe");
    const result = await this.store.create("product", p);
    await this.store.audit(actor, "PRODUCT_CREATE", result.id, { sku: p.sku });
    return result;
  }
  async enqueue(input: unknown, actor: string) {
    const data = runSchema.parse(input);
    if (await this.store.killSwitch())
      throw new ConflictException("Agentes pausados pelo kill switch");
    const previous = (await this.store.all("agentRun")).find(
      (r) => r.idempotencyKey === data.idempotencyKey,
    );
    if (previous) {
      if (
        previous.agent !== data.agent ||
        previous.productId !== data.productId ||
        previous.channel !== data.channel
      )
        throw new ConflictException(
          "Chave de idempotência reutilizada com outro conteúdo",
        );
      return previous;
    }
    if (!(await this.store.find("product", data.productId)))
      throw new NotFoundException("Produto ausente");
    let run;
    try {
      run = await this.store.create("agentRun", {
        ...data,
        status: "QUEUED",
        attempts: 0,
      });
    } catch (e) {
      if ((e as { code?: string }).code !== "P2002") throw e;
      const concurrent = (await this.store.all("agentRun")).find(
        (r) => r.idempotencyKey === data.idempotencyKey,
      );
      if (
        concurrent &&
        concurrent.agent === data.agent &&
        concurrent.productId === data.productId &&
        concurrent.channel === data.channel
      )
        return concurrent;
      throw new ConflictException(
        "Chave de idempotência reutilizada com outro conteúdo",
      );
    }
    await this.store.audit(actor, "AGENT_ENQUEUE", run.id, {
      agent: data.agent,
    });
    return run;
  }
  async tick() {
    if (this.busy) return;
    this.busy = true;
    try {
      if (await this.store.killSwitch()) return;
      const run = (await this.store.all("agentRun"))
        .filter((r) => r.status === "QUEUED")
        .sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        )[0];
      if (!run) return;
      if (this.store.db) {
        const claim = await this.store.db.agentRun.updateMany({
          where: { id: run.id, status: "QUEUED" },
          data: { status: "RUNNING", attempts: { increment: 1 } },
        });
        if (!claim.count) return;
      } else
        await this.store.update("agentRun", run.id, {
          status: "RUNNING",
          attempts: run.attempts + 1,
        });
      await trace
        .getTracer("seller-agents")
        .startActiveSpan(`agent.${run.agent}`, async (span) => {
          try {
            const result = await this.execute(run);
            if (await this.store.killSwitch())
              throw new Error("Kill switch acionado durante execução");
            const commit = async (db: any) => {
              await db.approval.create({
                data: {
                  id: `approval-${run.id}`,
                  kind: run.agent,
                  productId: run.productId,
                  payload: JSON.parse(JSON.stringify(result)),
                  status: "PENDING",
                  requestedBy: "agent",
                },
              });
              await db.agentRun.update({
                where: { id: run.id },
                data: {
                  status: "SUCCEEDED",
                  result: JSON.parse(JSON.stringify(result)),
                },
              });
              await db.auditLog.create({
                data: {
                  actor: "worker",
                  action: "AGENT_SUCCEEDED",
                  entityId: run.id,
                  data: { agent: run.agent },
                },
              });
            };
            if (this.store.db) await this.store.db.$transaction(commit);
            else {
              await this.store.create("approval", {
                id: `approval-${run.id}`,
                kind: run.agent,
                productId: run.productId,
                payload: result,
                status: "PENDING",
                requestedBy: "agent",
              });
              await this.store.update("agentRun", run.id, {
                status: "SUCCEEDED",
                result,
              });
              await this.store.audit("worker", "AGENT_SUCCEEDED", run.id, {
                agent: run.agent,
              });
            }
          } catch (e) {
            const message =
              e instanceof Error ? e.message : "Falha desconhecida";
            span.setStatus({ code: SpanStatusCode.ERROR });
            await this.store.update("agentRun", run.id, {
              status: "FAILED",
              result: { error: message },
            });
            await this.store.audit("worker", "AGENT_FAILED", run.id, {
              error: message,
            });
          } finally {
            span.end();
          }
        });
    } finally {
      this.busy = false;
    }
  }
  private async execute(run: any) {
    const raw = await this.store.find("product", run.productId);
    if (!raw) throw new Error("Produto removido");
    const p = productSchema.parse({
      ...raw,
      cost: Number(raw.cost),
      minimumPrice: Number(raw.minimumPrice),
    });
    if (run.agent === "seo") {
      const draft = seo(p, channelSchema.parse(run.channel));
      return {
        draft,
        versionId: run.id,
        notes:
          "Proposta conservadora baseada exclusivamente na ficha. Publicação requer validação atual do canal.",
      };
    }
    if (run.agent === "pricing")
      return {
        ...price({
          cost: p.cost,
          packaging: 2,
          shipping: 7,
          fixedFee: 0,
          feeRate: 0.16,
          taxRate: 0.06,
          adRate: 0.05,
          marginRate: 0.2,
          minimumPrice: p.minimumPrice,
        }),
        assumptions:
          "Taxas ilustrativas; configure custos reais no simulador. Não representa tabela oficial de marketplace.",
      };
    if (run.agent === "competition") {
      const snapshots = (await this.store.all("competitorSnapshot"))
        .filter((c) => c.channel === run.channel)
        .filter((c) =>
          equivalent(p, {
            ...c.data,
            externalId: c.externalId,
            channel: c.channel,
            source: c.source,
            capturedAt: new Date(c.capturedAt).toISOString(),
          }),
        );
      return {
        equivalents: snapshots.map((c) => ({
          id: c.id,
          total: Number(c.data.price) + Number(c.data.shipping),
          source: c.source,
          capturedAt: c.capturedAt,
          sales: c.data.sales ?? null,
        })),
        analysis: await this.ai.analyze(
          "concorrência",
          snapshots.map((c) => ({ id: c.id, data: c })),
        ),
      };
    }
    const rows = (await this.store.all("performance")).filter(
      (r) =>
        r.productId === run.productId &&
        r.channel === run.channel &&
        !r.historical,
    );
    const observed = rows.map((r) => ({
      ...r,
      conversion: r.visits > 0 ? r.orders / r.visits : null,
      contribution: Number(r.revenue) - Number(r.cost) - Number(r.adSpend),
    }));
    return {
      observations: observed,
      analysis: await this.ai.analyze(
        "crescimento",
        observed.map((r) => ({ id: r.id, data: r })),
      ),
      limitations: [
        "Contribuição parcial: custos importados devem incluir taxas, impostos e logística.",
        "Histórico 2020–2024 não é indicador atual.",
        "Orçamento publicitário não será alterado.",
      ],
    };
  }
  async review(id: string, decision: "APPROVED" | "REJECTED", actor: string) {
    const approval = await this.store.find("approval", id);
    if (!approval) throw new NotFoundException();
    if (approval.status !== "PENDING")
      throw new ConflictException("Proposta já revisada");
    const data = {
      status: decision,
      reviewedBy: actor,
      reviewedAt: new Date(),
    };
    if (this.store.db) {
      return this.store.db.$transaction(async (tx) => {
        const changed = await tx.approval.updateMany({
          where: { id, status: "PENDING" },
          data,
        });
        if (changed.count !== 1)
          throw new ConflictException("Proposta já revisada");
        await tx.auditLog.create({
          data: {
            actor,
            action: `APPROVAL_${decision}`,
            entityId: id,
            data: {},
          },
        });
        return tx.approval.findUnique({ where: { id } });
      });
    }
    const result = await this.store.update("approval", id, data);
    await this.store.audit(actor, `APPROVAL_${decision}`, id);
    return result;
  }
  async importHistorical(input: unknown, actor: string) {
    const config = importSchema.parse(input);
    let records: Record<string, string>[];
    try {
      records = parse(config.csv, {
        columns: true,
        skip_empty_lines: true,
        bom: true,
        delimiter: config.delimiter,
        trim: true,
        max_record_size: 10000,
      });
    } catch {
      throw new BadRequestException("CSV inválido");
    }
    if (!records.length || records.length > 10000)
      throw new BadRequestException("Importe entre 1 e 10.000 linhas");
    const keys = [
      "sku",
      "date",
      "channel",
      "orders",
      "visits",
      "revenue",
      "adSpend",
      "cost",
    ];
    for (const k of keys)
      if (!config.mapping[k] || !Object.hasOwn(records[0], config.mapping[k]))
        throw new BadRequestException(`Mapeamento ausente: ${k}`);
    const products = await this.store.all("product");
    const errors: any[] = [];
    const valid: any[] = [];
    const unique = new Set<string>();
    records.forEach((r, i) => {
      const value: any = {};
      for (const k of keys) {
        const raw = r[config.mapping[k]];
        value[k] = ["orders", "visits", "revenue", "adSpend", "cost"].includes(
          k,
        )
          ? k === "visits" && raw === ""
            ? null
            : raw === ""
              ? NaN
              : Number(raw)
          : raw;
      }
      const parsed = historicalRowSchema.safeParse(value);
      if (!parsed.success) {
        errors.push({
          line: i + 2,
          issues: parsed.error.issues.map(
            (x) => `${x.path.join(".")}: ${x.message}`,
          ),
        });
        return;
      }
      const product = products.find((p) => p.sku === value.sku);
      if (!product) {
        errors.push({ line: i + 2, issues: ["SKU desconhecido"] });
        return;
      }
      const key = `${product.id}|${value.date}|${value.channel}`;
      if (unique.has(key)) {
        errors.push({ line: i + 2, issues: ["Chave duplicada no arquivo"] });
        return;
      }
      unique.add(key);
      const { sku, ...data } = parsed.data;
      valid.push({ ...data, productId: product.id, historical: true });
    });
    if (errors.length || config.dryRun)
      return {
        dryRun: config.dryRun,
        validRows: valid.length,
        errors,
        imported: 0,
      };
    const digest = createHash("sha256")
      .update(JSON.stringify(valid))
      .digest("hex");
    if ((await this.store.all("importBatch")).some((b) => b.digest === digest))
      return { duplicate: true, imported: 0, errors: [] };
    const existing = await this.store.all("performance");
    if (
      valid.some((v) =>
        existing.some(
          (e) =>
            e.productId === v.productId &&
            new Date(e.date).toISOString().slice(0, 10) === v.date &&
            e.channel === v.channel &&
            e.historical,
        ),
      )
    )
      throw new ConflictException(
        "Já existe performance para uma das datas; importação cancelada integralmente",
      );
    if (this.store.db)
      await this.store.db.$transaction(async (tx) => {
        await tx.importBatch.create({ data: { digest, rows: valid.length } });
        await tx.performance.createMany({
          data: valid.map((v) => ({ ...v, date: new Date(v.date) })),
        });
        await tx.auditLog.create({
          data: {
            actor,
            action: "HISTORICAL_IMPORT",
            entityId: digest,
            data: { rows: valid.length },
          },
        });
      });
    else {
      for (const v of valid) await this.store.create("performance", v);
      await this.store.create("importBatch", { digest, rows: valid.length });
      await this.store.audit(actor, "HISTORICAL_IMPORT", digest, {
        rows: valid.length,
      });
    }
    return { imported: valid.length, errors: [] };
  }
  async importCompetitors(input: unknown, actor: string) {
    const rows = z.array(competitorSchema).min(1).max(500).parse(input);
    const result = [];
    for (const row of rows) {
      const { externalId, channel, source, capturedAt, ...data } = row;
      result.push(
        await this.store.create("competitorSnapshot", {
          externalId,
          channel,
          source,
          capturedAt: new Date(capturedAt),
          data,
        }),
      );
    }
    await this.store.audit(actor, "COMPETITOR_IMPORT", "batch", {
      count: rows.length,
    });
    return result;
  }
  async history() {
    const rows = await this.store.all("performance");
    const historical = rows.filter((r) => r.historical);
    const months = Array.from({ length: 12 }, (_, i) => ({
      month: i + 1,
      orders: historical
        .filter((r) => new Date(r.date).getUTCMonth() === i)
        .reduce((s, r) => s + r.orders, 0),
    }));
    return {
      historical,
      current: rows.filter((r) => !r.historical),
      seasonality: months,
    };
  }
}
