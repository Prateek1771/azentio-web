import { type Browser, type Page, expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

process.loadEnvFile?.(".env.local");
const REST = `${process.env.NEXT_PUBLIC_INSFORGE_URL}/api/database/records`;
const auth = { Authorization: `Bearer ${process.env.INSFORGE_API_KEY}`, "Content-Type": "application/json" };
const persona = (a: string) => (process.env.DEMO_INBOX ?? "hitliprateek5@gmail.com").replace("@", `+${a}@`).toLowerCase();
const tag = `w${Date.now().toString(36)}`; // no long digit runs: comment bodies are PII-scanned

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

test.afterAll(async () => {
  for (const q of [`comments?body=like.*${tag}*`, `experiments?title=like.*${tag}*`, `teams?name=like.*${tag}*`, `content?title=like.*${tag}*`])
    await fetch(`${REST}/${q}`, { method: "DELETE", headers: auth });
});

let teamUrl = "";
let expUrl = "";

test("a lead builds a hackathon team; members can't change the roster", async ({ browser }) => {
  const po = await as(browser, /Product owner/);
  await po.goto("/e/teams");
  await po.getByLabel("Team name").fill(`Seasonality squad ${tag}`);
  await po.getByLabel("What are you working on?").fill("Seasonality-aware scorecards for the hackathon.");
  await po.getByRole("button", { name: "Create team" }).click();
  await expect(h1(po)).toHaveText(`Seasonality squad ${tag}`);
  teamUrl = po.url();
  await po.getByLabel("Colleague's email").fill(persona("moderator"));
  await po.getByRole("button", { name: "Add to team" }).click();
  await expect(po.getByRole("listitem").filter({ hasText: persona("moderator") })).toContainText("member");
  await po.getByLabel("Colleague's email").fill(persona("acme-admin"));
  await po.getByRole("button", { name: "Add to team" }).click();
  await expect(po.getByRole("alert").filter({ hasText: "No Azentio employee with that email" })).toBeVisible();

  // the only lead can't step down
  await po.getByRole("listitem").filter({ hasText: "(you)" }).getByRole("button", { name: "Make member" }).click();
  await expect(po.getByRole("alert").filter({ hasText: "at least one lead" })).toBeVisible();

  const mod = await as(browser, /Learning moderator/);
  await mod.goto(teamUrl);
  await expect(mod.getByLabel("Colleague's email")).toHaveCount(0); // members don't get roster controls
  await expect(mod.getByRole("button", { name: "Make lead" })).toHaveCount(0);
});

test("team experiments: drafts stay in the team, running ones are open to colleagues", async ({ browser }) => {
  const po = await as(browser, /Product owner/);
  await po.goto(teamUrl);
  await po.getByRole("link", { name: "New" }).click();
  await po.getByLabel("Experiment title").fill(`Seasonal scorecard adjustment ${tag}`);
  await po.getByLabel("Hypothesis").fill("Adjusting for seasonal inflows cuts false Q1 referrals by a third.");
  await po.getByRole("button", { name: "Save experiment" }).click();
  await expect(h1(po)).toHaveText(`Seasonal scorecard adjustment ${tag}`);
  expUrl = po.url();

  const mod = await as(browser, /Learning moderator/);
  await mod.goto(expUrl);
  await mod.getByRole("link", { name: "Edit" }).click();
  await mod.getByLabel("Method").fill("Replay 2025 referrals with and without the adjustment.");
  await mod.getByRole("button", { name: "Save experiment" }).click();
  await expect(visible(mod, "Replay 2025 referrals")).toBeVisible();

  const pub = await as(browser, /Content publisher/);
  await pub.goto(expUrl);
  await expect(h1(pub)).toHaveText(/couldn.t find that page/); // someone else's team draft

  await po.goto(`${expUrl}?edit=1`);
  await po.getByLabel("Status").selectOption("running");
  await po.getByRole("button", { name: "Save experiment" }).click();
  await expect(visible(po, "Experiment · Running")).toBeVisible();

  await pub.goto(expUrl);
  await expect(pub.getByRole("link", { name: "Edit" })).toHaveCount(0);
  await pub.getByLabel("Add a comment").fill(`Worth trying on Q2 as well ${tag}`);
  await pub.getByRole("button", { name: "Post comment" }).click();
  await expect(pub.getByRole("listitem").filter({ hasText: tag })).toContainText("You");
  await po.reload();
  await expect(po.getByRole("listitem").filter({ hasText: tag })).toContainText("publisher");
});

test("knowledge library: owners write, colleagues read, overdue reviews are flagged", async ({ browser }) => {
  const pub = await as(browser, /Content publisher/);
  await pub.goto("/e/library/new");
  await pub.getByLabel("Entry title").fill(`SME onboarding guide ${tag}`);
  await pub.getByLabel("Content").fill("How we onboard SME clients to the workbench, step by step.");
  await pub.getByLabel("Review by").fill("2025-06-30");
  await pub.getByRole("button", { name: "Save entry" }).click();
  await expect(h1(pub)).toHaveText(`SME onboarding guide ${tag}`);
  await expect(pub.getByRole("note")).toContainText("due for review");
  const url = pub.url();

  const po = await as(browser, /Product owner/);
  await po.goto("/e/library");
  await expect(po.getByRole("listitem").filter({ hasText: `SME onboarding guide ${tag}` })).toContainText("Review overdue");
  await po.goto(url);
  await expect(po.getByRole("link", { name: "Edit" })).toHaveCount(0);
});

test("clients can't enter the employee workspace", async ({ browser }) => {
  const acme = await as(browser, /Acme Bank/);
  for (const path of ["/e/teams", "/e/experiments", "/e/library"]) {
    await acme.goto(path);
    await expect(visible(acme, /isn.t part of your access/), path).toBeVisible();
  }
});

test("no serious accessibility violations on workspace pages", async ({ browser }) => {
  const po = await as(browser, /Product owner/);
  for (const path of ["/e/teams", teamUrl, "/e/experiments", expUrl, "/e/experiments/new", "/e/library", "/e/library/new"]) {
    await po.goto(path);
    await h1(po).waitFor();
    const { violations } = await new AxeBuilder({ page: po }).withTags(["wcag2a", "wcag2aa", "wcag22aa"]).analyze();
    const serious = violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(serious.map((v) => `${path}: ${v.id} ${v.nodes[0]?.target}`)).toEqual([]);
  }
});
