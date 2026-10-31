// Idempotent synthetic seed: orgs, offerings, entitlements, persona provisioning, public content,
// baseline AIRA guardrail rules. Run: npm run seed   (uses the server-only admin key from .env.local)
import { createAdminClient } from "@insforge/sdk";
import { products } from "../lib/content.ts";

const baseUrl = process.env.NEXT_PUBLIC_INSFORGE_URL;
const apiKey = process.env.INSFORGE_API_KEY;
if (!baseUrl || !apiKey) throw new Error("NEXT_PUBLIC_INSFORGE_URL and INSFORGE_API_KEY are required");
const db = createAdminClient({ baseUrl, apiKey }).database;

const INBOX = process.env.DEMO_INBOX ?? "hitliprateek5@gmail.com";
export const persona = (alias: string) => INBOX.replace("@", `+${alias}@`).toLowerCase();

async function upsert<T extends object>(table: string, rows: T[], onConflict: string) {
  const { data, error } = await db.from(table).upsert(rows, { onConflict }).select();
  if (error) throw new Error(`${table}: ${error.message}`);
  console.log(`✓ ${table.padEnd(20)} ${rows.length}`);
  return data as (T & { id: string })[];
}

const orgs = await upsert(
  "orgs",
  [
    { slug: "azentio", name: "Azentio", kind: "azentio", industry: "Software", region: "Global" },
    { slug: "acme-bank", name: "Acme Bank", kind: "client", industry: "Retail banking", region: "Middle East" },
    { slug: "borealis-finance", name: "Borealis Finance", kind: "client", industry: "SME lending", region: "Europe" },
    { slug: "cedar-credit", name: "Cedar Credit Union", kind: "client", industry: "Credit union", region: "South Asia" },
  ],
  "slug",
);
const org = Object.fromEntries(orgs.map((o) => [o.slug, o.id])) as Record<string, string>;

const offerings = await upsert(
  "offerings",
  products.map(({ slug, name, category, headline, summary }) => ({ slug, name, category, headline, summary, is_public: true })),
  "slug",
);
const off = Object.fromEntries(offerings.map((o) => [o.slug, o.id])) as Record<string, string>;

// Deliberately different entitlement sets so entitlement checks are meaningful.
const entitlementMap: Record<string, string[]> = {
  "acme-bank": ["credit-strategy-simulator", "sme-credit-decisioning", "financial-analysis"],
  "borealis-finance": ["sme-credit-decisioning", "similar-portfolio-intelligence", "rejection-intelligence", "riva"],
  "cedar-credit": ["document-intelligence", "financial-analysis"],
};
await upsert(
  "entitlements",
  Object.entries(entitlementMap).flatMap(([o, slugs]) => slugs.map((s) => ({ org_id: org[o], offering_id: off[s] }))),
  "org_id,offering_id",
);

// Personas → email-keyed provisioning (bound on first verified sign-in by claim_provisioned_access()).
const staff: [string, string[]][] = [
  ["employee", []],
  ["moderator", ["moderate"]],
  ["po", ["product_owner"]],
  ["publisher", ["publish_media"]],
  ["admin", ["portal_admin", "manage_roles", "invite"]],
];
await upsert("employee_allowlist", staff.map(([a]) => ({ email: persona(a) })), "email");
await upsert(
  "provisioned_access",
  [
    ...staff.map(([a, grants]) => ({ email: persona(a), org_id: org.azentio, role: "employee", grants })),
    ...["acme-bank", "borealis-finance", "cedar-credit"].flatMap((o) => {
      const short = o.split("-")[0];
      return [
        { email: persona(`${short}-admin`), org_id: org[o], role: "client_admin", grants: [] },
        { email: persona(`${short}-member`), org_id: org[o], role: "client_member", grants: [] },
      ];
    }),
    { email: persona("multi"), org_id: org["acme-bank"], role: "client_member", grants: [] },
    { email: persona("multi"), org_id: org["borealis-finance"], role: "client_member", grants: [] },
  ],
  "email,org_id",
);

