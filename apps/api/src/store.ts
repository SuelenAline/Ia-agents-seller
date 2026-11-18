import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { demoProducts } from "@seller/domain";

export type Collection =
  | "product"
  | "supplier"
  | "listing"
  | "listingVersion"
  | "competitorSnapshot"
  | "keyword"
  | "performance"
  | "approval"
  | "agentRun"
  | "integration"
  | "auditLog"
  | "setting"
  | "importBatch";
export const mockMode = () => process.env.MOCK_MODE !== "false";
@Injectable()
export class Store implements OnModuleDestroy {
  db: PrismaClient | null = mockMode() ? null : new PrismaClient();
  memory = new Map<Collection, any[]>();
  constructor() {
    if (!mockMode()) return;
    this.memory.set(
      "product",
      demoProducts.map((p, i) => ({
        ...p,
        id: `p${i + 1}`,
        createdAt: new Date().toISOString(),
      })),
    );
    this.memory.set("setting", [{ key: "killSwitch", value: false }]);
    this.memory.set("competitorSnapshot", [
      {
        id: "c1",
        externalId: "DEMO-001",
        channel: "MERCADO_LIVRE",
        source: "Dataset fictício de demonstração",
        capturedAt: new Date().toISOString(),
        data: {
          ...demoProducts[0],
          size: "2",
          price: 62.9,
          shipping: 8,
          sales: null,
        },
      },
    ]);
    this.memory.set(
      "keyword",
      demoProducts.flatMap((p) =>
        [p.category, p.fabric].map((term) => ({
          id: randomUUID(),
          term,
          source: `Ficha técnica ${p.sku}`,
          volume: null,
          capturedAt: new Date().toISOString(),
        })),
      ),
    );
    this.memory.set(
      "performance",
      demoProducts.flatMap((p, i) =>
        Array.from({ length: 5 }, (_, year) => ({
          id: randomUUID(),
          productId: `p${i + 1}`,
          date: `${2020 + year}-11-01`,
          channel: "MERCADO_LIVRE",
          historical: true,
          orders: 18 + year * 4 + i,
          visits: null,
          revenue: 1200 + year * 150,
          adSpend: 80,
          cost: 600,
        })),
      ),
    );
  }
  async all(c: Collection): Promise<any[]> {
    if (this.db)
      return (this.db[c] as any).findMany(
        c === "product"
          ? { include: { variations: true, supplier: true } }
          : {},
      );
    return structuredClone(this.memory.get(c) || []);
  }
  async find(c: Collection, id: string) {
    return (await this.all(c)).find((x) => (x.id ?? x.key) === id);
  }
  async create(c: Collection, data: any) {
    if (this.db) {
      if (c === "product") {
        const { variations, ...rest } = data;
        return this.db.product.create({
          data: { ...rest, variations: { create: variations } },
          include: { variations: true },
        });
      }
      return (this.db[c] as any).create({ data });
    }
    const row = {
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      ...data,
    };
    this.memory.set(c, [...(this.memory.get(c) || []), row]);
    return structuredClone(row);
  }
  async update(c: Collection, id: string, data: any) {
    if (this.db)
      return (this.db[c] as any).update({
        where: c === "setting" ? { key: id } : { id },
        data,
      });
    const list = this.memory.get(c) || [];
    const row = list.find((x) => (x.id ?? x.key) === id);
    if (!row) throw new Error("Registro ausente");
    Object.assign(row, data);
    return structuredClone(row);
  }
  async audit(actor: string, action: string, entityId: string, data: any = {}) {
    return this.create("auditLog", { actor, action, entityId, data });
  }
  async killSwitch() {
    return Boolean((await this.find("setting", "killSwitch"))?.value);
  }
  async onModuleDestroy() {
    await this.db?.$disconnect();
  }
}
