import { z } from "zod";
import { productSchema, pricingSchema, competitorSchema } from "@seller/domain";
import { runSchema, importSchema } from "./platform";
import { ApiBody } from "@nestjs/swagger";
const bodies: Record<string, z.ZodType> = {
  product: productSchema,
  pricing: pricingSchema,
  competitors: z.array(competitorSchema).min(1).max(500),
  run: runSchema,
  history: importSchema,
  observation: z.object({
    productId: z.string(),
    date: z.string().date(),
    channel: z.enum(["MERCADO_LIVRE", "SHOPEE"]),
    orders: z.number().int().nonnegative(),
    visits: z.number().int().nonnegative().nullable(),
    price: z.number().positive().nullable(),
    revenue: z.number().nonnegative(),
    adSpend: z.number().nonnegative(),
    cost: z.number().nonnegative(),
  }),
  review: z.object({ decision: z.enum(["APPROVED", "REJECTED"]) }),
  kill: z.object({ enabled: z.boolean() }),
  supplier: z.object({ name: z.string().min(1).max(200) }),
  keyword: z.object({
    term: z.string().min(1).max(120),
    source: z.string().min(3).max(500),
    volume: z.number().int().nonnegative().nullable(),
  }),
  draft: z.object({
    productId: z.string(),
    channel: z.enum(["MERCADO_LIVRE", "SHOPEE"]),
    title: z.string().min(1).max(120),
    description: z.string().min(1).max(10000),
    price: z.number().positive(),
  }),
};
export function Contract(key: keyof typeof bodies) {
  return ApiBody({
    schema: z.toJSONSchema(bodies[key], {
      target: "openapi-3.0",
      unrepresentable: "any",
    }) as any,
  });
}
