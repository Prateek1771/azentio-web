// AIRA request pipeline (G1–G14). Deterministic checks first; any error fails closed to a refusal.
// Dependencies are injected so the app route and the gold-set script run exactly the same code.
import { type Hit, type Rule, type Source, buildMessages, checkInput, checkOutput, limit, sanitize } from "./guards.ts";
import type { ChatResult } from "../ai/gateway.ts";

type Q = PromiseLike<{ data: unknown; error: unknown }> & Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
type Db = { from: (t: string) => any; rpc: (fn: string, args?: Record<string, unknown>) => Q }; // eslint-disable-line @typescript-eslint/no-explicit-any

export type Verdict = "answered" | "refused" | "blocked" | "no_evidence";
export type AiraResult = {
  interactionId: string | null;
  verdict: Verdict;
  answer?: string;
  message?: string;
  sources: { n: number; id: string; kind: "shared" | "theme"; title: string }[];
};
export type AiraDeps = {
  userDb: Db; // the caller's RLS client: retrieval sees exactly what the caller may see (G8)
  adminDb: Db; // trusted server writes: rules, logs, rate-limit counts
  userId: string;
  orgId: string | null;
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

const SAFE = {
  unavailable: "AIRA is temporarily unavailable. Browse the shared feed in the meantime.",
  error: "AIRA can't answer right now. Please try again shortly.",
  noEvidence: "There isn't enough approved evidence yet to answer that. Browse the shared feed, or ask about another topic.",
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
    return { interactionId, verdict, answer: extra.answer, message: extra.message, sources: sources.map(({ n, id, kind, title }) => ({ n, id, kind, title })) };
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
    if (!d.skipRateLimit && (await count(mine().gte("created_at", since(60_000)))) >= limit(rules, "rate.per_minute", 5)
      || (!d.skipRateLimit && (await count(mine().gte("created_at", since(3_600_000)))) >= limit(rules, "rate.per_hour", 20))) {
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

    // G8–G9 retrieval through the caller's RLS client
    const [{ data: shared, error: e1 }, { data: themes }] = await Promise.all([
      d.userDb.rpc("match_shared", { p_query: question, p_limit: 6 }),
      d.userDb.rpc("match_themes", { p_query: question }),
    ]);
    if (e1) throw new Error("retrieval failed");
    const evidence = ((shared ?? []) as { id: string; title: string; body: string; industry: string | null; region: string | null; rank: number }[]).filter((s) => s.rank >= 0.1);
    sources = [
      ...evidence.map((s, i) => ({ n: i + 1, id: s.id, kind: "shared" as const, title: s.title, text: [s.body, [s.industry, s.region].filter(Boolean).join(", ")].filter(Boolean).join("\n") })),
      ...((themes ?? []) as { id: string; name: string; summary: string; limitations: string | null }[]).map((t, i) => ({
        n: evidence.length + i + 1, id: t.id, kind: "theme" as const, title: `Theme: ${t.name}`, text: `${t.summary}\nLimitations: ${t.limitations ?? "not stated"}`,
      })),
    ];
    if (evidence.length < limit(rules, "retrieval.min_sources", 2)) {
      hits.push({ key: "retrieval.min_sources", severity: "low", stage: "retrieval" });
      return finish("no_evidence", { message: SAFE.noEvidence });
    }

    // model (G10 prompt), then G11–G12 before anything is shown
    const out = await d.chat(buildMessages(question, sources));
    model = out.model;
    if (!out.text || out.text.includes("NOT_ENOUGH_EVIDENCE")) return finish("no_evidence", { message: SAFE.noEvidence });
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
