import { type Page, expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { PUBLIC_ROUTES, contentPages, products } from "../lib/content";

// DB assertions use the admin key from .env.local via the REST API (test-only; never shipped to the browser).
// Plain fetch because Playwright compiles specs to CommonJS and the SDK is ESM-only.
process.loadEnvFile?.(".env.local");
async function rest(method: "GET" | "DELETE", table: string, query: string) {
  const res = await fetch(`${process.env.NEXT_PUBLIC_INSFORGE_URL}/api/database/records/${table}?${query}`, {
    method,
    headers: { Authorization: `Bearer ${process.env.INSFORGE_API_KEY}` },
  });
  if (!res.ok) throw new Error(`${method} ${table}: ${res.status} ${await res.text()}`);
  return method === "GET" ? res.json() : null;
}

// One worker for this file: afterAll cleanup must not race another worker's DB assertions.
test.describe.configure({ mode: "serial" });

const h1 = (page: Page) => page.getByRole("heading", { level: 1 }).filter({ visible: true });
const stamp = Date.now();

test.afterAll(async () => {
  await rest("DELETE", "demo_requests", "email=like.e2e-*@example.com");
  await rest("DELETE", "event_registrations", "email=ilike.e2e-*@example.com");
});

test("every public route renders its prototype headline", async ({ page }) => {
  const expected: Record<string, RegExp> = {
    "/": /Build Intelligence\./,
    "/products": /Intelligent Products\. Real-World Purpose\./,
    "/media": /See the Thinking/,
    "/live": /Where Intelligence Comes Alive/,
    "/connect": /Have a Challenge\?/,
    "/hackathon/register": /Start with/,
    ...Object.fromEntries(Object.entries(contentPages).map(([k, v]) => [`/${k}`, new RegExp(v.title.split(".")[0])])),
  };
  for (const route of PUBLIC_ROUTES) {
    const res = await page.goto(route);
    expect(res?.status(), route).toBe(200);
    await expect(h1(page).first(), route).toHaveText(expected[route]);
  }
});

test("all product pages render headline and workflow; unknown slug is 404", async ({ page }) => {
  for (const p of products) {
    await page.goto(`/products/${p.slug}`);
    await expect(h1(page)).toHaveText(p.headline);
    await expect(page.getByRole("list", { name: `${p.name} workflow` }).getByRole("listitem")).toHaveCount(p.flow.length);
  }
  const res = await page.goto("/products/not-a-product");
  expect(res?.status()).toBe(404);
});

test("hero carousel: next, dots and pause", async ({ page }) => {
  await page.goto("/");
  const dots = page.getByRole("button", { name: /Show banner/ });
  await expect(dots.first()).toHaveAttribute("aria-current", "true");
  await page.getByRole("button", { name: "Next banner" }).click();
  await expect(dots.nth(1)).toHaveAttribute("aria-current", "true");
  await dots.first().click();
  await expect(dots.first()).toHaveAttribute("aria-current", "true");
  const pause = page.getByRole("button", { name: /Pause carousel|Play carousel/ });
  const before = await pause.getAttribute("aria-pressed");
  await pause.click();
  await expect(pause).not.toHaveAttribute("aria-pressed", before!);
});

test("capability flip cards toggle by click and keyboard", async ({ page }) => {
  await page.goto("/");
  const card = page.getByRole("button", { name: /^Document Intelligence:/ });
  await expect(card).toHaveAttribute("aria-pressed", "false");
  await card.click();
  await expect(card).toHaveAttribute("aria-pressed", "true");
  await card.focus();
  await page.keyboard.press("Enter");
  await expect(card).toHaveAttribute("aria-pressed", "false");
});

test("connect: prefill from URL, validation keeps input, valid submit is stored", async ({ page }) => {
  await page.goto("/connect?interest=demo&product=riva");
  await expect(page.getByLabel("I'm interested in")).toHaveValue("demo");
  await expect(page.getByLabel("Tell us more")).toHaveValue(/RIVA/);

  await page.getByLabel("Name").fill("E2E Tester");
  await page.getByLabel("Work email").fill("not-an-email");
  await page.waitForTimeout(2100); // humans take longer than the 2s timing trap
  await page.getByRole("button", { name: "Submit Enquiry" }).click();
  await expect(page.getByText("Enter a valid work email.")).toBeVisible();
  await expect(page.getByLabel("Name")).toHaveValue("E2E Tester");

  const email = `e2e-connect-${stamp}@example.com`;
  await page.getByLabel("Work email").fill(email);
  await page.getByRole("button", { name: "Submit Enquiry" }).click();
  await expect(page.getByRole("status")).toContainText("received your enquiry");
  expect(await rest("GET", "demo_requests", `select=interest,name&email=eq.${email}`)).toEqual([{ interest: "demo", name: "E2E Tester" }]);
});

test("connect: honeypot submissions look successful but are not stored", async ({ page }) => {
  await page.goto("/connect");
  const email = `e2e-honeypot-${stamp}@example.com`;
  await page.getByLabel("Name").fill("Bot");
  await page.getByLabel("Work email").fill(email);
  await page.locator('input[name="website"]').evaluate((el: HTMLInputElement) => (el.value = "https://spam.example"));
  await page.waitForTimeout(2100);
  await page.getByRole("button", { name: "Submit Enquiry" }).click();
  await expect(page.getByRole("status")).toContainText("received your enquiry");
  expect(await rest("GET", "demo_requests", `select=id&email=eq.${email}`)).toEqual([]);
});

test("hackathon: consent required, registers once, duplicate is recognised", async ({ page }) => {
  const email = `e2e-hack-${stamp}@example.com`;
  await page.goto("/hackathon/register");
  await page.getByLabel("Your name").fill("E2E Hacker");
  await page.getByLabel("Email address").fill(email);
  await page.waitForTimeout(2100);
  await page.getByRole("button", { name: "Register interest" }).click();
  await expect(page.getByText("Please agree so we can store your registration.")).toBeVisible();

  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Register interest" }).click();
  await expect(page.getByRole("status")).toContainText("You're on the list.");

  await page.goto("/hackathon/register");
  await page.getByLabel("Your name").fill("E2E Hacker");
  await page.getByLabel("Email address").fill(email.toUpperCase());
  await page.getByRole("checkbox").check();
  await page.waitForTimeout(2100);
  await page.getByRole("button", { name: "Register interest" }).click();
  await expect(page.getByRole("status")).toContainText("You're already registered.");
});

test("no serious or critical accessibility violations on public pages", async ({ page }) => {
  for (const route of [...PUBLIC_ROUTES, "/products/sme-credit-decisioning", "/login"]) {
    await page.goto(route);
    await h1(page).first().waitFor();
    const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag22aa"]).analyze();
    const serious = violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(serious.map((v) => `${route}: ${v.id} (${v.nodes.length}) ${v.nodes[0]?.target}`)).toEqual([]);
  }
});
