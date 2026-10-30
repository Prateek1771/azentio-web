import { type Browser, type Page, expect, test } from "@playwright/test";

process.loadEnvFile?.(".env.local");
const REST = `${process.env.NEXT_PUBLIC_INSFORGE_URL}/api/database/records`;
const auth = { Authorization: `Bearer ${process.env.INSFORGE_API_KEY}`, "Content-Type": "application/json", Prefer: "return=representation" };

test.describe.configure({ mode: "serial" });

async function demoLogin(page: Page, name: RegExp) {
  await page.goto("/login");
  await page.getByRole("heading", { name: "Demo accounts" }).waitFor({ timeout: 10_000 }).catch(() => {});
  const button = page.getByRole("button", { name });
  test.skip((await button.count()) === 0, "demo login not enabled on this server");
  await button.click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20_000 });
}
const as = async (browser: Browser, who: RegExp) => {
  const page = await (await browser.newContext()).newPage();
  await demoLogin(page, who);
  return page;
};
const get = async (q: string) => (await fetch(`${REST}/${q}`, { headers: auth })).json();

let version = 0;

// A fresh candidate from the latest run, so the approval flow is repeatable without re-running Python.
test.beforeAll(async () => {
  const [prog] = await get("fl_programs?select=id&slug=eq.sme-cashflow-stress");
  test.skip(!prog, "federated programme not seeded (npm run seed, npm run fl)");
  const [latest] = await get(`model_registry?select=run_id,version,metrics,weights,weights_sha256&program_id=eq.${prog.id}&order=version.desc&limit=1`);
  test.skip(!latest, "no federated run yet (npm run fl)");
  version = latest.version + 1;
  await fetch(`${REST}/model_registry`, {
    method: "POST", headers: auth,
    body: JSON.stringify([{ program_id: prog.id, run_id: latest.run_id, version, status: "candidate", metrics: latest.metrics, weights: latest.weights, weights_sha256: latest.weights_sha256 }]),
  });
});

test("a portal admin approves a candidate model and can roll it back", async ({ browser }) => {
  const admin = await as(browser, /Portal admin/);
  await admin.goto("/e/fl");
  await admin.getByLabel(`Decision note for v${version}`).fill("Beats local-only on holdout; approved for the demo.");
  await admin.getByLabel(`Decision note for v${version}`).locator("xpath=..").getByRole("button", { name: "Approve" }).click();
  await admin.waitForURL(/done=approved/);
  const rollback = admin.getByRole("button", { name: `Roll back v${version}` });
  await expect(rollback).toBeVisible();
  await rollback.click();
  await admin.waitForURL(/done=rolled-back/);
});

test("other employees can view the programme but not decide; clients can't open it", async ({ browser }) => {
  const po = await as(browser, /Product owner/);
  await po.goto("/e/fl");
  await expect(po.getByRole("heading", { name: /Enrolled organisations/ })).toBeVisible(); // the page renders, not the error boundary
  await expect(po.getByText("A client organisation").first()).toBeVisible(); // org names stay with admins
  await expect(po.getByRole("button", { name: "Approve" })).toHaveCount(0);
  const acme = await as(browser, /Acme Bank/);
  await acme.goto("/e/fl");
  await expect(acme.getByText(/isn.t part of your access/).filter({ visible: true })).toBeVisible();
});

test("a client admin withdraws from the programme and re-joins with explicit training consent", async ({ browser }) => {
  const acme = await as(browser, /Acme Bank/);
  await acme.goto("/c/acme-bank");
  await acme.getByRole("heading", { name: "Federated learning programme" }).waitFor(); // streamed in after the shell
  const withdraw = acme.getByRole("button", { name: "Withdraw from programme" });
  test.skip((await withdraw.count()) === 0, "Acme isn't enrolled at the start of this run");
  await withdraw.click();
  await expect(acme.getByRole("status").filter({ hasText: "Withdrawn" })).toBeVisible();
  await acme.reload();
  await acme.getByRole("checkbox", { name: /I consent, on behalf of my organisation, to model training/ }).check();
  await acme.getByRole("button", { name: "Join programme" }).click();
  await expect(acme.getByRole("status").filter({ hasText: "Enrolled" })).toBeVisible();
});
