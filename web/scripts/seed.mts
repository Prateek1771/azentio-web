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
    { key: "rate.per_hour", kind: "limit", stage: "access", pattern: "20", severity: "medium", description: "Questions per user per hour" },
    { key: "rate.per_minute", kind: "limit", stage: "access", pattern: "5", severity: "medium", description: "Burst limit per user" },
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

console.log("\nPersonas (sign in with OTP; access binds automatically):");
for (const [a] of staff) console.log(`  staff   ${persona(a)}`);
for (const s of ["acme", "borealis", "cedar"]) console.log(`  client  ${persona(`${s}-admin`)}  ${persona(`${s}-member`)}`);
console.log(`  multi   ${persona("multi")}`);