// Audience-scoped content: one row per audience so RLS tests have something to (not) see.
const { error: delErr } = await db.from("content").delete().like("slug", "seed-%");
if (delErr) throw new Error(`content cleanup: ${delErr.message}`);
await upsert(
  "content",
  [
    { slug: "seed-public-insight", kind: "insight", audience: "public", published: true,
      title: "Evidence and oversight in decision support", body: "How evidence, oversight, and transparent recommendations shape responsible decision support." },
    { slug: "seed-employee-release", kind: "release_note", audience: "employee", published: true,
      title: "Internal: sandbox release notes", body: "Employee-only release notes for the Playground sandbox." },
    { slug: "seed-entitled-briefing", kind: "briefing", audience: "client_entitled", offering_id: off["sme-credit-decisioning"], published: true,
      title: "SME Credit Decisioning briefing", body: "Briefing for organisations entitled to the SME workbench." },
    { slug: "seed-acme-private", kind: "library", audience: "org_private", org_id: org["acme-bank"], published: true,
      title: "Acme Bank workspace resource", body: "Visible to Acme Bank members only." },
    { slug: "seed-public-draft", kind: "insight", audience: "public", published: false,
      title: "Unpublished draft insight", body: "Not yet published; publishers only." },
  ],
  "id",
);

// Baseline AIRA guardrail rules (enforced in Phase 8; editable by portal admins, audited).
await upsert(
  "guardrail_rules",
  [
    { key: "aira_enabled", kind: "flag", stage: "access", pattern: "true", severity: "critical", description: "Kill switch for AIRA" },
    { key: "rate.per_hour", kind: "limit", stage: "access", pattern: "60", severity: "medium", description: "Questions per user per hour" },
    { key: "rate.per_minute", kind: "limit", stage: "access", pattern: "10", severity: "medium", description: "Burst limit per user" },
    { key: "input.max_chars", kind: "limit", stage: "input", pattern: "1000", severity: "low", description: "Question length cap" },
    { key: "inject.ignore_instructions", kind: "regex", stage: "input", severity: "high",
      pattern: "(ignore|disregard|forget)\\s+(all\\s+)?(previous|prior|above|earlier)\\s+(instructions|rules|prompts?)", description: "Instruction override attempt" },
    { key: "inject.system_prompt", kind: "regex", stage: "input", severity: "high",
      pattern: "(system|hidden|initial)\\s+prompt|your\\s+instructions|reveal\\s+(your|the)\\s+(rules|prompt)", description: "System prompt extraction" },
    { key: "inject.roleplay", kind: "regex", stage: "input", severity: "high",
      pattern: "\\b(pretend|act)\\s+(to\\s+be|as)\\b|\\bDAN\\b|developer\\s+mode|jailbreak", description: "Role-play / jailbreak override" },
    { key: "scope.other_tenant", kind: "regex", stage: "input", severity: "high",
      pattern: "(which|what)\\s+(client|bank|organi[sz]ation|customer)s?\\s+(said|submitted|reported|posted)", description: "Attribution / cross-tenant probing" },
    { key: "scope.advice", kind: "regex", stage: "input", severity: "medium",
      pattern: "\\b(approve|decline|reject)\\s+(this|my|the)\\s+(loan|application|credit)|legal\\s+advice|investment\\s+advice", description: "Credit decision or regulated advice" },
    { key: "pii.card", kind: "regex", stage: "input", severity: "critical", pattern: "\\b(?:\\d[ -]?){13,19}\\b", description: "Card-like number" },
    { key: "pii.iban", kind: "regex", stage: "input", severity: "critical", pattern: "\\b[A-Z]{2}\\d{2}[A-Z0-9]{11,30}\\b", description: "IBAN" },
    { key: "pii.email", kind: "regex", stage: "input", severity: "high", pattern: "[\\w.+-]+@[\\w-]+\\.[\\w.]+", description: "Email address" },
    { key: "pii.phone", kind: "regex", stage: "input", severity: "high", pattern: "\\+?\\d[\\d\\s().-]{8,}\\d", description: "Phone number" },
    { key: "out.commitment", kind: "regex", stage: "output", severity: "high",
      pattern: "\\b(will\\s+be\\s+(released|delivered|available|launched)|guarantee[sd]?|committed\\s+to\\s+deliver|by\\s+(q[1-4]|january|february|march|april|may|june|july|august|september|october|november|december))", description: "Roadmap promise / guarantee" },
    { key: "out.prompt_leak", kind: "phrase", stage: "output", severity: "high", pattern: "AIRA_SYSTEM_PROMPT", description: "Canary token from the system prompt" },
    ...orgs.filter((o) => o.kind === "client").map((o) => ({
      key: `out.org_name.${o.slug}`, kind: "org_name", stage: "output", severity: "critical", pattern: o.name,
      description: "Client organisation name must never appear in AIRA output",
    })),
  ],
  "key",
);

