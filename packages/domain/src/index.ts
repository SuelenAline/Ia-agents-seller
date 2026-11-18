import { z } from "zod";

export const channelSchema = z.enum(["MERCADO_LIVRE", "SHOPEE"]);
export const productSchema = z.object({
  sku: z.string().trim().min(1).max(80),
  name: z.string().trim().min(3).max(160),
  category: z.string().min(1),
  brand: z.string().min(1),
  fabric: z.string().min(1),
  pieces: z.number().int().positive().max(100),
  cost: z.number().nonnegative().max(100000),
  minimumPrice: z.number().positive().max(100000),
  validated: z.boolean(),
  variations: z
    .array(
      z.object({
        size: z.string().min(1),
        color: z.string().min(1),
        stock: z.number().int().nonnegative(),
      }),
    )
    .min(1),
});
export type ProductInput = z.infer<typeof productSchema>;
export const pricingSchema = z.object({
  cost: z.number().finite().nonnegative(),
  packaging: z.number().finite().nonnegative(),
  shipping: z.number().finite().nonnegative(),
  fixedFee: z.number().finite().nonnegative(),
  feeRate: z.number().min(0).lt(1),
  taxRate: z.number().min(0).lt(1),
  adRate: z.number().min(0).lt(1),
  marginRate: z.number().min(0).lt(1),
  minimumPrice: z.number().positive(),
});
export function price(input: unknown) {
  const p = pricingSchema.parse(input);
  const denominator = 1 - p.feeRate - p.taxRate - p.adRate - p.marginRate;
  if (denominator <= 0)
    throw new Error("Taxas e margem devem somar menos de 100%.");
  const fixed = p.cost + p.packaging + p.shipping + p.fixedFee;
  const calculated =
    Math.ceil((fixed / denominator - Number.EPSILON) * 100) / 100;
  const recommended = Math.max(calculated, p.minimumPrice);
  if (!Number.isFinite(recommended) || recommended > 1e9)
    throw new Error("Preço fora do limite operacional. Revise custos e taxas.");
  const contribution =
    recommended * (1 - p.feeRate - p.taxRate - p.adRate) - fixed;
  return {
    calculated,
    recommended,
    contribution: Math.round(contribution * 100) / 100,
    marginRate: contribution / recommended,
    minimumApplied: calculated < p.minimumPrice,
    formula:
      "(custo + embalagem + frete + tarifa fixa) / (1 - taxas - impostos - publicidade - margem)",
  };
}
export const competitorSchema = z.object({
  externalId: z.string().min(1),
  channel: channelSchema,
  name: z.string().min(1),
  category: z.string(),
  brand: z.string(),
  fabric: z.string(),
  size: z.string(),
  pieces: z.number().int().positive(),
  price: z.number().positive(),
  shipping: z.number().nonnegative(),
  source: z.string().min(3),
  capturedAt: z.string().datetime(),
  sales: z.number().int().nonnegative().nullable().default(null),
});
export function equivalent(
  p: ProductInput,
  c: z.infer<typeof competitorSchema>,
) {
  const normalize = (s: string) => s.trim().toLocaleLowerCase("pt-BR");
  return (
    ["category", "brand", "fabric"].every(
      (k) => normalize(p[k as "category"]) === normalize(c[k as "category"]),
    ) &&
    p.pieces === c.pieces &&
    p.variations.some((v) => normalize(v.size) === normalize(c.size))
  );
}
export function seo(p: ProductInput, channel: z.infer<typeof channelSchema>) {
  if (!p.validated) throw new Error("Ficha técnica precisa ser validada.");
  // Conservative local drafting limits; real publication requires current category policy validation.
  const limit = channel === "MERCADO_LIVRE" ? 60 : 120;
  const title = `${p.name} ${p.brand} ${p.fabric} ${p.pieces} peça(s)`
    .slice(0, limit)
    .trim();
  return {
    title,
    description: `${p.name}. Marca: ${p.brand}. Tecido: ${p.fabric}. Quantidade: ${p.pieces} peça(s). Tamanhos: ${p.variations.map((v) => v.size).join(", ")}.`,
    attributes: { brand: p.brand, fabric: p.fabric, pieces: p.pieces },
    channel,
    policyStatus: "REQUIRES_CHANNEL_VALIDATION",
    source: `Ficha técnica ${p.sku}`,
  };
}
export const historicalRowSchema = z.object({
  sku: z.string().min(1),
  date: z
    .string()
    .regex(/^202[0-4]-\d{2}-\d{2}$/)
    .refine((s) => {
      const d = new Date(s);
      return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
    }, "Data inválida"),
  channel: channelSchema,
  orders: z.number().int().nonnegative(),
  visits: z.number().int().nonnegative().nullable(),
  revenue: z.number().nonnegative(),
  adSpend: z.number().nonnegative(),
  cost: z.number().nonnegative(),
});
export const recommendationSchema = z.object({
  summary: z.string(),
  recommendations: z.array(
    z.object({
      action: z.string(),
      evidenceIds: z.array(z.string()).min(1),
      reason: z.string(),
    }),
  ),
  limitations: z.array(z.string()),
});
export const demoProducts: ProductInput[] = [
  {
    sku: "CONJ-001",
    name: "Conjunto infantil arco-íris",
    category: "Conjuntos infantis",
    brand: "Pequeno Sol",
    fabric: "Algodão",
    pieces: 2,
    cost: 24,
    minimumPrice: 49.9,
    validated: true,
    variations: [
      { size: "2", color: "Lavanda", stock: 32 },
      { size: "4", color: "Pêssego", stock: 18 },
    ],
  },
  {
    sku: "BODY-002",
    name: "Kit body bebê essencial",
    category: "Bodies",
    brand: "Pequeno Sol",
    fabric: "Algodão",
    pieces: 3,
    cost: 31,
    minimumPrice: 64.9,
    validated: true,
    variations: [
      { size: "P", color: "Areia", stock: 45 },
      { size: "M", color: "Verde", stock: 22 },
    ],
  },
  {
    sku: "VEST-003",
    name: "Vestido infantil jardim",
    category: "Vestidos",
    brand: "Pequeno Sol",
    fabric: "Viscose",
    pieces: 1,
    cost: 29,
    minimumPrice: 59.9,
    validated: true,
    variations: [{ size: "4", color: "Floral", stock: 14 }],
  },
  {
    sku: "PIJA-004",
    name: "Pijama infantil estrelas",
    category: "Pijamas",
    brand: "Pequeno Sol",
    fabric: "Algodão",
    pieces: 2,
    cost: 27,
    minimumPrice: 54.9,
    validated: true,
    variations: [{ size: "6", color: "Azul", stock: 26 }],
  },
];
