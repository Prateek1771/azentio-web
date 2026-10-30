import { type Page, expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

process.loadEnvFile?.(".env.local");
const REST = `${process.env.NEXT_PUBLIC_INSFORGE_URL}/api/database/records`;
const auth = { Authorization: `Bearer ${process.env.INSFORGE_API_KEY}`, "Content-Type": "application/json", Prefer: "return=representation" };
const stamp = Date.now();
const TITLE = `E2E session ${stamp}`;

test.describe.configure({ mode: "serial" });

const visible = (page: Page, text: string | RegExp) => page.getByText(text).filter({ visible: true });

async function demoLogin(page: Page, name: RegExp) {
  await page.goto("/login");
  await page.getByRole("heading", { name: "Demo accounts" }).waitFor({ timeout: 10_000 }).catch(() => {});
  const button = page.getByRole("button", { name });
  test.skip((await button.count()) === 0, "demo login not enabled on this server");
  await button.click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20_000 });
}

test.afterAll(async () => {
  for (const [t, q] of [["live_sessions", `title=like.E2E*${stamp}*`], ["media", `title=like.E2E*${stamp}*`], ["content", `title=like.E2E*${stamp}*`]])
    await fetch(`${REST}/${t}?${q}`, { method: "DELETE", headers: auth });
});

test("publisher creates an employee-only live session; employees see it, the public does not", async ({ browser }) => {
  const pub = await (await browser.newContext()).newPage();
  await demoLogin(pub, /Content publisher/);
  await pub.goto("/s/publisher?tab=stream");
  await pub.getByLabel("Video title").fill(TITLE);
  await pub.getByLabel("Platform video or embed URL").fill("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  await expect(pub.getByTestId("embed-preview")).toHaveText("Embeds as: https://www.youtube.com/embed/dQw4w9WgXcQ");
  await pub.getByLabel("Audience").selectOption("employee");
  await pub.getByLabel("Display this video on Live now").check();
  await pub.getByRole("button", { name: "Save stream settings" }).click();
  await expect(pub.getByRole("status")).toContainText("now showing on Live");

  const emp = await (await browser.newContext()).newPage();
  await demoLogin(emp, /Product owner/);
  await emp.goto("/e/live");
  await expect(visible(emp, TITLE)).toBeVisible();
  await expect(emp.locator('iframe[src="https://www.youtube.com/embed/dQw4w9WgXcQ"]')).toHaveCount(1);

  const anon = await (await browser.newContext()).newPage();
  await anon.goto("/live");
  await expect(anon.getByText(TITLE)).toHaveCount(0);
});

test("role gates: plain employees can't publish; clients can't enter employee areas", async ({ browser }) => {
  const po = await (await browser.newContext()).newPage();
  await demoLogin(po, /Product owner/);
  await po.goto("/s/publisher");
  await expect(visible(po, /isn.t part of your access/)).toBeVisible();

  const acme = await (await browser.newContext()).newPage();
  await demoLogin(acme, /Acme Bank/);
  for (const path of ["/e/live", "/e/playground", "/e/playground/riva"]) {
    await acme.goto(path);
    await expect(visible(acme, /isn.t part of your access/), path).toBeVisible();
  }
});

test("media route hides employee-only recordings from anonymous and client users", async ({ browser, request }) => {
  const res = await fetch(`${REST}/media`, {
    method: "POST",
    headers: auth,
    body: JSON.stringify([{ title: `E2E recording ${stamp}`, audience: "employee", embed_url: "https://www.youtube.com/embed/dQw4w9WgXcQ", published: true }]),
  });
  const [{ id }] = await res.json();

  expect((await request.get(`/api/media/${id}`, { maxRedirects: 0 })).status()).toBe(404);
  const acme = await (await browser.newContext()).newPage();
  await demoLogin(acme, /Acme Bank/);
  expect((await acme.request.get(`/api/media/${id}`, { maxRedirects: 0 })).status()).toBe(404);
  const po = await (await browser.newContext()).newPage();
  await demoLogin(po, /Product owner/);
  const ok = await po.request.get(`/api/media/${id}`, { maxRedirects: 0 });
  expect(ok.status()).toBe(307);
  expect(ok.headers().location).toBe("https://www.youtube.com/embed/dQw4w9WgXcQ");
});

test("playground: run a simulated decision, see evidence, save feedback, appear in history", async ({ page }) => {
  await demoLogin(page, /Product owner/);
  await page.goto("/e/playground/sme-credit-decisioning");
  await expect(visible(page, /Sandbox · synthetic data · simulated output/)).toBeVisible();
  await page.getByRole("button", { name: "Run simulation" }).click();
  await expect(page.getByTestId("run-headline")).toContainText("(simulated)", { timeout: 15_000 });
  await expect(page.getByRole("region", { name: "Evidence" }).getByRole("listitem")).toHaveCount(5);

  await page.getByRole("button", { name: "Useful", exact: true }).click();
  await page.getByRole("radio", { name: "4 of 5" }).click();
  await page.getByRole("button", { name: "Save feedback" }).click();
  await expect(page.getByRole("status").filter({ hasText: "feedback is saved" })).toBeVisible();

  await page.goto("/e/playground");
  await expect(visible(page, /SME Credit Decisioning Workbench/).first()).toBeVisible();
  await expect(visible(page, "Feedback given").first()).toBeVisible();
});

test("homepage banner appears when published and disappears when unpublished", async ({ browser }) => {
  const pub = await (await browser.newContext()).newPage();
  await demoLogin(pub, /Content publisher/);
  await pub.goto("/s/publisher?tab=homepage");
  const text = `E2E banner ${stamp}`;
  await pub.getByLabel("Announcement").fill(text);
  await pub.getByRole("button", { name: "Save banner" }).click();
  await expect(pub.getByRole("status")).toContainText("draft");
  const row = pub.getByRole("listitem").filter({ hasText: text });
  await row.getByRole("button", { name: "Publish" }).click();
  await expect(row).toContainText("Live on homepage");

  const visitor = await (await browser.newContext()).newPage();
  await visitor.goto("/");
  await expect(visitor.getByRole("region", { name: "Announcement" })).toContainText(text);

  await row.getByRole("button", { name: "Unpublish" }).click();
  await expect(row).toContainText("Draft");
  await visitor.reload();
  await expect(visitor.getByText(text)).toHaveCount(0);
});

test("no serious accessibility violations on employee and publisher pages", async ({ browser }) => {
  for (const [who, paths] of [[/Product owner/, ["/e", "/e/playground", "/e/playground/financial-analysis", "/e/live"]], [/Content publisher/, ["/s", "/s/publisher", "/s/publisher?tab=recordings", "/s/publisher?tab=homepage"]]] as const) {
    const page = await (await browser.newContext()).newPage();
    await demoLogin(page, who);
    for (const path of paths) {
      await page.goto(path);
      await page.getByRole("heading", { level: 1 }).filter({ visible: true }).first().waitFor();
      // Third-party player iframes (YouTube/Vimeo) are outside our control; everything we render is checked.
      const { violations } = await new AxeBuilder({ page }).exclude("iframe").withTags(["wcag2a", "wcag2aa", "wcag22aa"]).analyze();
      const serious = violations.filter((v) => v.impact === "serious" || v.impact === "critical");
      expect(serious.map((v) => `${path}: ${v.id} ${v.nodes[0]?.target}`)).toEqual([]);
    }
  }
});
