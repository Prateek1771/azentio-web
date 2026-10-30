import { type Page, expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

process.loadEnvFile?.(".env.local");
const REST = `${process.env.NEXT_PUBLIC_INSFORGE_URL}/api/database/records`;
const auth = { Authorization: `Bearer ${process.env.INSFORGE_API_KEY}`, "Content-Type": "application/json" };
const stamp = Date.now();
const BODY = "SME working-capital demand rose noticeably this quarter, led by trade finance.";

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

async function write(page: Page, title: string, audience: RegExp) {
  await page.goto("/c/acme-bank/observations/new");
  await page.getByLabel("Title").fill(title);
  await page.getByLabel("What did you observe?").fill(BODY);
  await page.getByRole("radio", { name: audience }).check();
}

test.afterAll(async () => {
  await fetch(`${REST}/notifications?payload->>title=like.E2E*${stamp}*`, { method: "DELETE", headers: auth });
  await fetch(`${REST}/contributions?title=like.E2E*${stamp}*`, { method: "DELETE", headers: auth });
});

test("propose an observation: save never shares, submit needs consent, the bell updates live, withdraw", async ({ browser }) => {
  const ctx = await browser.newContext();
  const home = await ctx.newPage();
  await demoLogin(home, /Acme Bank/);
  await home.goto("/c/acme-bank");
  const bell = home.getByRole("button", { name: /^Notifications/ }).filter({ visible: true });
  await bell.click();
  const markRead = home.getByRole("button", { name: "Mark all read" });
  if (await markRead.isVisible()) {
    await markRead.click();
    await expect(bell).toHaveAccessibleName("Notifications");
  } else await home.keyboard.press("Escape");

  const page = await ctx.newPage();
  const title = `E2E proposal ${stamp}`;
  await write(page, title, /Propose to the community/);
  // live sensitive-data warning, gone once the detail is removed
  await page.getByLabel("What did you observe?").fill(`${BODY} Ask rm.lead@acme.example for the numbers.`);
  await expect(page.getByRole("status").filter({ hasText: "an email address" })).toBeVisible();
  await page.getByLabel("What did you observe?").fill(BODY);
  await expect(page.getByRole("status").filter({ hasText: "an email address" })).toHaveCount(0);

  // without consent, submitting is refused before anything is saved
  await page.getByRole("button", { name: "Save & submit for review" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "consent to storing and publishing" })).toBeVisible();

  await page.getByRole("checkbox", { name: /Store this contribution/ }).check();
  await page.getByRole("checkbox", { name: /Publish a de-identified version/ }).check();
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(h1(page)).toHaveText(title);
  await expect(visible(page, "Draft").first()).toBeVisible();
  await expect(page.getByRole("region", { name: "Who can see this version" })).toContainText("Only you. Drafts are never shared.");

  await page.getByRole("button", { name: "Submit for review" }).click();
  await expect(visible(page, "In review").first()).toBeVisible();
  await expect(page.getByRole("region", { name: "Who can see this version" })).toContainText("Azentio moderators reviewing it");
  await expect(visible(page, "Submitted for review").first()).toBeVisible();

  // the other tab's bell updates over realtime, without a reload
  await expect(bell).toHaveAccessibleName(/Notifications, \d+ unread/, { timeout: 15_000 });

  await page.getByRole("button", { name: "Withdraw" }).click();
  await expect(visible(page, "Withdrawn").first()).toBeVisible();
  await expect(page.getByRole("region", { name: "Who can see this version" })).toContainText("Only you. Withdrawn");
});

test("share with my organisation: visible in the org list, editing creates a new version", async ({ page }) => {
  await demoLogin(page, /Acme Bank/);
  const title = `E2E org note ${stamp}`;
  await write(page, title, /My organisation/);
  await page.getByRole("button", { name: "Save & share with my organisation" }).click();
  await expect(h1(page)).toHaveText(title);
  await expect(visible(page, "Published").first()).toBeVisible();
  await expect(page.getByRole("region", { name: "Who can see this version" })).toContainText("You and members of Acme Bank.");

  await page.getByRole("link", { name: "Edit" }).click();
  await expect(page.getByRole("radio", { name: /My organisation/ })).toBeDisabled(); // audience is fixed once shared
  await page.getByLabel("What did you observe?").fill(`${BODY} Updated with Q3 data.`);
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(visible(page, /version 2/).first()).toBeVisible();
  await expect(visible(page, "Earlier versions")).toBeVisible();

  await page.goto("/c/acme-bank/observations");
  await expect(visible(page, title)).toBeVisible();
});

test("client sandbox runs for entitled offerings only", async ({ page }) => {
  await demoLogin(page, /Acme Bank/);
  await page.goto("/c/acme-bank");
  await page.getByRole("link", { name: /SME Credit Decisioning/ }).filter({ visible: true }).first().click();
  await expect(visible(page, /Sandbox · synthetic data · simulated output/)).toBeVisible();
  await page.getByRole("button", { name: "Run simulation" }).click();
  await expect(page.getByTestId("run-headline")).toContainText("(simulated)", { timeout: 15_000 });

  await page.goto("/c/acme-bank/sandboxes/riva"); // real offering, not entitled for Acme
  await expect(h1(page)).toHaveText(/couldn.t find that page/);
  expect((await page.request.get("/c/acme-bank/sandboxes/not-a-product")).status()).toBe(404);
});

test("other tenants and employees can't open Acme's workspace", async ({ browser }) => {
  for (const who of [/Product owner/, /Learning moderator/]) {
    const page = await (await browser.newContext()).newPage();
    await demoLogin(page, who);
    for (const path of ["/c/acme-bank", "/c/acme-bank/observations", "/c/acme-bank/sandboxes/sme-credit-decisioning"]) {
      await page.goto(path);
      await expect(h1(page), path).toHaveText(/couldn.t find that page/);
    }
  }
});

test("no serious accessibility violations on client pages", async ({ page }) => {
  await demoLogin(page, /Acme Bank/);
  for (const path of ["/c/acme-bank", "/c/acme-bank/observations", "/c/acme-bank/observations?tab=org", "/c/acme-bank/observations/new", "/c/acme-bank/sandboxes/financial-analysis"]) {
    await page.goto(path);
    await h1(page).waitFor();
    const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag22aa"]).analyze();
    const serious = violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(serious.map((v) => `${path}: ${v.id} ${v.nodes[0]?.target}`)).toEqual([]);
  }
});
