// AIRA request pipeline (G1–G14). Deterministic checks first; any error fails closed to a refusal.
// Dependencies are injected so the app route and the gold-set script run exactly the same code.
import { type Hit, type Rule, type Source, buildGeneralMessages, buildMessages, checkInput, checkOutput, checkRedLines, limit, sanitize } from "./guards.ts";
import { type Doc, matchGuide, matchWorkspace } from "./guide.ts";
import type { ChatResult } from "../ai/gateway.ts";

type Q = PromiseLike<{ data: unknown; error: unknown }> & Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
type Db = { from: (t: string) => any; rpc: (fn: string, args?: Record<string, unknown>) => Q }; // eslint-disable-line @typescript-eslint/no-explicit-any

// general: no source matched, so a labelled general-knowledge answer (red-line scanned, nothing to cite)
export type Verdict = "answered" | "general" | "refused" | "blocked" | "no_evidence";
export type AiraResult = {
  interactionId: string | null;
  verdict: Verdict;
  answer?: string;
  message?: string;
  sources: { n: number; id: string; kind: Source["kind"]; title: string; href?: string }[];
};
export type AiraDeps = {
  userDb: Db; // the caller's RLS client: retrieval sees exactly what the caller may see (G8)
  adminDb: Db; // trusted server writes: rules, logs, rate-limit counts
  userId: string;
  orgId: string | null;
  orgSlug?: string | null; // active client workspace, for links to the caller's own items
  isEmployee?: boolean;
  isMember: boolean;
  chat: (messages: { role: "system" | "user"; content: string }[]) => Promise<ChatResult>;
  skipRateLimit?: boolean; // gold-set runs only; the API route never sets it (the daily budget still applies)
};

// Read fresh on every request (one small query): a kill switch or rule change must apply immediately,
// and module-level caches aren't shared between Next's route and action bundles anyway.
async function loadRules(adminDb: Db): Promise<Rule[]> {
  const { data, error } = await adminDb.from("guardrail_rules").select("key, kind, stage, pattern, severity").eq("enabled", true);
  if (error) throw new Error("rules unavailable");
  return data as Rule[];
}

type Row = Record<string, string | null>;
// The caller's own workspace, read through their RLS client: their org's contributions they may see,
// and (employees) experiments and library guides. Only ever shown back to the same caller.
async function workspace(d: AiraDeps): Promise<Doc[]> {
  const docs: Doc[] = [];
  const [c, ex, lib] = await Promise.all([
    d.orgId && d.orgSlug
      ? d.userDb.from("contributions").select("id, title, body, type, state, visibility_choice").eq("org_id", d.orgId).order("updated_at", { ascending: false }).limit(25)
      : null,
    d.isEmployee ? d.userDb.from("experiments").select("id, title, hypothesis, method, result, status").order("updated_at", { ascending: false }).limit(25) : null,
    d.isEmployee ? d.userDb.from("content").select("id, title, body").eq("kind", "library").eq("published", true).limit(25) : null,
  ]);
  for (const r of ((c?.data ?? []) as Row[]))
    docs.push({ id: r.id!, title: r.title!, href: `/c/${d.orgSlug}/observations/${r.id}`, keywords: [r.type!, r.state!, "observation", "contribution"],
      text: `${r.body}\nType: ${r.type}. Status: ${r.state}. Visibility: ${r.visibility_choice}.` });
  for (const r of ((ex?.data ?? []) as Row[]))
    docs.push({ id: r.id!, title: r.title!, href: `/e/experiments/${r.id}`, keywords: ["experiment", "project", r.status!],
      text: [`Hypothesis: ${r.hypothesis}`, r.method && `Method: ${r.method}`, r.result && `Result: ${r.result}`, `Status: ${r.status}.`].filter(Boolean).join("\n") });
  for (const r of ((lib?.data ?? []) as Row[]))
    docs.push({ id: r.id!, title: r.title!, href: `/e/library/${r.id}`, keywords: ["library", "guide"], text: r.body ?? "" });
  return docs;
}

