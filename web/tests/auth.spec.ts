import { expect, test } from "@playwright/test";

test("protected account page sends signed-out visitors to login", async ({ page }) => {
  await page.goto("/account");
  await expect(page).toHaveURL(/\/login$/);
});

test("demo button autofills, signs in and shows the persona's access", async ({ page }) => {
  await page.goto("/login");
  const button = page.getByRole("button", { name: /Portal admin/ });
  test.skip((await button.count()) === 0, "demo login not enabled on this server");

  await button.click();
  await expect(page.getByRole("textbox").first()).toHaveValue(/\+admin@/);
  await expect(page).toHaveURL(/\/account$/, { timeout: 15_000 });
  await expect(page.getByText("Azentio", { exact: true }).filter({ visible: true })).toBeVisible();
  await expect(page.getByText("portal admin", { exact: true }).filter({ visible: true })).toBeVisible();

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test("client admin demo lands in its own organisation only", async ({ page }) => {
  await page.goto("/login");
  const button = page.getByRole("button", { name: /Acme Bank/ });
  test.skip((await button.count()) === 0, "demo login not enabled on this server");

  await button.click();
  await expect(page).toHaveURL(/\/account$/, { timeout: 15_000 });
  // Next keeps the previous route mounted but hidden, so only count what is visible.
  await expect(page.getByText("Acme Bank", { exact: true }).filter({ visible: true })).toBeVisible();
  await expect(page.getByText("Borealis Finance").filter({ visible: true })).toHaveCount(0);
  await expect(page.getByText("No platform grants")).toBeVisible();
});
