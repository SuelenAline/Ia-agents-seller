import {
  price,
  seo,
  demoProducts,
  equivalent,
  competitorSchema,
  historicalRowSchema,
} from "../packages/domain/src";
const costs = {
  cost: 24,
  packaging: 2,
  shipping: 7,
  fixedFee: 0,
  feeRate: 0.16,
  taxRate: 0.06,
  adRate: 0.05,
  marginRate: 0.2,
  minimumPrice: 49.9,
};
describe("precificação determinística", () => {
  test("arredonda para cima e preserva contribuição alvo", () => {
    const r = price(costs);
    expect(r.recommended).toBe(62.27);
    expect(r.marginRate).toBeGreaterThanOrEqual(0.2);
  });
  test("aplica piso mesmo com custo baixo", () => {
    expect(price({ ...costs, cost: 0, minimumPrice: 100 }).recommended).toBe(
      100,
    );
  });
  test.each([1, 1.01])("rejeita soma de taxas e margem %s", (sum) => {
    expect(() =>
      price({
        ...costs,
        feeRate: 0.5,
        taxRate: 0,
        adRate: 0,
        marginRate: sum - 0.5,
      }),
    ).toThrow();
  });
  test.each([-1, NaN, Infinity])("rejeita custo inválido %s", (cost) =>
    expect(() => price({ ...costs, cost })).toThrow(),
  );
  test("piso não pode ser zero", () =>
    expect(() => price({ ...costs, minimumPrice: 0 })).toThrow());
});
describe("agentes fundamentados", () => {
  test("SEO exige ficha validada", () =>
    expect(() =>
      seo({ ...demoProducts[0], validated: false }, "MERCADO_LIVRE"),
    ).toThrow());
  test("SEO respeita limite local e usa atributos conhecidos", () => {
    const draft = seo(demoProducts[0], "MERCADO_LIVRE");
    expect(draft.title.length).toBeLessThanOrEqual(60);
    expect(draft.attributes.fabric).toBe("Algodão");
    expect(draft.policyStatus).toBe("REQUIRES_CHANNEL_VALIDATION");
  });
  test("equivalência rejeita tamanho e quantidade divergentes", () => {
    const c = competitorSchema.parse({
      ...demoProducts[0],
      externalId: "c",
      channel: "MERCADO_LIVRE",
      size: "2",
      price: 60,
      shipping: 8,
      source: "CSV autorizado",
      capturedAt: new Date().toISOString(),
    });
    expect(equivalent(demoProducts[0], c)).toBe(true);
    expect(equivalent(demoProducts[0], { ...c, size: "12" })).toBe(false);
    expect(equivalent(demoProducts[0], { ...c, pieces: 3 })).toBe(false);
    expect(c.sales).toBeNull();
  });
  test("datas históricas são estritas", () => {
    const row = {
      sku: "a",
      date: "2024-02-30",
      channel: "SHOPEE",
      orders: 1,
      visits: null,
      revenue: 1,
      adSpend: 0,
      cost: 0,
    };
    expect(historicalRowSchema.safeParse(row).success).toBe(false);
    expect(
      historicalRowSchema.safeParse({ ...row, date: "2025-01-01" }).success,
    ).toBe(false);
  });
});
