import { type Page, expect, test } from "@playwright/test";

// Next keeps the previous route mounted but hidden, so assertions target visible elements only.
const visible = (page: Page, text: string | RegExp, exact = false) => page.getByText(text, { exact }).filter({ visible: true });

async function demoLogin(page: Page, name: RegExp) {
  await page.goto("/login");
  await page.getByRole("heading", { name: "Demo accounts" }).waitFor({ timeout: 10_000 }).catch(() => {});
  const button = page.getByRole("button", { name });
  test.skip((await button.count()) === 0, "demo login not enabled on this server");
  await button.click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20_000 });
}

// First entry into a client workspace goes through the terms gate (a streamed redirect), so decide
// by what actually renders rather than by the URL.
async function enterAcme(page: Page, path = "/c/acme-bank") {
  await page.goto(path);
  const h1 = page.getByRole("heading", { level: 1 }).filter({ visible: true });
  await expect(h1).toHaveText(/Acme Bank|Members & invitations|Before you enter/);
  if ((await h1.textContent())?.startsWith("Before you enter")) {
    await page.getByRole("button", { name: "Accept and enter workspace" }).click();
    await expect(h1).toHaveText("Acme Bank");
    if (path !== "/c/acme-bank") await page.goto(path);
  }
  await expect(page).toHaveURL(new RegExp(`${path}$`));
}

test.describe("signed out", () => {
  test("protected pages redirect to login and remember where you were going", async ({ page }) => {
    await page.goto("/e");
    await expect(page).toHaveURL(/\/login\?next=%2Fe$/);
    await page.goto("/account");
    await expect(page).toHaveURL(/\/login$/);
  });

  test("an invitation link asks you to sign in first", async ({ page }) => {
    await page.goto("/invite/abc123");
    await expect(page).toHaveURL(/\/login\?next=%2Finvite%2Fabc123$/);
  });
});

test("portal admin lands in the staff console and can sign out from the header menu", async ({ page }) => {
  await demoLogin(page, /Portal admin/);
  await expect(page).toHaveURL(/\/s$/);
  await expect(page.getByRole("heading", { level: 1 }).filter({ visible: true })).toHaveText("Governance, publishing and learning operations.");
  await expect(visible(page, "Audit log", true)).toBeVisible();

  await page.getByRole("button", { name: "Account menu" }).click();
  await expect(page.getByRole("menuitem", { name: /Staff console/ })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: /Acme Bank/ })).toHaveCount(0);
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test("moderator sees only the tiles their grant unlocks", async ({ page }) => {
  await demoLogin(page, /Learning moderator/);
  await expect(page).toHaveURL(/\/s$/);
  await expect(visible(page, "Moderation queue", true)).toBeVisible();
  await expect(visible(page, "Audit log", true)).toHaveCount(0);
});

test("client admin: terms gate, own workspace only, no employee or staff areas", async ({ page }) => {
  await demoLogin(page, /Acme Bank/);
  await enterAcme(page);
  await expect(page.getByRole("heading", { level: 1 }).filter({ visible: true })).toHaveText("Acme Bank");
  await expect(visible(page, "Credit Strategy Simulator", true)).toBeVisible(); // entitled
  await expect(visible(page, "RIVA", true)).toHaveCount(0); // not entitled

  await page.goto("/c/borealis-finance");
  await expect(visible(page, /couldn.t find that page/)).toBeVisible();
  await page.goto("/e");
  await expect(visible(page, /isn.t part of your access/)).toBeVisible();
  await page.goto("/s");
  await expect(visible(page, /isn.t part of your access/)).toBeVisible();
});

test("client admin creates a single-use invite link and can revoke it", async ({ page }) => {
  await demoLogin(page, /Acme Bank/);
  await enterAcme(page, "/c/acme-bank/members");
  const email = `e2e-${Date.now()}@example.com`;
  await page.getByLabel("Email").filter({ visible: true }).fill(email);
  await page.getByRole("button", { name: "Create invite" }).click();
  await expect(page.getByLabel("Invitation link")).toHaveValue(/\/invite\/[0-9a-f]{64}$/);

  const row = page.getByRole("listitem").filter({ hasText: email });
  await expect(row).toContainText(/pending/i);
  await row.getByRole("button", { name: "Revoke" }).click();
  await expect(page.getByRole("listitem").filter({ hasText: email })).toContainText(/revoked/i);
});
