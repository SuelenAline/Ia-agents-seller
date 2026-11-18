import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { demoProducts } from "../packages/domain/src";
const db = new PrismaClient();
async function main() {
  const supplier = await db.supplier.upsert({
    where: { id: "demo-supplier" },
    create: { id: "demo-supplier", name: "Confecção fictícia Pequeno Sol" },
    update: {},
  });
  for (const p of demoProducts) {
    const { variations, ...data } = p;
    await db.product.upsert({
      where: { sku: p.sku },
      create: {
        ...data,
        supplierId: supplier.id,
        variations: { create: variations },
      },
      update: {},
    });
  }
  await db.setting.upsert({
    where: { key: "killSwitch" },
    create: { key: "killSwitch", value: false },
    update: {},
  });
}
main().finally(() => db.$disconnect());
