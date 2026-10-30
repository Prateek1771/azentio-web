import { type Page, expect, test } from "@playwright/test";

// PRD §1.7 acceptance matrix: every persona × every guarded route, expected outcome asserted.
// ok = page renders · 403 = forbidden boundary · 404 = not found (other tenants never confirmed) · login = redirect.

type Outcome = "ok" | "403" | "404" | "login";
const PERSONAS = { anon: null, admin: /Portal admin/, moderator: /Learning moderator/, po: /Product owner/, publisher: /Content publisher/, acme: /Acme Bank/ } as const;
type Who = keyof typeof PERSONAS;

// columns: anon, admin, moderator, po, publisher, acme
const MATRIX: Record<string, [Outcome, Outcome, Outcome, Outcome, Outcome, Outcome]> = {
  "/s": ["login", "ok", "ok", "ok", "ok", "403"],
  "/s/audit": ["login", "ok", "403", "403", "403", "403"],
  "/s/aira": ["login", "ok", "403", "403", "403", "403"],
  "/s/outbox": ["login", "ok", "403", "403", "403", "403"],
  "/s/moderation": ["login", "403", "ok", "403", "403", "403"],
  "/s/reports": ["login", "403", "ok", "403", "403", "403"],
  "/s/insights": ["login", "403", "ok", "ok", "403", "403"],
  "/s/publisher": ["login", "403", "403", "403", "ok", "403"],
  "/e/teams": ["login", "ok", "ok", "ok", "ok", "403"],
  "/e/fl": ["login", "ok", "ok", "ok", "ok", "403"],
  "/e/library": ["login", "ok", "ok", "ok", "ok", "403"],
  "/learning": ["login", "ok", "ok", "ok", "ok", "ok"],
  "/c/acme-bank": ["login", "404", "404", "404", "404", "ok"],
  "/c/borealis-finance": ["login", "404", "404", "404", "404", "404"],
  "/c/no-such-org": ["login", "404", "404", "404", "404", "404"],
};

async function outcome(page: Page, path: string): Promise<Outcome> {
  await page.goto(path);
  await page.locator("h1").filter({ visible: true }).first().waitFor({ timeout: 20_000 });
  if (new URL(page.url()).pathname.startsWith("/login")) return "login";
  if (await page.getByText(/isn.t part of your access/).filter({ visible: true }).count()) return "403";
  if (await page.getByText(/couldn.t find that page/).filter({ visible: true }).count()) return "404";
  if (await page.getByText(/page couldn.t load/).filter({ visible: true }).count()) throw new Error(`${path} hit the error boundary`);
  return "ok";
}

(Object.keys(PERSONAS) as Who[]).forEach((who, col) => {
  test(`access matrix: ${who}`, async ({ browser }) => {
    test.setTimeout(180_000);
    const page = await (await browser.newContext()).newPage();
    const name = PERSONAS[who];
    if (name) {
      await page.goto("/login");
      await page.getByRole("heading", { name: "Demo accounts" }).waitFor({ timeout: 10_000 }).catch(() => {});
      const button = page.getByRole("button", { name });
      test.skip((await button.count()) === 0, "demo login not enabled on this server");
      await button.click();
      await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20_000 });
    }
    const got: Record<string, Outcome> = {};
    const want: Record<string, Outcome> = {};
    for (const [path, row] of Object.entries(MATRIX)) {
      want[path] = row[col];
      got[path] = await outcome(page, path);
    }
    expect(got).toEqual(want); // one diff shows every mismatched cell
  });
});
