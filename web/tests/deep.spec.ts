import { type Page, expect, test } from "@playwright/test";
import { PUBLIC_ROUTES, products } from "../lib/content";

// Deep checks: crawl for broken links, console/hydration errors, mobile overflow, redirect safety
// and direct-API attacks. Complements the feature specs.

process.loadEnvFile?.(".env.local");
const API = process.env.NEXT_PUBLIC_INSFORGE_URL!;
const ANON = process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY!;

test.describe.configure({ mode: "serial" });

async function demoLogin(page: Page, name: RegExp) {
  await page.goto("/login");
  await page.getByRole("heading", { name: "Demo accounts" }).waitFor({ timeout: 10_000 }).catch(() => {});
  const button = page.getByRole("button", { name });
  test.skip((await button.count()) === 0, "demo login not enabled on this server");
  await button.click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20_000 });
}

// Collect real console errors and uncaught exceptions (ignore third-party noise and dev-only HMR chatter).
function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const t = m.text();
    if (/youtube|vimeo|twitch|favicon|Failed to load resource: the server responded with a status of 40[134]/i.test(t)) return;
    errors.push(`console: ${t.slice(0, 200)}`);
  });
  return errors;
}

test("crawl: every internal link on the public site resolves", async ({ page, request }) => {
  test.setTimeout(120_000); // ~25 pages, each fetched and rendered
  const seen = new Set<string>();
  const queue = [...PUBLIC_ROUTES, ...products.map((p) => `/products/${p.slug}`), "/login"];
  const broken: string[] = [];
  while (queue.length) {
    const path = queue.shift()!;
    if (seen.has(path)) continue;
    seen.add(path);
    const res = await request.get(path, { maxRedirects: 5 });
    if (res.status() >= 400) {
      broken.push(`${path} → ${res.status()}`);
      continue;
    }
    if (!PUBLIC_ROUTES.includes(path) && !path.startsWith("/products")) continue; // only expand public pages
    await page.goto(path);
    const hrefs = await page.locator("a[href^='/']").evaluateAll((as) => as.map((a) => (a as HTMLAnchorElement).getAttribute("href")!));
    for (const h of hrefs) {
      const clean = h.split("#")[0].split("?")[0] || "/";
      if (!seen.has(clean) && !/^\/(e|c|s|account|workspace|invite|onboarding)(\/|$)/.test(clean)) queue.push(clean);
    }
  }
  expect(broken).toEqual([]);
  expect(seen.size).toBeGreaterThanOrEqual(20); // 11 public routes + 8 products + login
});

test("no console errors or hydration warnings on public pages", async ({ page }) => {
  const errors = watchErrors(page);
  for (const path of [...PUBLIC_ROUTES, "/products/riva", "/login"]) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
  }
  expect(errors).toEqual([]);
});

test("no console errors on portal pages for each role", async ({ browser }) => {
  test.setTimeout(180_000); // five roles, ~25 pages
  const plan: [RegExp, string[]][] = [
    [/Portal admin/, ["/s", "/account", "/e", "/s/outbox"]],
    [/Content publisher/, ["/s/publisher", "/s/publisher?tab=recordings", "/s/publisher?tab=homepage", "/s/publisher?tab=clients"]],
    [/Product owner/, ["/e", "/e/playground", "/e/playground/document-intelligence", "/e/live", "/s/insights", "/s/insights/ideas/new", "/e/teams", "/e/experiments", "/e/library", "/e/library/new"]],
    [/Learning moderator/, ["/s/moderation", "/s/moderation?tab=published", "/s/reports", "/learning"]],
    [/Acme Bank/, ["/c/acme-bank", "/c/acme-bank/members", "/workspace", "/c/acme-bank/observations", "/c/acme-bank/observations/new", "/c/acme-bank/sandboxes/sme-credit-decisioning", "/learning", "/learning/themes", "/learning/ideas", "/learning/saved", "/c/acme-bank/resources"]],
  ];
  const errors: string[] = [];
  for (const [who, paths] of plan) {
    const page = await (await browser.newContext()).newPage();
    const pageErrors = watchErrors(page); // live array, filled as pages load
    await demoLogin(page, who);
    for (const p of paths) {
      await page.goto(p);
      await page.waitForLoadState("networkidle");
    }
    errors.push(...pageErrors.map((e) => `${who.source}: ${e}`));
  }
  expect(errors).toEqual([]);
});

