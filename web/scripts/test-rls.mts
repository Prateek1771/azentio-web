// RLS test matrix — runs real requests through the InsForge API as each persona, so it tests exactly
// what production enforces. Anonymous checks always run; persona checks need verified demo accounts
// (npm run demo:create / demo:verify). Run: npm run test:rls
import { createAdminClient, createClient } from "@insforge/sdk";

const baseUrl = process.env.NEXT_PUBLIC_INSFORGE_URL!;
const anonKey = process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY!;
const admin = createAdminClient({ baseUrl, apiKey: process.env.INSFORGE_API_KEY! }).database;
const INBOX = process.env.DEMO_INBOX ?? "hitliprateek5@gmail.com";
const persona = (a: string) => INBOX.replace("@", `+${a}@`).toLowerCase();
const envKey = (a: string) => `DEMO_PASSWORD_${a.replace(/-/g, "_").toUpperCase()}`;
const TAG = `rls-test-${Date.now()}`;

type Db = ReturnType<typeof createClient>["database"];
const results: { who: string; check: string; ok: boolean; note?: string }[] = [];

async function check(who: string, name: string, fn: () => Promise<boolean | string>) {
  try {
    const r = await fn();
    results.push({ who, check: name, ok: r === true, note: typeof r === "string" ? r : undefined });
  } catch (e) {
    results.push({ who, check: name, ok: false, note: (e as Error).message });
  }
}
// "denied" = an error, or no rows came back
const rows = async (q: PromiseLike<{ data: unknown; error: unknown }>) => {
  const { data, error } = await q;
  return error ? null : ((data as unknown[]) ?? []);
};
const denied = async (q: PromiseLike<{ data: unknown; error: unknown }>) => {
  const r = await rows(q);
  return r === null || r.length === 0 ? true : `expected denial, got ${r.length} row(s)`;
};
const failsWrite = async (q: PromiseLike<{ error: unknown }>) => ((await q).error ? true : "write unexpectedly succeeded");
const slugs = (r: unknown[] | null) => new Set((r ?? []).map((x) => (x as { slug: string }).slug).filter(Boolean));

async function signIn(alias: string): Promise<{ db: Db; uid: string } | null> {
  const password = process.env[envKey(alias)];
  if (!password) return null;
  const c = createClient({ baseUrl, anonKey });
  const { data, error } = await c.auth.signInWithPassword({ email: persona(alias), password });
  if (error || !data?.accessToken) return null;
  const authed = createClient({ baseUrl, anonKey, accessToken: data.accessToken } as never);
  await authed.database.rpc("claim_provisioned_access");
  return { db: authed.database, uid: data.user.id };
}

const { data: orgRows } = await admin.from("orgs").select("id, slug");
const org = Object.fromEntries((orgRows ?? []).map((o: { slug: string; id: string }) => [o.slug, o.id]));

// ── anonymous visitor ────────────────────────────────────────────────────
const anonDb = createClient({ baseUrl, anonKey }).database;
await check("anon", "sees only published public content", async () => {
  const s = slugs(await rows(anonDb.from("content").select("slug").like("slug", "seed-%")));
  return s.size === 1 && s.has("seed-public-insight") ? true : `saw ${[...s].join(", ")}`;
});
await check("anon", "cannot list organisations", () => denied(anonDb.from("orgs").select("id")));
await check("anon", "reads the public catalogue", async () => ((await rows(anonDb.from("offerings").select("slug")))?.length === 8 ? true : "catalogue size ≠ 8"));
await check("anon", "cannot write forms directly (server action only)", () =>
  failsWrite(anonDb.from("demo_requests").insert([{ interest: "demo", name: TAG, email: `${TAG}@example.com` }])));
await admin.from("demo_requests").insert([{ interest: "demo", name: TAG, email: `${TAG}@example.com` }]); // fixture for admin read check
await check("anon", "cannot read demo requests", () => denied(anonDb.from("demo_requests").select("id")));
await check("anon", "cannot read audit log", () => denied(anonDb.from("audit_log").select("id")));
await check("anon", "cannot read guardrail rules", () => denied(anonDb.from("guardrail_rules").select("key")));
await check("anon", "cannot read provisioning", () => denied(anonDb.from("provisioned_access").select("email")));
await check("anon", "cannot claim access", async () => ((await anonDb.rpc("claim_provisioned_access")).error ? true : "anon claim succeeded"));

// ── personas (skipped until demo accounts are verified) ─────────────────
const p = Object.fromEntries(
  await Promise.all(["admin", "moderator", "publisher", "po", "acme-admin", "borealis-admin", "acme-member"].map(async (a) => [a, await signIn(a)] as const)),
);
const skipped = Object.entries(p).filter(([, v]) => !v).map(([k]) => k);

