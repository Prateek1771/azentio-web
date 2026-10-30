import { type Browser, type Page, expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

process.loadEnvFile?.(".env.local");
const REST = `${process.env.NEXT_PUBLIC_INSFORGE_URL}/api/database/records`;
const auth = { Authorization: `Bearer ${process.env.INSFORGE_API_KEY}`, "Content-Type": "application/json", Prefer: "return=representation" };
const persona = (a: string) => (process.env.DEMO_INBOX ?? "hitliprateek5@gmail.com").replace("@", `+${a}@`).toLowerCase();
const stamp = Date.now();
const tag = `c${stamp.toString(36)}`;
const SEEDED = "Seasonal SME inflows misread as distress"; // from npm run seed // no long digit runs: comment bodies are PII-scanned

test.describe.configure({ mode: "serial" });

const visible = (page: Page, text: string | RegExp) => page.getByText(text).filter({ visible: true });
const h1 = (page: Page) => page.getByRole("heading", { level: 1 }).filter({ visible: true }).first();

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
const get = async (path: string) => (await fetch(`${REST}/${path}`, { headers: auth })).json();

let fixtureUser: string | undefined;
let acmeOrg: string | undefined;

test.afterAll(async () => {
  if (fixtureUser) await fetch(`${REST}/memberships?user_id=eq.${fixtureUser}&org_id=eq.${acmeOrg}`, { method: "DELETE", headers: auth });
  for (const q of [`content?title=like.*${tag}*`, `contributions?title=like.*${tag}*`, `saved_searches?name=like.*${tag}*`, `comments?body=like.*${tag}*`])
    await fetch(`${REST}/${q}`, { method: "DELETE", headers: auth });
});

test("client admin manages roles; the last administrator can't be removed", async ({ browser }) => {
  [{ id: acmeOrg }] = await get("orgs?select=id&slug=eq.acme-bank");
  [{ user_id: fixtureUser }] = await get(`profiles?select=user_id&email=eq.${encodeURIComponent(persona("admin"))}`);
  await fetch(`${REST}/memberships`, { method: "POST", headers: auth, body: JSON.stringify([{ user_id: fixtureUser, org_id: acmeOrg, role: "client_member" }]) });

  const page = await as(browser, /Acme Bank/);
  await page.goto("/c/acme-bank/members");
  const row = page.getByRole("listitem").filter({ hasText: persona("admin") });
  await row.getByRole("button", { name: "Make administrator" }).click();
  await expect(row).toContainText(/admin · active/i);
  await row.getByRole("button", { name: "Make member" }).click();
  await expect(row).toContainText(/member · active/i);

  const me = page.getByRole("listitem").filter({ hasText: "(you)" });
  await me.getByRole("button", { name: "Remove" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "needs at least one administrator" })).toBeVisible();

  await page.getByRole("listitem").filter({ hasText: persona("admin") }).getByRole("button", { name: "Remove" }).click();
  await expect(page.getByRole("listitem").filter({ hasText: persona("admin") })).toHaveCount(0);
});

