// Federated run (Phase 9): read active programme enrolments, run the numpy coordinator over exactly those
// clients, then sync the metadata-only log and register the result as a *candidate* model. A human approves
// it at /e/fl. Run: npm run fl  [-- --dropout cedar-credit@3 --poison borealis-finance@2]
import { createAdminClient } from "@insforge/sdk";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const baseUrl = process.env.NEXT_PUBLIC_INSFORGE_URL;
const apiKey = process.env.INSFORGE_API_KEY;
if (!baseUrl || !apiKey) throw new Error("NEXT_PUBLIC_INSFORGE_URL and INSFORGE_API_KEY are required");
const db = createAdminClient({ baseUrl, apiKey }).database;

const PROGRAM = "sme-cashflow-stress";
const flDir = fileURLToPath(new URL("../../fl/", import.meta.url));
const out = `${flDir}out/run.json`;

function must<T>(r: { data: T | null; error: { message?: string } | null }, what: string): T {
  if (r.error || r.data == null) throw new Error(`${what}: ${r.error?.message ?? "not found"}`);
  return r.data;
}

const program = must(await db.from("fl_programs").select("id, min_participants").eq("slug", PROGRAM).single(), "fl_programs") as {
  id: string;
  min_participants: number;
};
const enrolments = must(
  await db.from("fl_enrollments").select("orgs(slug)").eq("program_id", program.id).eq("consent_train", true).is("withdrawn_at", null),
  "fl_enrollments",
) as unknown as { orgs: { slug: string } }[];
const participants = enrolments.map((e) => e.orgs.slug).sort();
console.log(`enrolled: ${participants.join(", ") || "none"}`);
if (participants.length < program.min_participants) {
  throw new Error(`only ${participants.length} enrolled; the programme needs at least ${program.min_participants}. Not starting.`);
}

const py = process.platform === "win32" ? "python" : "python3";
execFileSync(py, [`${flDir}run.py`, "--participants", participants.join(","), "--min-participants", String(program.min_participants), "--out", out, ...process.argv.slice(2)], {
  stdio: "inherit",
});

type Round = { n: number; status: string; participants: string[]; dropped: string[]; rejected: object; clipped: string[]; update_norms: object; weights_n: object; holdout: object };
const r = JSON.parse(readFileSync(out, "utf8")) as {
  finished_at: string; params: object; aggregation: string; participants: string[]; rounds: Round[];
  comparison: { federated: object }; skew: object; weights: number[]; weights_sha256: string;
};

const run = must(
  await db.from("fl_runs").insert([{
    program_id: program.id, params: r.params, aggregation: r.aggregation, participants: r.participants,
    comparison: r.comparison, skew: r.skew, finished_at: r.finished_at,
  }]).select("id").single(),
  "fl_runs",
) as { id: string };
must(await db.from("fl_rounds").insert(r.rounds.map((x) => ({ run_id: run.id, ...x }))).select("n"), "fl_rounds");

const [{ data: last }, { data: approved }] = await Promise.all([
  db.from("model_registry").select("version").eq("program_id", program.id).order("version", { ascending: false }).limit(1),
  db.from("model_registry").select("id").eq("program_id", program.id).eq("status", "approved").limit(1),
]);
const version = (((last ?? []) as { version: number }[])[0]?.version ?? 0) + 1;
must(
  await db.from("model_registry").insert([{
    program_id: program.id, run_id: run.id, version, status: "candidate",
    parent_id: ((approved ?? []) as { id: string }[])[0]?.id ?? null,
    metrics: r.comparison.federated, weights: r.weights, weights_sha256: r.weights_sha256,
  }]).select("id"),
  "model_registry",
);
console.log(`✓ run ${run.id} · ${r.rounds.length} rounds · candidate v${version} registered (awaiting human approval at /e/fl)`);