const acme = p["acme-admin"];
if (acme) {
  await check("acme-admin", "sees only own org", async () => {
    const r = (await rows(acme.db.from("orgs").select("slug"))) ?? [];
    return slugs(r).size === 1 && slugs(r).has("acme-bank") ? true : `saw ${[...slugs(r)].join(", ")}`;
  });
  await check("acme-admin", "content = public + entitled + own private only", async () => {
    const s = slugs(await rows(acme.db.from("content").select("slug").like("slug", "seed-%")));
    const want = ["seed-public-insight", "seed-entitled-briefing", "seed-acme-private"];
    return s.size === want.length && want.every((w) => s.has(w)) ? true : `saw ${[...s].join(", ")}`;
  });
  await check("acme-admin", "cannot self-grant moderate", () => failsWrite(acme.db.from("grants").insert([{ user_id: acme.uid, kind: "moderate" }])));
  await check("acme-admin", "cannot self-enable a product", async () => {
    const { data } = await admin.from("offerings").select("id").eq("slug", "riva").single();
    return failsWrite(acme.db.from("entitlements").insert([{ org_id: org["acme-bank"], offering_id: (data as { id: string }).id }]));
  });
  await check("acme-admin", "cannot escalate a member to employee", async () => {
    const m = await rows(acme.db.from("memberships").select("id").eq("org_id", org["acme-bank"]).neq("user_id", acme.uid));
    if (!m?.length) return true; // no other member bound yet — nothing to escalate
    const { data, error } = await acme.db.from("memberships").update({ role: "employee" }).eq("id", (m[0] as { id: string }).id).select();
    return error || !(data as unknown[])?.length ? true : "escalation succeeded";
  });
  const rpcFails = async (q: PromiseLike<{ error: unknown }>) => ((await q).error ? true : "rpc unexpectedly succeeded");
  await check("acme-admin", "cannot write invitations directly (RPC only)", () =>
    failsWrite(acme.db.from("invitations").insert([{ org_id: org["acme-bank"], email: `${TAG}@example.com`, role: "client_member", token_hash: `${TAG}-x`, expires_at: new Date(Date.now() + 864e5).toISOString(), invited_by: acme.uid }])));
  await check("acme-admin", "cannot invite into another org", () =>
    rpcFails(acme.db.rpc("create_invitation", { p_org: org["borealis-finance"], p_email: `${TAG}@example.com`, p_role: "client_member" })));
  await check("acme-admin", "cannot invite with a platform role", () =>
    rpcFails(acme.db.rpc("create_invitation", { p_org: org["acme-bank"], p_email: `${TAG}@example.com`, p_role: "employee" })));

  // Invitation lifecycle with real accounts: create → accept once → reuse fails; wrong account; expired.
  const po = p.po, moderator = p.moderator;
  if (po && moderator) {
    const create = async (email: string) => {
      const { data, error } = await acme.db.rpc("create_invitation", { p_org: org["acme-bank"], p_email: email, p_role: "client_member" });
      if (error) throw new Error(error.message);
      return data as string;
    };
    const accept = async (who: Db, token: string) => ((await who.rpc("accept_invitation", { p_token: token })).data ?? {}) as { ok?: boolean; reason?: string; org_slug?: string };
    const tokPo = await create(persona("po"));
    await check("invitations", "token is returned once and only its hash is stored", async () => {
      const { data } = await admin.from("invitations").select("token_hash").eq("email", persona("po")).is("used_at", null);
      return (data ?? []).every((r: { token_hash: string }) => r.token_hash !== tokPo && r.token_hash.length === 64) ? true : "raw token stored";
    });
    await check("invitations", "wrong account cannot accept", async () => ((await accept(moderator.db, tokPo)).reason === "wrong_account" ? true : "accepted by wrong account"));
    await check("invitations", "invited account accepts once", async () => {
      const r = await accept(po.db, tokPo);
      return r.ok && r.org_slug === "acme-bank" ? true : `got ${JSON.stringify(r)}`;
    });
    await check("invitations", "accepted invite grants membership", async () =>
      ((await rows(po.db.from("memberships").select("org_id").eq("org_id", org["acme-bank"])))?.length ? true : "no membership"));
    await check("invitations", "re-using a token fails", async () => ((await accept(po.db, tokPo)).reason === "invalid_or_expired" ? true : "token reused"));
    const tokExp = await create(`${TAG}-exp@example.com`);
    await admin.from("invitations").update({ expires_at: new Date(Date.now() - 1000).toISOString() }).eq("email", `${TAG}-exp@example.com`);
    await check("invitations", "expired token fails", async () => ((await accept(po.db, tokExp)).reason === "invalid_or_expired" ? true : "expired accepted"));
    await check("invitations", "a garbage token fails", async () => ((await accept(po.db, "not-a-token")).reason === "invalid_or_expired" ? true : "garbage accepted"));
    await check("invitations", "already-a-member is rejected", () => rpcFails(acme.db.rpc("create_invitation", { p_org: org["acme-bank"], p_email: persona("po"), p_role: "client_member" })));
    // cleanup: remove the test membership and invitations
    await admin.from("memberships").delete().eq("user_id", po.uid).eq("org_id", org["acme-bank"]);
    await admin.from("invitations").delete().in("email", [persona("po"), `${TAG}-exp@example.com`]);
  }
  await check("acme-admin", "cannot read audit log", () => denied(acme.db.from("audit_log").select("id")));
}

