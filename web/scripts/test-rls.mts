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

// ── Phase 5: contribution lifecycle, consents, notifications, client sandboxes ──
{
  const a = p["acme-admin"], po = p.po, mod = p.moderator, mem = p["acme-member"], bor = p["borealis-admin"];
  const { data: offRows } = await admin.from("offerings").select("id, slug");
  const off = Object.fromEntries((offRows ?? []).map((o: { slug: string; id: string }) => [o.slug, o.id]));
  type C = { id: string; state: string; version: number; visibility_choice: string; title: string; pii_flags: string[] };
  const cur = async (id: string) => (await admin.from("contributions").select("id, state, version, visibility_choice, title, pii_flags").eq("id", id).single()).data as C;
  // the database refused if the row is unchanged afterwards (error or zero rows, either way)
  const unchanged = async (q: PromiseLike<unknown>, id: string, field: keyof C, expected: unknown) => {
    await q;
    const v = (await cur(id))[field];
    return v === expected ? true : `${String(field)} became ${String(v)}`;
  };
  if (a) {
    const base = { org_id: org["acme-bank"], type: "observation", title: `${TAG} SME demand`, body: "SME working-capital demand rose noticeably this quarter.", evidence_type: "anecdotal", confidence: "med" };
    const mk = async (extra: Record<string, unknown> = {}) =>
      (await a.db.from("contributions").insert([{ ...base, ...extra }]).select("id").single()).data as { id: string } | null;
    const set = (db: Db, id: string, patch: Record<string, unknown>) => db.from("contributions").update(patch).eq("id", id);
    const consent = (id: string, c: Record<string, boolean>) =>
      a.db.from("consents").insert([{ contribution_id: id, store: false, publish: false, attribute: false, train: false, ...c }]);

    const draft = await mk({ body: "Ask the relationship manager at rm.lead@acme.example about SME demand." });
    await check("acme-admin", "creates a private draft", async () => (draft ? true : "insert failed"));
    await check("acme-admin", "cannot create a contribution in another org", () =>
      failsWrite(a.db.from("contributions").insert([{ ...base, org_id: org["borealis-finance"] }])));
    await check("acme-admin", "cannot insert straight into review", () =>
      failsWrite(a.db.from("contributions").insert([{ ...base, state: "submitted" }])));
    if (draft) {
      await check("db", "PII scan flags an email address", async () => ((await cur(draft.id)).pii_flags.includes("email") ? true : "not flagged"));
      if (po) await check("po", "cannot see another org's draft", () => denied(po.db.from("contributions").select("id").eq("id", draft.id)));
      if (mod) await check("moderator", "never sees drafts", () => denied(mod.db.from("contributions").select("id").eq("id", draft.id)));
      if (mem) await check("acme-member", "cannot see a colleague's draft", () => denied(mem.db.from("contributions").select("id").eq("id", draft.id)));
      await check("acme-admin", "private note cannot be shared", () => unchanged(set(a.db, draft.id, { state: "published" }), draft.id, "state", "draft"));
      await check("acme-admin", "discards own draft", async () => {
        await a.db.from("contributions").delete().eq("id", draft.id);
        return (await admin.from("contributions").select("id").eq("id", draft.id)).data?.length ? "still there" : true;
      });
    }

    const orgItem = await mk({ visibility_choice: "org" });
    if (orgItem) {
      await set(a.db, orgItem.id, { state: "published" });
      await check("acme-admin", "shares with own org (no moderation)", async () => ((await cur(orgItem.id)).state === "published" ? true : "not shared"));
      if (mem) await check("acme-member", "sees an org-shared observation", async () => ((await rows(mem.db.from("contributions").select("id").eq("id", orgItem.id)))?.length ? true : "missing"));
      if (bor) await check("borealis-admin", "cannot see Acme's org-shared item", () => denied(bor.db.from("contributions").select("id").eq("id", orgItem.id)));
      if (mod) await check("moderator", "cannot see org-only items", () => denied(mod.db.from("contributions").select("id").eq("id", orgItem.id)));
      await check("acme-admin", "cannot widen an org item's audience", () =>
        unchanged(set(a.db, orgItem.id, { visibility_choice: "propose_shared" }), orgItem.id, "visibility_choice", "org"));
      await check("acme-admin", "cannot delete a shared item (withdraw instead)", async () => {
        await a.db.from("contributions").delete().eq("id", orgItem.id);
        return (await admin.from("contributions").select("id").eq("id", orgItem.id)).data?.length ? true : "deleted";
      });
      await set(a.db, orgItem.id, { body: "SME working-capital demand rose sharply this quarter, led by trade finance." });
      await check("acme-admin", "editing an org item creates a new version", async () => {
        const c = await cur(orgItem.id);
        return c.version === 2 && c.state === "published" ? true : `v${c.version} ${c.state}`;
      });
    }

    const prop = await mk({ visibility_choice: "propose_shared" });
    if (prop) {
      await check("acme-admin", "submit without consent is rejected", () => unchanged(set(a.db, prop.id, { state: "submitted" }), prop.id, "state", "draft"));
      await consent(prop.id, { store: true });
      await check("acme-admin", "submit with store-only consent is rejected", () => unchanged(set(a.db, prop.id, { state: "submitted" }), prop.id, "state", "draft"));
      await consent(prop.id, { store: true, publish: true });
      await set(a.db, prop.id, { state: "submitted" });
      await check("acme-admin", "submits with store + publish consent", async () => ((await cur(prop.id)).state === "submitted" ? true : "not submitted"));
      await check("acme-admin", "consents lock once in review", () => failsWrite(consent(prop.id, { store: true })));
      await check("acme-admin", "consent history cannot be rewritten", async () =>
        (await a.db.from("consents").update({ publish: false }).eq("contribution_id", prop.id)).error &&
        (await a.db.from("consents").delete().eq("contribution_id", prop.id)).error ? true : "consent mutated");
      await check("acme-admin", "cannot publish own submission", () => unchanged(set(a.db, prop.id, { state: "published" }), prop.id, "state", "submitted"));
      await check("acme-admin", "cannot change audience after submit", () =>
        unchanged(set(a.db, prop.id, { visibility_choice: "org" }), prop.id, "visibility_choice", "propose_shared"));
      if (po) await check("po", "non-moderator employee cannot see submissions", () => denied(po.db.from("contributions").select("id").eq("id", prop.id)));
      if (mod) {
        await check("moderator", "sees an item in review", async () => ((await rows(mod.db.from("contributions").select("id").eq("id", prop.id)))?.length ? true : "missing"));
        await check("moderator", "cannot edit the author's content", () => unchanged(set(mod.db, prop.id, { title: `${TAG} hijacked` }), prop.id, "title", base.title));
        await check("moderator", "return without a reason is rejected", () => unchanged(set(mod.db, prop.id, { state: "returned" }), prop.id, "state", "submitted"));
        await set(mod.db, prop.id, { state: "returned", moderator_reason: "Please add the region and period." });
        await check("moderator", "returns with a reason", async () => ((await cur(prop.id)).state === "returned" ? true : "not returned"));
        await set(a.db, prop.id, { region: "GCC", body: "SME working-capital demand in the GCC rose noticeably in Q3." });
        await check("acme-admin", "material edit → new version back in review", async () => {
          const c = await cur(prop.id);
          const v = (await rows(a.db.from("contribution_versions").select("version").eq("contribution_id", prop.id))) ?? [];
          return c.version === 2 && c.state === "submitted" && v.length === 1 ? true : `v${c.version} ${c.state}, ${v.length} snapshot(s)`;
        });
        await check("moderator", "was notified of the pending review", async () =>
          ((await rows(mod.db.from("notifications").select("id").eq("kind", "review.pending").eq("payload->>contribution_id", prop.id)))?.length ? true : "no notification"));
      }
      await check("acme-admin", "notified of every state change (submit, return, amend)", async () => {
        const n = (await rows(a.db.from("notifications").select("kind").eq("payload->>contribution_id", prop.id))) ?? [];
        return n.length >= (mod ? 3 : 1) ? true : `${n.length} notification(s)`;
      });
      if (po) await check("po", "cannot read someone else's notifications", () => denied(po.db.from("notifications").select("id").eq("payload->>contribution_id", prop.id)));
      await set(a.db, prop.id, { state: "withdrawn" });
      await check("acme-admin", "withdraws", async () => ((await cur(prop.id)).state === "withdrawn" ? true : "not withdrawn"));
      await check("acme-admin", "withdrawn is final", () => unchanged(set(a.db, prop.id, { state: "submitted" }), prop.id, "state", "withdrawn"));
      if (mod) await check("moderator", "cannot see withdrawn items", () => denied(mod.db.from("contributions").select("id").eq("id", prop.id)));
    }

    // client sandboxes: own org, entitled offerings only, runs private to the user
    const run = (o: string, offering: string) =>
      a.db.from("playground_runs").insert([{ org_id: org[o], offering_id: off[offering], scenario_key: "rls-test", mode: "deterministic", inputs: {}, output: {} }]).select("id").single();
    const ok = await run("acme-bank", "sme-credit-decisioning");
    const rid = (ok.data as { id: string } | null)?.id;
    await check("acme-admin", "runs an entitled sandbox", async () => (rid ? true : `insert failed: ${ok.error?.message}`));
    await check("acme-admin", "cannot run a non-entitled offering", () => failsWrite(run("acme-bank", "riva")));
    await check("acme-admin", "cannot run in another org's sandbox", () => failsWrite(run("borealis-finance", "sme-credit-decisioning")));
    if (rid && mem) await check("acme-member", "cannot see a colleague's sandbox runs", () => denied(mem.db.from("playground_runs").select("id").eq("id", rid)));
    if (rid && po) await check("po", "cannot see a client's sandbox runs", () => denied(po.db.from("playground_runs").select("id").eq("id", rid)));
  }
  await admin.from("notifications").delete().like("payload->>title", `${TAG}%`);
  await admin.from("contributions").delete().like("title", `${TAG}%`);
  await admin.from("playground_runs").delete().eq("scenario_key", "rls-test");
}