// The brief's SME-seasonality scenario as published shared learning (fictional). Authored by the portal
// admin persona as a synthetic system author; skipped until that account exists, and only seeded once.
{
  const { data: author } = await db.from("profiles").select("user_id").eq("email", persona("admin")).maybeSingle();
  const { data: done } = await db.from("themes").select("id").eq("name", "Seasonality context").maybeSingle();
  if (!author) console.log("· seasonality scenario skipped (portal admin account not created yet)");
  else if (done) console.log("· seasonality scenario already seeded");
  else {
    const fa = off["financial-analysis"];
    const items = [
      ["acme-bank", "Seasonal SME inflows misread as distress", "Retail-trade SMEs show sharp Q4 inflow peaks and Q1 troughs. Peer comparisons that ignore the cycle flag healthy firms as deteriorating in Q1.", "Retail banking", "Middle East"],
      ["borealis-finance", "Agricultural borrowers penalised outside harvest months", "Cash-flow ratios for agri SMEs look weak for most of the year and recover at harvest. Annualised views would treat them more consistently.", "SME lending", "Europe"],
      ["cedar-credit", "Tourism SMEs: off-season dips trigger manual reviews", "Members in tourism regions see predictable off-season revenue dips. Analysts ask for seasonality-aware comparisons before referring cases.", "Credit union", "South Asia"],
    ] as const;
    const shared: string[] = [];
    for (const [o, title, body, industry, region] of items) {
      const { data: c, error } = await db.from("contributions").insert([{
        org_id: org[o], author_id: (author as { user_id: string }).user_id, type: "observation", title, body, offering_id: fa,
        industry, region, period_start: "2025-01-01", period_end: "2025-12-31", evidence_type: "client_feedback", confidence: "med",
        visibility_choice: "propose_shared", state: "published",
      }]).select("id").single();
      if (error) throw new Error(`contributions: ${error.message}`);
      const { data: s, error: se } = await db.from("shared_contributions").insert([{
        source_id: (c as { id: string }).id, title, body, type: "observation", offering_id: fa, industry, region,
        period_start: "2025-01-01", period_end: "2025-12-31",
      }]).select("id").single();
      if (se) throw new Error(`shared_contributions: ${se.message}`);
      shared.push((s as { id: string }).id);
      await db.from("shared_org_link").insert([{ shared_id: (s as { id: string }).id, org_id: org[o] }]);
    }
    const { data: t } = await db.from("themes").insert([{
      name: "Seasonality context", status: "confirmed", confidence: "med", offering_ids: [fa],
      summary: "SME cash flow follows predictable seasonal cycles that point-in-time comparisons treat as deterioration.",
      limitations: "Three contributions from three organisations; self-selected and qualitative. An early signal, not market prevalence.",
    }]).select("id").single();
    await db.from("theme_links").insert(shared.map((shared_id) => ({ theme_id: (t as { id: string }).id, shared_id })));
    const { data: i } = await db.from("ideas").insert([{
      title: "Seasonality-aware comparison explanation", offering_id: fa, theme_id: (t as { id: string }).id,
      problem: "Financial Analysis compares SMEs against peers without adjusting for seasonal cycles.",
      proposed_outcome: "Explain when a ratio change is within the borrower's usual seasonal range.",
      owner_team: "Financial Analysis product team", priority: "high", status: "under_review", client_visible: true,
      public_update: "We're assessing how to explain seasonal patterns in peer comparisons. No delivery date yet.",
    }]).select("id").single();
    await db.from("idea_evidence").insert(shared.map((shared_id) => ({ idea_id: (i as { id: string }).id, shared_id })));
    console.log("✓ seasonality scenario     3 shared + theme + idea");
  }
}

