import { expect, test } from "@playwright/test";

test("home renders the brand hero", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Build Intelligence.");
  await expect(page.getByRole("link", { name: "azentio.ai home" }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: /Credit Strategy Simulator/ })).toBeVisible();
});

test("desktop mega menu opens and closes", async ({ page }) => {
  await page.goto("/");
  const trigger = page.getByRole("button", { name: "Innovation" });
  await trigger.click();
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("link", { name: /AI Lab/ }).first()).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
});

test("server reaches InsForge", async ({ request }) => {
  const res = await request.get("/api/health");
  expect(res.ok()).toBeTruthy();
  expect(await res.json()).toEqual({ ok: true, insforge: true });
});

test("mobile navigation drawer opens", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Open navigation" }).click();
  await expect(page.getByRole("navigation", { name: "Mobile navigation" })).toBeVisible();
});

test("AIRA launcher toggles its panel", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Open AIRA" }).click();
  await expect(page.getByRole("dialog", { name: "AIRA assistant" })).toBeVisible();
});