test("feed collaboration: open an item, bookmark, rate, comment, save a search", async ({ page }) => {
  await demoLogin(page, /Acme Bank/);
  // a seeded item: other specs publish and withdraw their own items in parallel
  await page.goto("/learning?q=distress");
  await page.getByRole("link", { name: SEEDED }).first().click();
  await expect(visible(page, "Approved contribution")).toBeVisible();

  await page.getByRole("button", { name: "Bookmark" }).click();
  await expect(page.getByRole("button", { name: "Bookmarked" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Useful" }).click();
  await expect(page.getByRole("button", { name: "Useful" })).toHaveAttribute("aria-pressed", "true");

  await page.getByLabel("Add a comment").fill(`Seen the same pattern ${tag}`);
  await page.getByRole("button", { name: "Post comment" }).click();
  await expect(page.getByRole("listitem").filter({ hasText: tag })).toContainText("You");
  await page.getByLabel("Add a comment").fill("email me at someone@example.com");
  await page.getByRole("button", { name: "Post comment" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "contact details" })).toBeVisible();

  await page.goto("/learning?q=seasonal");
  await page.getByLabel("Name for this search").fill(`Seasonality ${tag}`);
  await page.getByRole("button", { name: "Save this search" }).click();
  await page.waitForURL("**/learning/saved");
  await expect(visible(page, `Seasonality ${tag}`)).toBeVisible();
  await expect(page.getByRole("heading", { name: /Bookmarks \(\d+\)/ })).not.toHaveText("Bookmarks (0)");

  // undo the shared-state changes so other runs start clean
  await page.goto("/learning?q=distress");
  await page.getByRole("link", { name: SEEDED }).first().click();
  await page.getByRole("button", { name: "Bookmarked" }).click();
  await page.getByRole("button", { name: "Useful" }).click();
  await expect(page.getByRole("button", { name: "Useful" })).toHaveAttribute("aria-pressed", "false");
});

test("attachments stay with the source: the author downloads, other tenants get 404", async ({ browser }) => {
  const page = await as(browser, /Acme Bank/);
  await page.goto("/c/acme-bank/observations/new");
  await page.getByLabel("Title").fill(`Attachment draft ${tag}`);
  await page.getByLabel("What did you observe?").fill("A draft with a supporting file attached for the moderators.");
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(h1(page)).toHaveText(`Attachment draft ${tag}`);

  await page.getByLabel("Attach a file").setInputFiles({ name: "evidence.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n% test\n") });
  await page.getByRole("button", { name: "Upload" }).click();
  const link = page.getByRole("link", { name: "evidence.pdf" });
  await expect(link).toBeVisible();
  const href = (await link.getAttribute("href"))!;
  expect((await page.request.get(href, { maxRedirects: 0 })).status()).toBe(307);

  const po = await as(browser, /Product owner/);
  expect((await po.request.get(href, { maxRedirects: 0 })).status()).toBe(404);
  const anon = await browser.newContext();
  expect((await anon.request.get(href, { maxRedirects: 0 })).status()).toBe(404);
});

test("client resources: publisher briefs entitled clients; Acme reads, acknowledges and asks", async ({ browser }) => {
  const pub = await as(browser, /Content publisher/);
  await pub.goto("/s/publisher?tab=clients");
  await pub.getByLabel("Offering (entitled clients see it)").selectOption({ label: "SME Credit Decisioning Workbench" });
  await pub.getByLabel("Title", { exact: true }).fill(`Q4 scoring update ${tag}`);
  await pub.getByLabel("Body").fill("We've refined how seasonal inflows are treated in the scorecard explanation.");
  await pub.getByRole("button", { name: "Save as draft" }).click();
  await expect(pub.getByRole("status")).toContainText("Saved as a draft");
  const row = pub.getByRole("listitem").filter({ hasText: `Q4 scoring update ${tag}` });
  await row.getByRole("button", { name: "Publish" }).click();
  await expect(row).toContainText("Published · 0 acknowledged");

  const acme = await as(browser, /Acme Bank/);
  await acme.goto("/c/acme-bank/resources");
  await acme.getByRole("link", { name: new RegExp(`Q4 scoring update ${tag}`) }).click();
  await acme.getByRole("button", { name: "Acknowledge" }).click();
  await expect(visible(acme, /You acknowledged this/)).toBeVisible();
  await acme.getByLabel("Add a comment").fill(`Does this change thresholds ${tag}?`);
  await acme.getByRole("button", { name: "Post comment" }).click();
  await expect(acme.getByRole("listitem").filter({ hasText: tag })).toBeVisible();

  await pub.reload();
  await expect(pub.getByRole("listitem").filter({ hasText: `Q4 scoring update ${tag}` })).toContainText("1 acknowledged");
});

test("email outbox is visible to portal admins only", async ({ browser }) => {
  const admin = await as(browser, /Portal admin/);
  await admin.goto("/s/outbox");
  await expect(h1(admin)).toHaveText("Email outbox");
  const acme = await as(browser, /Acme Bank/);
  await acme.goto("/s/outbox");
  await expect(visible(acme, /isn.t part of your access/)).toBeVisible();
});

test("no serious accessibility violations on collaboration pages", async ({ browser }) => {
  const acme = await as(browser, /Acme Bank/);
  await acme.goto("/learning");
  const first = await acme.getByRole("article").first().getByRole("link").first().getAttribute("href");
  for (const [page, paths] of [
    [acme, [first!, "/learning/saved", "/c/acme-bank/resources", "/c/acme-bank/members"]],
    [await as(browser, /Portal admin/), ["/s/outbox"]],
    [await as(browser, /Content publisher/), ["/s/publisher?tab=clients"]],
  ] as const) {
    for (const path of paths) {
      await page.goto(path);
      await h1(page).waitFor();
      const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag22aa"]).analyze();
      const serious = violations.filter((v) => v.impact === "serious" || v.impact === "critical");
      expect(serious.map((v) => `${path}: ${v.id} ${v.nodes[0]?.target}`)).toEqual([]);
    }
  }
});