// Demo workspace content so every demo login opens onto real data: more shared learning (a second
// confirmed theme, a below-k topic), a moderation queue, client drafts and returns, notifications,
// employee teams, experiments and library guides. All fictional; seeded once (marker row).
{
  const uid = async (alias: string) =>
    ((await db.from("profiles").select("user_id").eq("email", persona(alias)).maybeSingle()).data as { user_id: string } | null)?.user_id;
  const who = Object.fromEntries(
    await Promise.all(["admin", "moderator", "publisher", "po", "acme-admin", "borealis-admin", "cedar-admin"].map(async (a) => [a, await uid(a)] as const)),
  ) as Record<string, string | undefined>;
  const MARK = "Scanned statements force manual re-keying";
  const { data: done } = await db.from("contributions").select("id").eq("title", MARK).maybeSingle();
  if (!who.admin) console.log("· demo workspace skipped (portal admin account not created yet)");
  else if (done) console.log("· demo workspace already seeded");
  else {
    const author = (alias: string) => who[alias] ?? who.admin!;
    type C = { org: string; by: string; type: string; title: string; body: string; offering: string; industry: string; region: string; state: string; visibility: string; reason?: string };
    const contribute = async (c: C) => {
      const { data, error } = await db.from("contributions").insert([{
        org_id: org[c.org], author_id: author(c.by), type: c.type, title: c.title, body: c.body, offering_id: off[c.offering],
        industry: c.industry, region: c.region, period_start: "2025-07-01", period_end: "2026-06-30", evidence_type: "client_feedback",
        confidence: "med", visibility_choice: c.visibility, state: c.state, moderator_reason: c.reason ?? null,
      }]).select("id").single();
      if (error) throw new Error(`contributions: ${error.message}`);
      const id = (data as { id: string }).id;
      if (c.visibility === "propose_shared")
        await db.from("consents").insert([{ contribution_id: id, store: true, publish: true, attribute: false, train: false, actor: author(c.by) }]);
      return id;
    };
    const publish = async (c: Omit<C, "state" | "visibility">) => {
      const id = await contribute({ ...c, state: "published", visibility: "propose_shared" });
      const { data: s, error } = await db.from("shared_contributions").insert([{
        source_id: id, title: c.title, body: c.body, type: c.type, offering_id: off[c.offering], industry: c.industry, region: c.region,
        period_start: "2025-07-01", period_end: "2026-06-30",
      }]).select("id").single();
      if (error) throw new Error(`shared_contributions: ${error.message}`);
      await db.from("shared_org_link").insert([{ shared_id: (s as { id: string }).id, org_id: org[c.org] }]);
      return (s as { id: string }).id;
    };

    // Shared learning: document intake (3 orgs → confirmed theme + planned idea)
    const di = "document-intelligence";
    const docs = [
      await publish({ org: "acme-bank", by: "acme-admin", type: "challenge", title: MARK, offering: di, industry: "Retail banking", region: "Middle East",
        body: "Many SME applicants still send scanned or photographed statements. Analysts re-key balance sheets by hand, which adds about two days per file and introduces typos." }),
      await publish({ org: "borealis-finance", by: "borealis-admin", type: "observation", title: "Multi-year statements arrive as one merged PDF", offering: di, industry: "SME lending", region: "Europe",
        body: "Borrowers combine three years of statements into a single scanned PDF. Splitting periods manually is the slowest step before any ratio analysis can start." }),
      await publish({ org: "cedar-credit", by: "cedar-admin", type: "gap", title: "Handwritten ledgers from micro-enterprises", offering: di, industry: "Credit union", region: "South Asia",
        body: "Micro-enterprise members often keep handwritten ledgers. Staff photograph them and type the totals, so extraction confidence and a review step matter more than speed." }),
    ];
    const { data: t } = await db.from("themes").insert([{
      name: "Manual re-keying of financial statements", status: "confirmed", confidence: "med", offering_ids: [off[di]],
      summary: "Lenders spend significant analyst time re-keying scanned, merged or handwritten statements before analysis can start.",
      limitations: "Three contributions from three organisations; qualitative time estimates. Indicates a common bottleneck, not its size.",
    }]).select("id").single();
    const themeId = (t as { id: string }).id;
    await db.from("theme_links").insert(docs.map((shared_id) => ({ theme_id: themeId, shared_id })));
    const { data: i } = await db.from("ideas").insert([{
      title: "Period detection and confidence review for scanned statements", offering_id: off[di], theme_id: themeId,
      problem: "Scanned and merged statements are re-keyed by hand before analysis.",
      proposed_outcome: "Detect statement periods in merged files and route low-confidence extractions to a quick human review.",
      owner_team: "Document Intelligence product team", priority: "high", status: "planned", client_visible: true,
      public_update: "Planned: automatic period splitting with a review step for low-confidence fields. No delivery date yet.",
    }]).select("id").single();
    await db.from("idea_evidence").insert(docs.map((shared_id) => ({ idea_id: (i as { id: string }).id, shared_id })));

    // Shared learning below k = 3 (2 orgs): visible in the feed, but no organisation count is shown
    const ri = "rejection-intelligence";
    await publish({ org: "borealis-finance", by: "borealis-admin", type: "suggestion", title: "Decline letters need the top two reasons in plain language", offering: ri,
      industry: "SME lending", region: "Europe", body: "Applicants who are declined call back to ask why. A short plain-language list of the main reasons would cut repeat calls and complaints." });
    await publish({ org: "cedar-credit", by: "cedar-admin", type: "practice", title: "Reason codes reviewed monthly cut repeat applications", offering: ri,
      industry: "Credit union", region: "South Asia", body: "Reviewing decline reason codes every month showed which documents applicants were missing. Sharing a checklist reduced incomplete reapplications." });

    // Moderation queue, client drafts and a returned item
    const queued = await contribute({ org: "acme-bank", by: "acme-admin", type: "gap", title: "Bulk statement uploads time out for large SME files", offering: di,
      industry: "Retail banking", region: "Middle East", state: "submitted", visibility: "propose_shared",
      body: "Uploading more than about forty pages at once times out, so staff split files by hand. Larger uploads or background processing would help." });
    await contribute({ org: "cedar-credit", by: "cedar-admin", type: "trend", title: "More SME applicants ask for instant pre-qualification", offering: "sme-credit-decisioning",
      industry: "Credit union", region: "South Asia", state: "submitted", visibility: "propose_shared",
      body: "Since mid-year, more SME members expect an indicative answer within a day. Branches report losing applicants to faster digital lenders." });
    const returned = await contribute({ org: "acme-bank", by: "acme-admin", type: "observation", title: "Branch-level rejection spikes after policy update", offering: ri,
      industry: "Retail banking", region: "Middle East", state: "returned", visibility: "propose_shared",
      reason: "Please remove the branch name and add the period the spike covers before we publish.",
      body: "After the March policy update, one branch saw rejections rise noticeably for sole traders. Other branches did not see the same change." });
    await contribute({ org: "acme-bank", by: "acme-admin", type: "observation", title: "Q1 trough analysis for retail SMEs (draft)", offering: "financial-analysis",
      industry: "Retail banking", region: "Middle East", state: "draft", visibility: "private",
      body: "Working notes: compare Q1 inflows against the same quarter last year rather than Q4, before flagging deterioration." });
    await contribute({ org: "borealis-finance", by: "borealis-admin", type: "challenge", title: "Collateral valuations arrive in inconsistent formats", offering: "sme-credit-decisioning",
      industry: "SME lending", region: "Europe", state: "draft", visibility: "org",
      body: "Valuers send reports as PDFs, spreadsheets or emails, so the credit team retypes key values into the decision workbench." });

    // Notifications so bells aren't empty
    const notify = (alias: string, kind: string, payload: Record<string, unknown>) =>
      who[alias] ? db.from("notifications").insert([{ user_id: who[alias], kind, payload }]) : Promise.resolve();
    await notify("acme-admin", "contribution.return", { org_id: org["acme-bank"], contribution_id: returned, title: "Branch-level rejection spikes after policy update" });
    await notify("acme-admin", "idea.update", { org_id: org["acme-bank"], title: "Period detection and confidence review for scanned statements" });
    await notify("moderator", "contribution.submit", { contribution_id: queued, title: "Bulk statement uploads time out for large SME files" });

    // Employee workspace: teams, experiments, knowledge library
    const team = async (by: string, name: string, kind: string, description: string, members: string[]) => {
      if (!who[by]) return null;
      const { data } = await db.from("teams").insert([{ name, kind, description, created_by: who[by] }]).select("id").single();
      const id = (data as { id: string } | null)?.id ?? null;
      const rows = members.filter((m) => who[m] && m !== by).map((m) => ({ team_id: id, user_id: who[m], role: "member" }));
      if (id && rows.length) await db.from("team_members").insert(rows);
      return id;
    };
    const squad = await team("po", "Credit Intelligence squad", "squad", "Product, analytics and moderation working together on credit products.", ["moderator", "publisher"]);
    await team("publisher", "Hackathon: Team Ledger", "hackathon", "Hackathon team exploring statement extraction for micro-enterprises.", ["po"]);
    const exp = (by: string, e: Record<string, unknown>) => (who[by] ? db.from("experiments").insert([{ ...e, owner_id: who[by] }]) : Promise.resolve());
    await exp("po", { title: "Seasonality-adjusted peer bands", status: "running", offering_id: off["financial-analysis"], team_id: squad,
      hypothesis: "Comparing SMEs against same-quarter peer bands will cut false deterioration flags in Q1 by at least a third.",
      method: "Replay last year's Q1 reviews on synthetic portfolios with and without seasonal bands; count flags that analysts later cleared." });
    await exp("po", { title: "Auto-split merged statement PDFs", status: "completed", offering_id: off[di], team_id: squad,
      hypothesis: "Detecting period headers can split merged multi-year statements without manual work.",
      method: "Run period detection on 50 synthetic merged PDFs.", result: "46 of 50 split correctly; the 4 misses had no visible period header. Next: add a review step." });
    await exp("publisher", { title: "Live session engagement prompts", status: "draft",
      hypothesis: "Two short polls during internal live sessions will double the number of questions asked." });
    const lib = (by: string, slug: string, title: string, body: string) =>
      who[by] ? db.from("content").insert([{ kind: "library", slug, title, body, audience: "employee", owner_id: who[by], published: true, review_date: "2027-04-30" }]) : Promise.resolve();
    await lib("moderator", "demo-lib-deidentify", "How to de-identify an observation",
      "Remove organisation, branch and person names; round figures that could identify a client; keep the pattern, period and region. When unsure, return the item with a clear reason.");
    await lib("po", "demo-lib-playground", "Playground scenario guide",
      "Every playground run uses synthetic data and is labelled simulated. Pick a scenario, adjust inputs, run, then leave structured feedback so the product team can learn from it.");
    console.log("✓ demo workspace           5 shared + theme + idea, queue, drafts, notifications, teams, experiments, library");
  }
}