const bor = p["borealis-admin"];
if (bor) {
  await check("borealis-admin", "cannot see Acme private content", async () => (slugs(await rows(bor.db.from("content").select("slug"))).has("seed-acme-private") ? "LEAK" : true));
  await check("borealis-admin", "cannot see Acme memberships", () => denied(bor.db.from("memberships").select("id").eq("org_id", org["acme-bank"])));
  await check("borealis-admin", "cannot see Acme invitations", () => denied(bor.db.from("invitations").select("id").eq("org_id", org["acme-bank"])));
}

const mem = p["acme-member"];
if (mem) {
  await check("acme-member", "sees only own membership", async () => {
    const r = (await rows(mem.db.from("memberships").select("user_id"))) ?? [];
    return r.every((x) => (x as { user_id: string }).user_id === mem.uid) ? true : "saw other members";
  });
  await check("acme-member", "cannot invite", async () =>
    ((await mem.db.rpc("create_invitation", { p_org: org["acme-bank"], p_email: `${TAG}@example.com`, p_role: "client_member" })).error ? true : "member invited"));
  await check("acme-member", "cannot see employee content", async () => (slugs(await rows(mem.db.from("content").select("slug"))).has("seed-employee-release") ? "LEAK" : true));
}

for (const who of ["po", "moderator"] as const) {
  const e = p[who];
  if (!e) continue;
  await check(who, "sees employee content", async () => (slugs(await rows(e.db.from("content").select("slug"))).has("seed-employee-release") ? true : "missing"));
  await check(who, "cannot see a client's private content", async () => (slugs(await rows(e.db.from("content").select("slug"))).has("seed-acme-private") ? "LEAK" : true));
  await check(who, "cannot write grants", () => failsWrite(e.db.from("grants").insert([{ user_id: e.uid, kind: "portal_admin" }])));
  await check(who, "cannot list client orgs", async () => (slugs(await rows(e.db.from("orgs").select("slug"))).has("acme-bank") ? "LEAK" : true));
}

const pub = p.publisher;
if (pub) {
  await check("publisher", "sees unpublished drafts", async () => (slugs(await rows(pub.db.from("content").select("slug"))).has("seed-public-draft") ? true : "missing"));
  await check("publisher", "can create public content", async () =>
    (await pub.db.from("content").insert([{ slug: TAG, kind: "banner", audience: "public", title: "RLS test banner" }])).error ? "insert failed" : true);
  await check("publisher", "cannot create org-private content", () =>
    failsWrite(pub.db.from("content").insert([{ slug: `${TAG}-p`, kind: "library", audience: "org_private", org_id: org["acme-bank"], title: "x" }])));
  await check("publisher", "cannot read demo requests", () => denied(pub.db.from("demo_requests").select("id")));
}

const adm = p.admin;
if (adm) {
  await check("admin", "sees all orgs", async () => ((await rows(adm.db.from("orgs").select("id")))?.length === 4 ? true : "≠ 4 orgs"));
  await check("admin", "reads the audit log", async () => (((await rows(adm.db.from("audit_log").select("id").limit(1))) ?? []).length ? true : "empty"));
  await check("admin", "reads demo requests", async () => (((await rows(adm.db.from("demo_requests").select("id").eq("name", TAG))) ?? []).length ? true : "missing"));
  await check("admin", "cannot edit audit history", async () => {
    const { data, error } = await adm.db.from("audit_log").update({ action: "tampered" }).gt("id", 0).select();
    return error || !(data as unknown[])?.length ? true : "audit row edited";
  });
  if (acme) await check("admin", "cannot give a platform grant to a client user", () => failsWrite(adm.db.from("grants").insert([{ user_id: acme.uid, kind: "moderate" }])));
}

