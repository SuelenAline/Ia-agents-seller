import { test, expect } from "@playwright/test";
test("login, simulação, agente, aprovação e modo mobile", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Entrar no painel" }).click();
  await expect(
    page.getByRole("heading", { name: "Uma visão clara. Melhores decisões." }),
  ).toBeVisible();
  await expect(page.getByText("MODO MOCK")).toBeVisible();
  await page.screenshot({
    path: "artifacts/dashboard-desktop.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Precificação", exact: true }).click();
  await page.getByRole("button", { name: "Calcular preço" }).click();
  await expect(page.getByText("R$ 62,27")).toBeVisible();
  await page
    .getByRole("button", { name: "Editor de anúncios", exact: true })
    .click();
  await page.getByRole("button", { name: "Gerar proposta SEO" }).click();
  await page.getByRole("button", { name: /^Aprovações/ }).click();
  await expect(async () => {
    await page.getByRole("button", { name: "Atualizar dados" }).click();
    await expect(
      page.getByRole("button", { name: "Aprovar", exact: true }),
    ).toBeVisible();
  }).toPass({ timeout: 15000 });
  await page.getByRole("button", { name: "Aprovar", exact: true }).click();
  await expect(page.getByText("Aprovada", { exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Abrir menu" }).click();
  await page.getByRole("button", { name: "Catálogo de produtos" }).click();
  await expect(
    page.getByRole("heading", { name: "Catálogo de produtos" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "artifacts/catalog-mobile.png",
    fullPage: true,
  });
});
