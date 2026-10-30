import { type Browser, type Page, expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

process.loadEnvFile?.(".env.local");
const REST = `${process.env.NEXT_PUBLIC_INSFORGE_URL}/api/database/records`;
const auth = { Authorization: `Bearer ${process.env.INSFORGE_API_KEY}`, "Content-Type": "application/json", Prefer: "return=representation" };
const persona = (a: string) => (process.env.DEMO_INBOX ?? "hitliprateek5@gmail.com").replace("@", `+${a}@`).toLowerCase();
const stamp = Date.now();
const tag = `s${stamp}`; // single search token shared by every scenario item

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
  await fetch(`${REST}/ideas?title=like.*${tag}*`, { method: "DELETE", headers: auth });
  await fetch(`${REST}/themes?name=like.*${tag}*`, { method: "DELETE", headers: auth });
  await fetch(`${REST}/contributions?title=like.*${tag}*`, { method: "DELETE", headers: auth });
});

test("SME seasonality scenario: three orgs → moderation → theme → idea → clients see it; withdrawal purges", async ({ browser }) => {
  test.setTimeout(240_000);
  // Borealis and Cedar submissions are fixtures (those demo accounts aren't verified); Acme goes through the UI.
  const orgs = (await (await fetch(`${REST}/orgs?select=id,slug`, { headers: auth })).json()) as { id: string; slug: string }[];
  const orgId = (slug: string) => orgs.find((o) => o.slug === slug)!.id;
  const [{ user_id: author }] = await (await fetch(`${REST}/profiles?select=user_id&email=eq.${encodeURIComponent(persona("admin"))}`, { headers: auth })).json();
  for (const [slug, title, body] of [
    ["borealis-finance", `Agri borrowers weak outside harvest ${tag}`, "Agricultural SMEs look weak for most of the year and recover at harvest time."],
    ["cedar-credit", `Tourism off-season dips trigger reviews ${tag}`, "Tourism members see predictable off-season revenue dips that trigger manual reviews."],
  ]) {
    const [c] = await (await fetch(`${REST}/contributions`, {
      method: "POST", headers: auth,
      body: JSON.stringify([{ org_id: orgId(slug), author_id: author, type: "observation", title, body, visibility_choice: "propose_shared", state: "submitted", evidence_type: "client_feedback", confidence: "med" }]),
    })).json();
    await fetch(`${REST}/consents`, { method: "POST", headers: auth, body: JSON.stringify([{ contribution_id: c.id, actor: author, store: true, publish: true, attribute: false, train: false }]) });
  }

  // 1 · Acme proposes through the UI
  const acme = await as(browser, /Acme Bank/);
  const acmeTitle = `Seasonal SME inflows misread at Acme ${tag}`;
  await acme.goto("/c/acme-bank/observations/new");
  await acme.getByLabel("Title").fill(acmeTitle);
  await acme.getByLabel("What did you observe?").fill("Retail SMEs show Q4 peaks and Q1 troughs that peer comparisons treat as deterioration.");
  await acme.getByRole("radio", { name: /Propose to the community/ }).check();
  await acme.getByRole("checkbox", { name: /Store this contribution/ }).check();
  await acme.getByRole("checkbox", { name: /Publish a de-identified version/ }).check();
  await acme.getByRole("button", { name: "Save & submit for review" }).click();
  await expect(visible(acme, "In review").first()).toBeVisible();
  const acmeUrl = acme.url();

  // 2 · moderator: clarification on Acme, then resubmit, then publish all three (redacting Acme's)
  const mod = await as(browser, /Learning moderator/);
  await mod.goto("/s/moderation");
  await mod.getByRole("link", { name: new RegExp(acmeTitle) }).click();
  await mod.getByLabel("Reason for the contributor").fill("Please confirm the period these figures cover.");
  await mod.getByRole("button", { name: "Request clarification" }).click();
  await expect(mod.getByRole("status")).toContainText("Returned to the contributor");

  await acme.goto(acmeUrl);
  await expect(acme.getByRole("note").filter({ visible: true })).toContainText("Please confirm the period these figures cover.");
  await acme.getByRole("button", { name: "Resubmit unchanged" }).click();
  await expect(visible(acme, "In review").first()).toBeVisible();

  for (const title of [acmeTitle, `Agri borrowers weak outside harvest ${tag}`, `Tourism off-season dips trigger reviews ${tag}`]) {
    await mod.goto("/s/moderation");
    await mod.getByRole("link", { name: new RegExp(title) }).click();
    if (title === acmeTitle) await mod.getByLabel("Shared title").fill(`Seasonal SME inflows misread by peers ${tag}`); // redact the bank's name
    await mod.getByRole("button", { name: "Publish shared copy" }).click();
    await expect(mod.getByRole("status").filter({ hasText: "Published" })).toBeVisible();
  }

  // 3 · product owner groups them into a confirmed theme and opens an idea
  const po = await as(browser, /Product owner/);
  const theme = `Seasonality context ${tag}`;
  await po.goto("/s/insights/themes/new");
  await po.getByLabel("Theme name").fill(theme);
  await po.getByLabel("Summary").fill("SME cash flow follows seasonal cycles that point-in-time comparisons misread.");
  await po.getByLabel("Status", { exact: true }).selectOption("confirmed");
  await po.getByRole("button", { name: "Save theme" }).click();
  await expect(h1(po)).toHaveText(theme);
  await po.getByLabel("Search approved contributions").fill(tag);
  await po.getByRole("button", { name: "Find" }).click();
  for (let i = 0; i < 3; i++) {
    await po.getByRole("button", { name: "Link" }).first().click();
    await expect(visible(po, `Linked evidence (${i + 1})`)).toBeVisible();
  }
  await expect(visible(po, "3 organisations")).toBeVisible();

  const idea = `Seasonality-aware comparisons ${tag}`;
  await po.goto("/s/insights/ideas/new");
  await po.getByLabel("Idea title").fill(idea);
  await po.getByLabel("Problem (internal)").fill("Peer comparisons ignore seasonal cycles. INTERNAL-ONLY-NOTE");
  await po.getByLabel("Theme").selectOption({ label: theme });
  await po.getByLabel("Status", { exact: true }).selectOption("under_review");
  await po.getByLabel("Visible to clients (title, status, owner and the update only)").check();
  await po.getByRole("button", { name: "Save idea" }).click();
  await expect(h1(po)).toHaveText(idea);
  await po.getByLabel("Search approved contributions").fill(tag);
  await po.getByRole("button", { name: "Find" }).click();
  await po.getByRole("listitem").filter({ hasText: "Seasonal SME inflows misread by peers" }).getByRole("button", { name: "Link" }).click();
  await expect(visible(po, "Linked evidence (1)")).toBeVisible();
  await po.getByLabel("Update for contributors").fill("We're assessing seasonal explanations in peer comparisons. No delivery date yet.");
  await po.getByRole("button", { name: "Save idea" }).click();
  await expect(visible(po, /Under review/).first()).toBeVisible();

  // 4 · Acme sees the theme (3 orgs), the idea in plain language, and is notified
  await acme.goto("/learning/themes");
  const card = acme.getByRole("article", { name: theme });
  await expect(card).toContainText("3 organisations");
  await acme.goto("/learning/ideas");
  await expect(visible(acme, idea)).toBeVisible();
  await expect(visible(acme, "This is not a delivery commitment.").first()).toBeVisible();
  await expect(acme.getByText("INTERNAL-ONLY-NOTE")).toHaveCount(0);
  await expect(acme.getByRole("button", { name: /Notifications, \d+ unread/ }).filter({ visible: true })).toBeVisible();

  // 5 · feed search finds it; the redacted copy never names the bank
  await acme.goto(`/learning?q=${tag}`);
  await expect(acme.getByRole("status").filter({ hasText: "3 approved contributions" })).toBeVisible();
  await expect(acme.getByRole("main").getByText(/at Acme/)).toHaveCount(0);

  // 6 · withdrawal: gone from the feed and the theme immediately
  await acme.goto(acmeUrl);
  await acme.getByRole("button", { name: "Withdraw" }).click();
  await expect(visible(acme, "Withdrawn").first()).toBeVisible();
  await acme.goto(`/learning?q=${tag}`);
  await expect(acme.getByRole("status").filter({ hasText: "2 approved contributions" })).toBeVisible();
  await acme.goto("/learning/themes");
  await expect(acme.getByRole("article", { name: theme })).toContainText("Small sample: fewer than 3 organisations");
});