// ── Phase 4: live sessions, media, playground ────────────────────────────
{
  const po = p.po, pub = p.publisher, acmeA = p["acme-admin"], mod = p.moderator;
  const yt = "https://www.youtube.com/embed/dQw4w9WgXcQ";
  if (po) {
    await check("po", "cannot create live sessions (no publish grant)", () =>
      failsWrite(po.db.from("live_sessions").insert([{ title: `${TAG}-x`, audience: "employee", embed_url: yt }])));
    await check("po", "cannot add media", () =>
      failsWrite(po.db.from("media").insert([{ title: `${TAG}-x`, audience: "employee", embed_url: yt }])));
  }
  if (pub) {
    const ins = await pub.db.from("live_sessions").insert([{ title: `${TAG}-emp`, audience: "employee", embed_url: yt }]).select("id").single();
    const sid = (ins.data as { id: string } | null)?.id;
    await check("publisher", "creates an employee-only session", async () => (sid ? true : `insert failed: ${ins.error?.message}`));
    const med = await pub.db.from("media").insert([{ title: `${TAG}-rec`, audience: "employee", embed_url: yt, published: true }]).select("id").single();
    const mid = (med.data as { id: string } | null)?.id;
    await check("publisher", "adds an employee-only recording", async () => (mid ? true : `insert failed: ${med.error?.message}`));
    await check("publisher", "javascript: embed URL is rejected", () =>
      failsWrite(pub.db.from("live_sessions").insert([{ title: `${TAG}-js`, audience: "employee", embed_url: "javascript:alert(1)" }])));
    await check("publisher", "unknown-host embed URL is rejected", () =>
      failsWrite(pub.db.from("media").insert([{ title: `${TAG}-evil`, audience: "employee", embed_url: "https://evil.example/frame" }])));
    if (sid && mid) {
      await check("anon", "cannot see employee-only session or recording", async () =>
        ((await denied(anonDb.from("live_sessions").select("id").eq("id", sid))) === true && (await denied(anonDb.from("media").select("id").eq("id", mid))) === true) || "LEAK");
      if (acmeA) await check("acme-admin", "cannot see employee-only session or recording", async () =>
        ((await denied(acmeA.db.from("live_sessions").select("id").eq("id", sid))) === true && (await denied(acmeA.db.from("media").select("id").eq("id", mid))) === true) || "LEAK");
      if (po) await check("po", "sees employee-only session and recording", async () =>
        ((await rows(po.db.from("live_sessions").select("id").eq("id", sid)))?.length && (await rows(po.db.from("media").select("id").eq("id", mid)))?.length ? true : "missing"));
    }
  }
  const { data: off } = await admin.from("offerings").select("id").eq("slug", "sme-credit-decisioning").single();
  const offId = (off as { id: string }).id;
  const run = { offering_id: offId, scenario_key: "rls-test", mode: "deterministic", inputs: {}, output: { headline: TAG } };
  if (po) {
    const r = await po.db.from("playground_runs").insert([run]).select("id").single();
    const rid = (r.data as { id: string } | null)?.id;
    await check("po", "saves own playground run", async () => (rid ? true : `insert failed: ${r.error?.message}`));
    if (rid) {
      await check("po", "adds feedback to own run", async () =>
        ((await po.db.from("playground_runs").update({ feedback: { useful: true, rating: 4 } }).eq("id", rid)).error ? "feedback failed" : true));
      await check("po", "cannot rewrite a run's output", async () => {
        const { data, error } = await po.db.from("playground_runs").update({ output: { headline: "tampered" } }).eq("id", rid).select();
        return error || !(data as unknown[])?.length ? true : "output rewritten";
      });
      if (mod) await check("moderator", "cannot read another employee's runs", () => denied(mod.db.from("playground_runs").select("id").eq("id", rid)));
    }
  }
  if (acmeA) await check("acme-admin", "cannot use the employee playground", () => failsWrite(acmeA.db.from("playground_runs").insert([run])));
  await admin.from("live_sessions").delete().like("title", `${TAG}%`);
  await admin.from("media").delete().like("title", `${TAG}%`);
  await admin.from("playground_runs").delete().eq("scenario_key", "rls-test");
}

// ── cleanup (admin key) ──────────────────────────────────────────────────
await admin.from("demo_requests").delete().eq("name", TAG);
await admin.from("invitations").delete().like("token_hash", `${TAG}%`);
await admin.from("content").delete().like("slug", `${TAG}%`);

// ── report ───────────────────────────────────────────────────────────────
const failed = results.filter((r) => !r.ok);
for (const r of results) console.log(`${r.ok ? "✓" : "✗"} ${r.who.padEnd(15)} ${r.check}${r.note ? `  — ${r.note}` : ""}`);
console.log(`\n${results.length - failed.length}/${results.length} passed${skipped.length ? `; skipped personas (not verified yet): ${skipped.join(", ")}` : ""}`);
process.exit(failed.length ? 1 : 0);
