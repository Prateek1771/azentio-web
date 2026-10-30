// H.I.R.E. metrics for AIRA from real interactions (G14). Writes the ai-agent-evaluator CSV contract and prints
// the headline rates. Intent is derived from the guardrail that fired (no hand labels yet).
// Run: npm run aira:metrics [-- --days 7] [-- --out path.csv]
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createAdminClient } from "@insforge/sdk";

const arg = (k: string, d: string) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : d; };
const days = Number(arg("--days", "14"));
const out = arg("--out", join(tmpdir(), `aira-metrics-${new Date().toISOString().slice(0, 10)}.csv`));
const db = createAdminClient({ baseUrl: process.env.NEXT_PUBLIC_INSFORGE_URL!, apiKey: process.env.INSFORGE_API_KEY! }).database;

type I = { id: string; user_id: string; verdict: string; red_line: string | null; feedback: string | null; created_at: string; guardrail_events: { rule_key: string }[] };
const { data, error } = await db.from("aira_interactions").select("id, user_id, verdict, red_line, feedback, created_at, guardrail_events(rule_key)")
  .gte("created_at", new Date(Date.now() - days * 864e5).toISOString()).order("created_at");
if (error) throw new Error(error.message);
const rows = (data ?? []) as I[];

const intentOf = (r: I) => {
  const k = r.guardrail_events[0]?.rule_key ?? "";
  if (k.startsWith("inject.")) return "adversarial";
  if (k.startsWith("pii.")) return "pii";
  if (k.startsWith("scope.")) return k.slice(6);
  if (k === "retrieval.min_sources" || r.verdict === "no_evidence") return "out_of_corpus";
  return "in_scope";
};
const category = { answered: "cited_answer", no_evidence: "not_enough_evidence", refused: "scoped_refusal", blocked: "safe_fallback" } as Record<string, string>;
// a "conversation" = one user's questions with < 10 minutes between them
let conv = 0, turn = 0, last: I | null = null;
const lines = ["conversation_id,turn,intent,agent_action,output_category,tone,agent_output"];
for (const r of rows) {
  const gap = last && last.user_id === r.user_id ? Date.parse(r.created_at) - Date.parse(last.created_at) : Infinity;
  if (gap > 600_000) { conv++; turn = 0; }
  turn++;
  lines.push([`c${conv}`, turn, intentOf(r), r.verdict, category[r.verdict], "neutral", r.feedback ?? ""].join(","));
  last = r;
}
writeFileSync(out, lines.join("\n") + "\n");

const n = rows.length || 1;
const answered = rows.filter((r) => r.verdict === "answered");
const firstTurns = lines.slice(1).filter((l) => l.split(",")[1] === "1").length || 1;
const resolvedFirst = lines.slice(1).filter((l) => { const c = l.split(","); return c[1] === "1" && c[3] === "answered" && c[6] !== "down" && c[6] !== "correction"; }).length;
console.log(`AIRA · last ${days} days · ${rows.length} interactions · CSV: ${out}`);
console.log(`  IRR  instant resolution  ${(resolvedFirst / firstTurns * 100).toFixed(0)}%  (answered on the first turn, not rated wrong)`);
console.log(`  UCR  user correction     ${(answered.filter((r) => r.feedback === "correction" || r.feedback === "down").length / (answered.length || 1) * 100).toFixed(0)}%  (of answers)`);
console.log(`  PPR  ping-pong           ${((rows.length - conv) / (conv || 1)).toFixed(2)} extra turns per conversation`);
console.log(`  DIY  sent to the feed    ${(rows.filter((r) => r.verdict === "no_evidence").length / n * 100).toFixed(0)}%`);
console.log(`  RLR  red-line rate       ${(answered.filter((r) => r.red_line).length / n * 100).toFixed(1)}%  (must be 0)`);
console.log(`Deeper analysis: python ~/.claude/skills/ai-agent-evaluator/scripts/agent_metrics.py "${out}" ../evals/taxonomy.yaml`);
