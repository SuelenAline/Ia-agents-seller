// Run against an already-started local environment. Never use real marketplace actions.
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const base = process.env.SMOKE_API_URL || "http://localhost:4000";
async function main() {
  const health = await fetch(`${base}/health`).then((r) => r.json());
  assert.equal(
    health.mode,
    "MOCK",
    "Smoke workflow requires explicitly marked MOCK mode",
  );
  const login = await fetch(`${base}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: process.env.ADMIN_EMAIL || "admin@example.local",
      password: process.env.ADMIN_PASSWORD || "demo-seller-2026",
    }),
  });
  assert.equal(login.status, 201);
  const { token } = await login.json();
  const call = async (path, body) => {
    const r = await fetch(`${base}/${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { status: r.status, body: await r.json() };
  };
  assert.equal((await fetch(`${base}/products`)).status, 401);
  const products = await call("products");
  assert.equal(products.status, 200);
  assert(products.body.length > 0);
  const quote = await call("pricing/simulate", {
    cost: 24,
    packaging: 2,
    shipping: 7,
    fixedFee: 0,
    feeRate: 0.16,
    taxRate: 0.06,
    adRate: 0.05,
    marginRate: 0.2,
    minimumPrice: 49.9,
  });
  assert.equal(quote.body.recommended, 62.27);
  const docs = await fetch(`${base}/docs-json`).then((r) => r.json());
  assert(
    docs.paths["/products"].post.requestBody.content["application/json"].schema
      .properties.sku,
  );
  const job = await call("agents/runs", {
    agent: "seo",
    productId: products.body[0].id,
    channel: "MERCADO_LIVRE",
    idempotencyKey: randomUUID(),
  });
  assert.equal(job.status, 201);
  let complete;
  for (let attempt = 0; attempt < 20; attempt++) {
    complete = (await call("agents/runs")).body.find(
      (r) => r.id === job.body.id,
    );
    if (complete.status === "SUCCEEDED") break;
    if (complete.status === "FAILED") throw new Error("SEO mock job failed");
    await new Promise((r) => setTimeout(r, 400));
  }
  assert.equal(complete.status, "SUCCEEDED");
  const approval = (await call("approvals")).body.find(
    (a) => a.id === `approval-${job.body.id}`,
  );
  assert(approval);
  assert.equal(
    (await call(`approvals/${approval.id}/review`, { decision: "APPROVED" }))
      .status,
    201,
  );
  assert.equal(
    (await call(`approvals/${approval.id}/execute`, {})).status,
    409,
  );
  const web = await fetch(process.env.SMOKE_WEB_URL || "http://localhost:3000");
  assert.equal(web.status, 200);
  console.log(
    JSON.stringify(
      {
        health: health.status,
        mode: health.mode,
        products: products.body.length,
        pricing: quote.body.recommended,
        openapi: "verified",
        job: complete.status,
        approval: "APPROVED",
        externalExecution: "BLOCKED",
        web: 200,
      },
      null,
      2,
    ),
  );
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