// Federated learning programme (P2). The demo clients start enrolled once; a withdrawal made in the
// UI survives re-seeding, so enrolments are only created when the programme has none.
const [fl] = await upsert(
  "fl_programs",
  [{
    slug: "sme-cashflow-stress",
    name: "SME cash-flow stress (federated)",
    task: "Predict 90-day cash-flow stress for an SME borrower from 12 months of inflow shape, sector, size and tenure.",
    description: "Each client trains on its own synthetic portfolio; only clipped weight updates reach the coordinator.",
    min_participants: 2,
  }],
  "slug",
);
const { count: enrolled } = await db.from("fl_enrollments").select("org_id", { count: "exact", head: true }).eq("program_id", fl.id);
if (!enrolled) {
  const { error } = await db.from("fl_enrollments").insert(
    ["acme-bank", "borealis-finance", "cedar-credit"].map((s) => ({ program_id: fl.id, org_id: org[s], consent_train: true })),
  );
  if (error) throw new Error(`fl_enrollments: ${error.message}`);
  console.log("✓ fl_enrollments       3");
}

console.log("\nPersonas (sign in with OTP; access binds automatically):");
for (const [a] of staff) console.log(`  staff   ${persona(a)}`);
for (const s of ["acme", "borealis", "cedar"]) console.log(`  client  ${persona(`${s}-admin`)}  ${persona(`${s}-member`)}`);
console.log(`  multi   ${persona("multi")}`);