const SAFE = {
  greeting: "Hi, I'm AIRA. I can explain how this portal works, describe Azentio's products, summarise your own observations or experiments, and answer questions from approved shared learning, always with sources. What would you like to know?",
  unavailable: "AIRA is temporarily unavailable. Browse the shared feed in the meantime.",
  error: "AIRA can't answer right now. Please try again shortly.",
  noEvidence: "I don't have approved evidence on that yet. Try asking about the portal, your own work here, or a topic in the shared feed.",
  blocked: "I couldn't produce an answer that meets our safety checks. The approved sources below are a good place to start.",
};

export async function runAira(rawQuestion: string, d: AiraDeps): Promise<AiraResult> {
  const started = Date.now();
  const question = sanitize(String(rawQuestion ?? ""));
  const hits: Hit[] = [];
  let logQuestion = question.slice(0, 1000);
  let sources: Source[] = [];
  let model: string | null = null;

  const finish = async (verdict: Verdict, extra: { answer?: string; message?: string; cited?: number[]; redLine?: string | null } = {}): Promise<AiraResult> => {
    let interactionId: string | null = null;
    try {
      const { data } = await d.adminDb.from("aira_interactions").insert([{
        user_id: d.userId, org_id: d.orgId, question: logQuestion || "[empty]", verdict, model,
        answer: extra.answer ?? extra.message ?? null, red_line: extra.redLine ?? null, latency_ms: Date.now() - started,
        retrieved_ids: sources.filter((s) => s.kind === "shared").map((s) => s.id),
        cited_ids: (extra.cited ?? []).map((n) => sources.find((s) => s.n === n)?.id).filter((x): x is string => !!x && sources.find((s) => s.id === x)?.kind === "shared"),
      }]).select("id").single();
      interactionId = (data as { id: string } | null)?.id ?? null;
      if (hits.length)
        await d.adminDb.from("guardrail_events").insert(hits.map((h) => ({ interaction_id: interactionId, user_id: d.userId, stage: h.stage, rule_key: h.key, severity: h.severity, detail: { verdict } })));
    } catch {
      /* logging must never turn a refusal into an answer */
    }
    return { interactionId, verdict, answer: extra.answer, message: extra.message, sources: sources.map(({ n, id, kind, title, href }) => ({ n, id, kind, title, href })) };
  };

  try {
    // G1 access
    if (!d.isMember) return { interactionId: null, verdict: "refused", message: "AIRA is available to Azentio employees and client members.", sources: [] };
    const rules = await loadRules(d.adminDb);
    // G2 kill switch
    const sw = rules.find((r) => r.key === "aira_enabled");
    if (!sw || sw.pattern !== "true") {
      hits.push({ key: "aira_enabled", severity: "low", stage: "access" });
      return finish("refused", { message: SAFE.unavailable });
    }
    // G3 rate limits + daily model budget (free-plan credit guard)
    const since = (ms: number) => new Date(Date.now() - ms).toISOString();
    const count = async (q: Q) => ((await q) as { count?: number | null }).count ?? 0;
    const mine = () => d.adminDb.from("aira_interactions").select("id", { count: "exact", head: true }).eq("user_id", d.userId);
    if (!d.skipRateLimit && (await count(mine().gte("created_at", since(60_000)))) >= limit(rules, "rate.per_minute", 10)
      || (!d.skipRateLimit && (await count(mine().gte("created_at", since(3_600_000)))) >= limit(rules, "rate.per_hour", 60))) {
      hits.push({ key: "rate", severity: "medium", stage: "access" });
      return finish("refused", { message: "You've asked a lot of questions in a short time. Please wait a few minutes and try again." });
    }
    const today = new Date().toISOString().slice(0, 10);
    if ((await count(d.adminDb.from("aira_interactions").select("id", { count: "exact", head: true }).not("model", "is", null).gte("created_at", today))) >= limit(rules, "budget.daily_calls", 200)) {
      hits.push({ key: "budget.daily_calls", severity: "medium", stage: "access" });
      return finish("refused", { message: "AIRA has reached today's usage limit. Please try again tomorrow." });
    }

    // G4–G7 input
    const bad = checkInput(question, rules);
    if (bad) {
      hits.push(bad.hit);
      if (bad.redact) logQuestion = "[redacted: personal data]";
      return finish("refused", { message: bad.message });
    }

    // A bare greeting needs no model call (and has nothing to cite)
    if (/^(hi|hello|hey|hiya|good (morning|afternoon|evening)|thanks|thank you)\b[\s!.,]*(aira|there)?[\s!.]*$/i.test(question))
      return finish("general", { answer: SAFE.greeting });

    // G8–G9 retrieval through the caller's RLS client: community evidence, the caller's own workspace, the public guide
    const [{ data: shared, error: e1 }, { data: themes }, own] = await Promise.all([
      d.userDb.rpc("match_shared", { p_query: question, p_limit: 6 }),
      d.userDb.rpc("match_themes", { p_query: question }),
      workspace(d).catch(() => [] as Doc[]),
    ]);
    if (e1) throw new Error("retrieval failed");
    let evidence = ((shared ?? []) as { id: string; title: string; body: string; industry: string | null; region: string | null; rank: number }[]).filter((s) => s.rank >= 0.1);
    // G9: community evidence needs at least min_sources items (a lone item is never presented as a pattern)
    if (evidence.length < limit(rules, "retrieval.min_sources", 2)) {
      if (evidence.length) hits.push({ key: "retrieval.min_sources", severity: "low", stage: "retrieval" });
      evidence = [];
    }
    const extra: Omit<Source, "n">[] = [
      ...((themes ?? []) as { id: string; name: string; summary: string; limitations: string | null }[]).map((t) => ({
        id: t.id, kind: "theme" as const, title: `Theme: ${t.name}`, text: `${t.summary}\nLimitations: ${t.limitations ?? "not stated"}`,
      })),
      ...matchWorkspace(own, question).map((m) => ({ id: m.id, kind: "mine" as const, title: m.title, text: m.text, href: m.href })),
      ...matchGuide(question).map((g) => ({ id: g.id, kind: "guide" as const, title: g.title, text: g.text, href: g.href })),
    ];
    sources = [
      ...evidence.map((s) => ({ id: s.id, kind: "shared" as const, title: s.title, text: [s.body, [s.industry, s.region].filter(Boolean).join(", ")].filter(Boolean).join("\n") })),
      ...extra,
    ].map((s, i) => ({ ...s, n: i + 1 }));

    // Nothing relevant: a labelled general-knowledge answer for general questions, else "no evidence".
    // Sources are cleared first, so nothing retrieved is shown or logged as if it backed the answer.
    const general = async () => {
      sources = [];
      const out = await d.chat(buildGeneralMessages(question));
      model = out.model;
      if (!out.text || out.text.includes("NOT_ENOUGH_EVIDENCE")) return finish("no_evidence", { message: SAFE.noEvidence });
      const hit = checkRedLines(out.text, rules);
      if (hit) {
        hits.push(hit);
        return finish("blocked", { message: SAFE.blocked, redLine: hit.key });
      }
      return finish("general", { answer: out.text });
    };
    if (!sources.length) return general();

    // model (G10 prompt), then G11–G12 before anything is shown
    const out = await d.chat(buildMessages(question, sources));
    model = out.model;
    if (!out.text || out.text.includes("NOT_ENOUGH_EVIDENCE")) return general(); // matched sources weren't relevant
    const { cited, hit } = checkOutput(out.text, sources, rules);
    if (hit) {
      hits.push(hit); // the blocked text is neither shown nor stored (it may hold the very leak we caught)
      return finish("blocked", { message: SAFE.blocked, redLine: hit.key });
    }
    return finish("answered", { answer: out.text, cited });
  } catch {
    hits.push({ key: "error", severity: "medium", stage: "access" });
    return finish("refused", { message: SAFE.error });
  }
}
