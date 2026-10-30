import { type Browser, type Page, expect, test } from "@playwright/test";

process.loadEnvFile?.(".env.local");
const REST = `${process.env.NEXT_PUBLIC_INSFORGE_URL}/api/database/records`;
const auth = { Authorization: `Bearer ${process.env.INSFORGE_API_KEY}`, "Content-Type": "application/json", Prefer: "return=representation" };
const persona = (a: string) => (process.env.DEMO_INBOX ?? "hitliprateek5@gmail.com").replace("@", `+${a}@`).toLowerCase();
const tag = `a${Date.now().toString(36)}`;

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

test.afterAll(async () => {
  await fetch(`${REST}/contributions?title=like.*${tag}*`, { method: "DELETE", headers: auth });
});

test("moderators see likely duplicates and can ask for an AI redaction suggestion", async ({ browser }) => {
  const [{ id: org }] = await (await fetch(`${REST}/orgs?select=id&slug=eq.acme-bank`, { headers: auth })).json();
  const [{ user_id: author }] = await (await fetch(`${REST}/profiles?select=user_id&email=eq.${encodeURIComponent(persona("admin"))}`, { headers: auth })).json();
  const [c] = await (await fetch(`${REST}/contributions`, {
    method: "POST", headers: auth,
    body: JSON.stringify([{ org_id: org, author_id: author, type: "observation", visibility_choice: "propose_shared", state: "submitted",
      title: `Seasonal SME inflows misread as distress at Acme Bank ${tag}`,
      body: "Retail-trade SMEs show sharp Q4 inflow peaks and Q1 troughs. Peer comparisons that ignore the cycle flag healthy firms as deteriorating in Q1. Ask rm.lead@acme.example.",
      evidence_type: "client_feedback", confidence: "med" }]),
  })).json();

  const mod = await as(browser, /Learning moderator/);
  await mod.goto(`/s/moderation/${c.id}`);
  await expect(mod.getByRole("region", { name: "Possible duplicates" })).toContainText("Seasonal SME inflows misread as distress");
  await mod.getByRole("button", { name: "Suggest redaction" }).click();
  const s = mod.getByRole("status").filter({ hasText: "AI-generated suggestion" });
  await expect(s).toBeVisible({ timeout: 45_000 });
  await s.getByRole("button", { name: "Use this in the shared copy" }).click();
  // the flags list quotes what was removed; the text applied to the shared copy is clean
  await expect(mod.getByLabel("Shared text")).not.toHaveValue(/rm\.lead@acme\.example/);
  await expect(mod.getByLabel("Shared title")).not.toHaveValue(/Acme Bank/);
});

test("product owners get theme suggestions and a cited trend digest", async ({ browser }) => {
  const po = await as(browser, /Product owner/);
  await po.goto("/s/insights/suggest");
  await po.getByRole("button", { name: "Suggest themes" }).click();
  await expect(po.getByRole("button", { name: "Create as draft theme" }).first()).toBeVisible({ timeout: 60_000 });
  await po.getByRole("button", { name: "Generate last-30-days digest" }).click();
  const digest = po.getByRole("status").filter({ hasText: "every claim is cited" });
  await expect(digest).toBeVisible({ timeout: 60_000 });
  await expect(digest.getByRole("link", { name: /^S\d+$/ }).first()).toBeVisible();
});

test("assists are staff-only", async ({ browser }) => {
  const acme = await as(browser, /Acme Bank/);
  await acme.goto("/s/insights/suggest");
  await expect(acme.getByText(/isn.t part of your access/).filter({ visible: true })).toBeVisible();
});