test("mobile (390px): no horizontal overflow on public and portal pages", async ({ browser }) => {
  test.setTimeout(180_000); // ~30 pages across two sessions
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const overflow = async (path: string) => {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    const w = await page.evaluate(() => document.documentElement.scrollWidth);
    return w > 391 ? `${path}: ${w}px wide` : null;
  };
  const bad: string[] = [];
  for (const p of [...PUBLIC_ROUTES, "/products/sme-credit-decisioning", "/login"]) {
    const r = await overflow(p);
    if (r) bad.push(r);
  }
  await demoLogin(page, /Product owner/);
  for (const p of ["/e", "/e/playground", "/e/playground/financial-analysis", "/e/live", "/account", "/e/teams", "/e/experiments", "/e/library"]) {
    const r = await overflow(p);
    if (r) bad.push(r);
  }
  const client = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  await demoLogin(client, /Acme Bank/);
  for (const p of ["/c/acme-bank", "/c/acme-bank/observations", "/c/acme-bank/observations/new", "/c/acme-bank/sandboxes/financial-analysis", "/learning", "/learning/themes", "/learning/ideas", "/learning/saved", "/c/acme-bank/resources", "/c/acme-bank/members"]) {
    await client.goto(p);
    await client.waitForLoadState("networkidle");
    const w = await client.evaluate(() => document.documentElement.scrollWidth);
    if (w > 391) bad.push(`${p}: ${w}px wide`);
  }
  expect(bad).toEqual([]);
});

test("redirect safety: ?next= cannot send users off-site", async ({ page }) => {
  for (const evil of ["//evil.example", "/\\evil.example", "https://evil.example", "javascript:alert(1)"]) {
    await page.context().clearCookies();
    await page.goto(`/login?next=${encodeURIComponent(evil)}`);
    await page.getByRole("heading", { name: "Demo accounts" }).waitFor({ timeout: 10_000 }).catch(() => {});
    const btn = page.getByRole("button", { name: /Product owner/ });
    test.skip((await btn.count()) === 0, "demo login not enabled");
    await btn.click();
    await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20_000 });
    expect(new URL(page.url()).host, evil).toBe(new URL(page.url()).host); // same host
    expect(page.url(), evil).not.toContain("evil.example");
  }
});

test("direct API attacks with the public anon key are refused", async () => {
  const h = { Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" };
  const get = (t: string) => fetch(`${API}/api/database/records/${t}?limit=5`, { headers: h }).then(async (r) => ({ s: r.status, b: r.ok ? await r.json() : [] }));
  const leaks: string[] = [];
  for (const t of ["orgs", "memberships", "grants", "employee_allowlist", "provisioned_access", "invitations", "entitlements", "audit_log", "demo_requests", "event_registrations", "guardrail_rules", "aira_interactions", "guardrail_events", "playground_runs", "profiles", "terms_acceptance"]) {
    const { b } = await get(t);
    if (Array.isArray(b) && b.length) leaks.push(`${t}: ${b.length} rows`);
  }
  // only explicitly public, published content may be readable
  const content = (await get("content")).b as { audience?: string; published?: boolean }[];
  if (content.some((c) => c.audience !== "public")) leaks.push("content: non-public rows");
  expect(leaks).toEqual([]);

  const writes = [
    ["demo_requests", { interest: "demo", name: "x", email: "x@example.com" }],
    ["orgs", { slug: "evil-org", name: "Evil", kind: "client" }],
    ["grants", { user_id: "00000000-0000-0000-0000-000000000000", kind: "portal_admin" }],
    ["content", { kind: "banner", title: "defaced", audience: "public", published: true }],
  ] as const;
  for (const [t, row] of writes) {
    const r = await fetch(`${API}/api/database/records/${t}`, { method: "POST", headers: h, body: JSON.stringify([row]) });
    expect(r.ok, `anon write to ${t}`).toBe(false);
  }
  const rpc = await fetch(`${API}/api/database/rpc/create_invitation`, { method: "POST", headers: h, body: JSON.stringify({ p_org: "00000000-0000-0000-0000-000000000000", p_email: "a@b.co", p_role: "client_admin" }) });
  expect(rpc.ok, "anon create_invitation").toBe(false);
});

test("security headers and no admin secrets in client bundles", async ({ page, request }) => {
  const res = await request.get("/");
  const hdr = res.headers();
  expect(hdr["x-powered-by"]).toBeUndefined();
  expect(hdr["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(hdr["x-frame-options"]).toBe("DENY");
  expect(hdr["x-content-type-options"]).toBe("nosniff");
  expect(hdr["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(hdr["permissions-policy"]).toContain("camera=()");
  await page.goto("/");
  const scripts = await page.locator("script[src]").evaluateAll((s) => s.map((x) => (x as HTMLScriptElement).src));
  const secret = process.env.INSFORGE_API_KEY!;
  const openai = process.env.OPENAI_API_KEY?.slice(0, 24);
  for (const src of scripts) {
    const body = await (await request.get(src)).text();
    expect(body.includes(secret), `admin key in ${src}`).toBe(false);
    if (openai) expect(body.includes(openai), `OpenAI key in ${src}`).toBe(false);
  }
});