test("role gates on moderation and insights", async ({ browser }) => {
  const checks: [RegExp, string[]][] = [
    [/Product owner/, ["/s/moderation", "/s/reports"]],
    [/Content publisher/, ["/s/insights", "/s/moderation"]],
    [/Acme Bank/, ["/s/moderation", "/s/insights", "/s/reports"]],
  ];
  for (const [who, paths] of checks) {
    const page = await as(browser, who);
    for (const path of paths) {
      await page.goto(path);
      await expect(visible(page, /isn.t part of your access/), `${who.source} ${path}`).toBeVisible();
    }
  }
  const anon = await (await browser.newContext()).newPage();
  await anon.goto("/learning");
  await expect(anon).toHaveURL(/\/login/);
});

test("no serious accessibility violations on learning and moderation pages", async ({ browser }) => {
  for (const [who, paths] of [
    [/Acme Bank/, ["/learning", "/learning/themes", "/learning/ideas"]],
    [/Learning moderator/, ["/s/moderation", "/s/moderation?tab=published", "/s/reports"]],
    [/Product owner/, ["/s/insights", "/s/insights/themes/new", "/s/insights/ideas/new"]],
  ] as const) {
    const page = await as(browser, who);
    for (const path of paths) {
      await page.goto(path);
      await h1(page).waitFor();
      const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag22aa"]).analyze();
      const serious = violations.filter((v) => v.impact === "serious" || v.impact === "critical");
      expect(serious.map((v) => `${path}: ${v.id} ${v.nodes[0]?.target}`)).toEqual([]);
    }
  }
});
