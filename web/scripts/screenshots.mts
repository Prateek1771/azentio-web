// README screenshots of a running site, signed in through the demo-login buttons.
// Run: node --experimental-strip-types scripts/screenshots.mts [baseUrl]   → docs/screenshots/*.png
import { chromium, type Browser, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const base = process.argv[2] ?? "https://gz67ge67.insforge.site";
const out = fileURLToPath(new URL("../../docs/screenshots/", import.meta.url));
mkdirSync(out, { recursive: true });

async function as(browser: Browser, persona: RegExp | null, width = 1440, height = 900): Promise<Page> {
  const page = await (await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 })).newPage();
  if (persona) {
    await page.goto(`${base}/login`);
    await page.getByRole("button", { name: persona }).click();
    await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30_000 });
  }
  return page;
}

async function shot(page: Page, path: string, name: string, full = false) {
  await page.goto(`${base}${path}`, { waitUntil: "networkidle", timeout: 60_000 });
  await page.waitForTimeout(800); // let carousels/animations settle
  await page.screenshot({ path: `${out}${name}.png`, fullPage: full });
  console.log(`✓ ${name}  ${path}`);
}

const browser = await chromium.launch();

const anon = await as(browser, null);
await shot(anon, "/", "01-home");
await shot(anon, "/products/financial-analysis", "02-product");
await shot(anon, "/login", "03-login");

const client = await as(browser, /Client admin.*Acme Bank/);
await shot(client, "/c/acme-bank", "04-client-dashboard");
await shot(client, "/c/acme-bank/observations/new", "05-new-observation");
await shot(client, "/learning", "06-shared-learning");
await shot(client, "/learning/themes", "07-themes");
// AIRA answering with citations
await client.getByRole("button", { name: "Open AIRA" }).click();
const panel = client.getByRole("dialog", { name: "AIRA assistant" });
await panel.getByLabel("Ask AIRA").fill("What do approved contributions say about seasonal SME inflows being misread as distress?");
await panel.getByRole("button", { name: "Send question" }).click();
await panel.locator("[data-verdict]").last().waitFor({ timeout: 60_000 });
await client.screenshot({ path: `${out}08-aira.png` });
console.log("✓ 08-aira");

const mod = await as(browser, /Learning moderator/);
await shot(mod, "/s/moderation?tab=published", "09-moderation");

const po = await as(browser, /Product owner/);
await shot(po, "/s/insights", "10-insights");
await shot(po, "/e/playground/financial-analysis", "11-playground");

const admin = await as(browser, /Portal admin/);
await shot(admin, "/e/fl", "12-federated-learning");
await shot(admin, "/s/audit", "13-audit");

const phone = await as(browser, null, 390, 844);
await shot(phone, "/", "14-mobile-home");

await browser.close();