// ── Phase 6: moderation, shared copies, reports, themes, ideas ───────────
{
  const a = p["acme-admin"], po = p.po, mod = p.moderator, pub = p.publisher;
  const state = async (id: string) => ((await admin.from("contributions").select("state").eq("id", id).single()).data as { state: string }).state;
  const sharedOf = async (id: string) => (await admin.from("shared_contributions").select("id, status").eq("source_id", id).maybeSingle()).data as { id: string; status: string } | null;
  if (a && mod) {
    const { data: c } = await a.db.from("contributions").insert([{
      org_id: org["acme-bank"], type: "observation", title: `${TAG} Q1 dip at Acme Bank`, visibility_choice: "propose_shared",
      body: "Our SME clients at Acme Bank show a Q1 inflow dip every year that peers misread.", evidence_type: "client_feedback", confidence: "med",
    }]).select("id").single();
    const id = (c as { id: string }).id;
    await a.db.from("consents").insert([{ contribution_id: id, store: true, publish: true, attribute: false, train: false }]);
    await a.db.from("contributions").update({ state: "submitted" }).eq("id", id);

    await check("moderator", "cannot publish by raw update (no reviewed copy)", async () => {
      await mod.db.from("contributions").update({ state: "published" }).eq("id", id);
      return (await state(id)) === "submitted" ? true : "published without a shared copy";
    });
    if (po) await check("po", "cannot publish (no moderate grant)", async () =>
      (await po.db.rpc("moderate_publish", { p_id: id, p_title: "x title", p_body: "x".repeat(30), p_industry: "", p_region: "" })).error ? true : "published");
    const pubRes = await mod.db.rpc("moderate_publish", {
      p_id: id, p_title: `${TAG} Q1 inflow dip misread by peers`, p_body: "SME clients show a recurring Q1 inflow dip that peer comparisons misread.",
      p_industry: "Retail banking", p_region: "",
    });
    const sid = pubRes.data as string | null;
    await check("moderator", "publishes a redacted shared copy", async () => (sid && (await state(id)) === "published" ? true : `rpc: ${pubRes.error?.message}`));
    if (sid) {
      await check("acme-admin", "shared copy holds reviewed fields only", async () => {
        const r = ((await rows(a.db.from("shared_contributions").select("title, body, attributed_org_name").eq("id", sid))) ?? [])[0] as { title: string; body: string; attributed_org_name: string | null } | undefined;
        if (!r) return "missing";
        return !r.title.includes("Acme") && !r.body.includes("Acme") && r.attributed_org_name === null ? true : "identifying data leaked";
      });
      await check("acme-admin", "cannot read source_id / select * on shared copies", async () =>
        (await a.db.from("shared_contributions").select("source_id").eq("id", sid)).error && (await a.db.from("shared_contributions").select("*").eq("id", sid)).error ? true : "source reachable");
      await check("db", "shared table has no tenant or author columns", async () => {
        const { data } = await admin.from("shared_contributions").select("*").eq("id", sid).single();
        return ["org_id", "author_id", "moderator_reason", "pii_flags"].some((k) => k in (data as object)) ? "tenant column present" : true;
      });
      if (po) {
        await check("po", "sees the shared copy", async () => ((await rows(po.db.from("shared_contributions").select("id").eq("id", sid)))?.length ? true : "missing"));
        await check("po", "still cannot see the source", () => denied(po.db.from("contributions").select("id").eq("id", id)));
      }

      const rep = await a.db.from("reports").insert([{ shared_id: sid, reason: `${TAG} test report` }]).select("id").single();
      const rid = (rep.data as { id: string } | null)?.id;
      await check("acme-admin", "reports a shared copy", async () => (rid ? true : `report failed: ${rep.error?.message}`));
      await check("acme-admin", "cannot file a duplicate open report", () => failsWrite(a.db.from("reports").insert([{ shared_id: sid, reason: `${TAG} again` }])));
      await check("acme-admin", "cannot decide own report", async () => {
        await a.db.from("reports").update({ status: "dismissed" }).eq("id", rid!);
        return ((await admin.from("reports").select("status").eq("id", rid!).single()).data as { status: string }).status === "open" ? true : "decided";
      });
      if (po) await check("po", "cannot read others' reports", () => denied(po.db.from("reports").select("id").eq("id", rid!)));
      await check("moderator", "sees the report and was notified", async () =>
        (await rows(mod.db.from("reports").select("id").eq("id", rid!)))?.length && (await rows(mod.db.from("notifications").select("id").eq("kind", "report.open").eq("payload->>report_id", rid!)))?.length ? true : "missing");
      await mod.db.from("contributions").update({ state: "unpublished" }).eq("id", id);
      await check("acme-admin", "unpublished copy disappears from the feed", () => denied(a.db.from("shared_contributions").select("id").eq("id", sid)));
      await check("moderator", "still sees the hidden copy", async () => ((await rows(mod.db.from("shared_contributions").select("id").eq("id", sid)))?.length ? true : "missing"));
      await mod.db.from("reports").update({ status: "dismissed", decision_note: "Not identifying" }).eq("id", rid!);
      await mod.db.from("contributions").update({ state: "published" }).eq("id", id);
      await check("moderator", "dismiss + restore puts it back", async () => ((await sharedOf(id))?.status === "live" ? true : "not live"));
      await check("acme-admin", "notified of the report decision", async () =>
        ((await rows(a.db.from("notifications").select("id").eq("kind", "report.decided").eq("payload->>report_id", rid!)))?.length ? true : "no notification"));

      // themes: k-anonymous counts, one org counts once
      const { data: seeded } = await admin.from("themes").select("id").eq("name", "Seasonality context").maybeSingle();
      const stat = async (db: Db, theme: string) => (((await db.rpc("theme_stats")).data ?? []) as { theme_id: string; evidence_count: number; org_count: number | null }[]).find((s) => s.theme_id === theme);
      if (seeded) {
        const tid = (seeded as { id: string }).id;
        await check("acme-admin", "seeded theme shows 3 organisations", async () => ((await stat(a.db, tid))?.org_count === 3 ? true : `got ${(await stat(a.db, tid))?.org_count}`));
        if (po) {
          await po.db.from("theme_links").insert([{ theme_id: tid, shared_id: sid }]);
          await check("po", "a second post from one org counts once", async () => {
            const s = await stat(po.db, tid);
            return s?.evidence_count === 4 && s.org_count === 3 ? true : `evidence ${s?.evidence_count}, orgs ${s?.org_count}`;
          });
          await po.db.from("theme_links").delete().eq("theme_id", tid).eq("shared_id", sid);
        }
      }
      if (po) {
        const { data: th } = await po.db.from("themes").insert([{ name: `${TAG} draft theme`, summary: "A draft theme for testing.", status: "draft" }]).select("id").single();
        const tid = (th as { id: string } | null)?.id;
        await check("po", "creates a theme", async () => (tid ? true : "insert failed"));
        if (tid) {
          await po.db.from("theme_links").insert([{ theme_id: tid, shared_id: sid }]);
          await check("po", "one org is suppressed (below k=3)", async () => ((await stat(po.db, tid))?.org_count === null ? true : "count exposed"));
          await check("acme-admin", "cannot see draft themes", () => denied(a.db.from("themes").select("id").eq("id", tid)));
        }
        await check("acme-admin", "cannot create themes", () => failsWrite(a.db.from("themes").insert([{ name: `${TAG} client theme`, summary: "Should not be allowed." }])));

        // ideas
        const { data: idea } = await po.db.from("ideas").insert([{ title: `${TAG} idea`, problem: "Internal problem statement.", priority: "high", status: "proposed" }]).select("id").single();
        const iid = (idea as { id: string } | null)?.id;
        await check("po", "creates an idea", async () => (iid ? true : "insert failed"));
        if (pub) await check("publisher", "cannot create ideas (no product_owner)", () => failsWrite(pub.db.from("ideas").insert([{ title: `${TAG} pub idea`, problem: "Should not be allowed." }])));
        await check("acme-admin", "cannot create ideas", () => failsWrite(a.db.from("ideas").insert([{ title: `${TAG} client idea`, problem: "Should not be allowed." }])));
        if (iid) {
          await po.db.from("idea_evidence").insert([{ idea_id: iid, shared_id: sid }]);
          const mine = async () => (((await a.db.rpc("client_ideas")).data ?? []) as Record<string, unknown>[]).find((r) => r.id === iid);
          await check("acme-admin", "cannot read the ideas table", () => denied(a.db.from("ideas").select("id").eq("id", iid)));
          await check("acme-admin", "internal ideas are hidden", async () => (!(await mine()) ? true : "visible"));
          await po.db.from("ideas").update({ client_visible: true, status: "under_review", public_update: "Assessing seasonal comparisons." }).eq("id", iid);
          await check("acme-admin", "sees a client-visible idea without internal fields", async () => {
            const r = await mine();
            return r && !("priority" in r) && !("problem" in r) && r.status === "under_review" ? true : `got ${JSON.stringify(r)}`;
          });
          await check("po", "status changes are recorded", async () => ((await rows(po.db.from("idea_status_history").select("id").eq("idea_id", iid)))?.length === 2 ? true : "history missing"));
          await check("po", "status history is append-only", async () => ((await po.db.from("idea_status_history").delete().eq("idea_id", iid)).error ? true : (await rows(po.db.from("idea_status_history").select("id").eq("idea_id", iid)))?.length === 2 || "deleted"));
          await check("acme-admin", "contributor notified of the idea update", async () =>
            ((await rows(a.db.from("notifications").select("payload").eq("kind", "idea.update").eq("payload->>idea_id", iid)))?.length ? true : "no notification"));
        }

        // withdraw → purged from feed, themes and idea evidence immediately
        await a.db.from("contributions").update({ state: "withdrawn" }).eq("id", id);
        await check("acme-admin", "withdraw purges the shared copy, theme links and idea evidence", async () => {
          const gone = !(await sharedOf(id));
          const links = (await admin.from("theme_links").select("theme_id").eq("shared_id", sid)).data?.length ?? 0;
          const ev = (await admin.from("idea_evidence").select("idea_id").eq("shared_id", sid)).data?.length ?? 0;
          return gone && !links && !ev ? true : `shared ${gone ? "gone" : "present"}, ${links} theme link(s), ${ev} evidence`;
        });
        await admin.from("ideas").delete().like("title", `${TAG}%`);
        await admin.from("themes").delete().like("name", `${TAG}%`);
      }
    }
    await admin.from("reports").delete().like("reason", `${TAG}%`);
    await admin.from("notifications").delete().eq("kind", "idea.update").like("payload->>title", `${TAG}%`);
    await admin.from("contributions").delete().eq("id", id);
  }
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
