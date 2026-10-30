import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ShieldAlert } from "lucide-react";
import { requireEmployee } from "@/lib/authz";
import { createInsForgeServerClient } from "@/lib/insforge/server";
import { EmptyState, Section } from "@/components/portal/primitives";
import { Panel, PortalBand } from "@/components/portal/portal";
import { decideModel, rollbackModel } from "./actions";

export const metadata: Metadata = { title: "Federated learning" };

type Metrics = { auc: number; accuracy: number; log_loss: number };
type Program = { id: string; name: string; task: string; description: string | null; min_participants: number };
// orgs is null for employees who can't read org names (only members and portal admins can)
type Enrolment = { consent_at: string; withdrawn_at: string | null; orgs: { name: string; slug: string } | null };
type Model = { id: string; run_id: string; version: number; parent_id: string | null; status: string; metrics: Metrics; weights_sha256: string; decided_at: string | null; note: string | null; created_at: string };
type Run = {
  id: string; params: Record<string, unknown>; aggregation: string; participants: string[]; finished_at: string;
  comparison: { federated: Metrics; local_only: Record<string, Metrics>; local_only_mean: Metrics; oracle_reference_only: Metrics };
  skew: { explanation: string[] };
};
type Round = { n: number; status: string; participants: string[]; dropped: string[]; rejected: Record<string, string>; clipped: string[]; holdout: Metrics };

const date = (s: string) => new Date(s).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
const STATUS: Record<string, string> = {
  candidate: "bg-amber-50 text-amber-900",
  approved: "bg-green-050 text-green-700",
  rejected: "bg-orange-50 text-orange-800",
  retired: "bg-light text-slate",
};
const btn = "rounded-[5px] px-3 py-1.5 text-xs font-bold";

function Bar({ label, auc, tone, hint }: { label: string; auc: number; tone: string; hint?: string }) {
  // AUC 0.5 is chance, so the bar starts there
  const pct = Math.max(0, Math.min(1, (auc - 0.5) / 0.5)) * 100;
  return (
    <div className="grid grid-cols-[180px_1fr_56px] items-center gap-3 text-sm max-sm:grid-cols-[110px_1fr_48px]">
      <span className="truncate font-bold" title={label}>{label}{hint && <span className="block text-[11px] font-normal text-slate">{hint}</span>}</span>
      <span className="h-3 rounded-full bg-light" aria-hidden><span className={`block h-3 rounded-full ${tone}`} style={{ width: `${pct}%` }} /></span>
      <span className="text-right tabular-nums">{auc.toFixed(3)}</span>
    </div>
  );
}

async function Federated({ searchParams }: { searchParams: Promise<{ run?: string; done?: string; error?: string }> }) {
  const s = await requireEmployee();
  const sp = await searchParams;
  const admin = s.grants.includes("portal_admin");
  const db = (await createInsForgeServerClient()).database;

  const { data: p } = await db.from("fl_programs").select("id, name, task, description, min_participants").eq("slug", "sme-cashflow-stress").maybeSingle();
  const program = p as Program | null;
  if (!program) {
    return <Section className="py-14"><EmptyState title="No federated programme yet" body="Run the seed to create the SME cash-flow stress programme." /></Section>;
  }

  const [{ data: e }, { data: m }] = await Promise.all([
    db.from("fl_enrollments").select("consent_at, withdrawn_at, orgs(name, slug)").eq("program_id", program.id).order("consent_at"),
    db.from("model_registry").select("id, run_id, version, parent_id, status, metrics, weights_sha256, decided_at, note, created_at").eq("program_id", program.id).order("version", { ascending: false }),
  ]);
  const enrolments = (e ?? []) as unknown as Enrolment[];
  const models = (m ?? []) as Model[];
  const versionOf = Object.fromEntries(models.map((x) => [x.id, x.version]));
  const runId = sp.run ?? models[0]?.run_id;
  const [{ data: r }, { data: rd }] = runId
    ? await Promise.all([
        db.from("fl_runs").select("id, params, aggregation, participants, finished_at, comparison, skew").eq("id", runId).maybeSingle(),
        db.from("fl_rounds").select("n, status, participants, dropped, rejected, clipped, holdout").eq("run_id", runId).order("n"),
      ])
    : [{ data: null }, { data: null }];
  const run = r as Run | null;
  const rounds = (rd ?? []) as Round[];
  const approved = models.find((x) => x.status === "approved");

  return (
    <>
      <PortalBand
        eyebrow="Federated learning · opt-in programme"
        title={program.name}
        lead="Each enrolled client trains on its own data. Only clipped weight updates reach the coordinator, and a person decides what gets deployed."
      />
      <Section className="py-12">
        <div className="grid gap-8">
          <div role="note" className="flex items-start gap-3 rounded-[10px] border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            <p>
              <strong>Simulation on synthetic data.</strong> Client environments are simulated in one process. Aggregation is plain
              weighted FedAvg with norm clipping and outlier rejection: <strong>no secure aggregation and no differential privacy</strong>,
              so updates could still leak information. See <code>fl/THREAT_MODEL.md</code>.
            </p>
          </div>
          {sp.error && <p role="alert" className="rounded-md border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800">{sp.error}</p>}
          {sp.done && <p role="status" className="rounded-md bg-green-050 px-4 py-3 text-sm font-bold text-green-700">Model {sp.done.replace("-", " ")}.</p>}

          <div className="grid grid-cols-[1fr_1.4fr] gap-8 max-[959px]:grid-cols-1">
            <Panel title="Programme">
              <p className="text-sm leading-[1.65] text-slate">{program.task}</p>
              {program.description && <p className="mt-2 text-sm leading-[1.65] text-slate">{program.description}</p>}
              <p className="mt-4 text-xs font-bold text-slate">Minimum cohort: {program.min_participants} clients per round</p>
              <h3 className="mt-6 mb-2 text-sm font-bold">Enrolled organisations (train consent)</h3>
              {enrolments.length ? (
                <ul className="grid grid-cols-1 gap-2">
                  {enrolments.map((x, i) => (
                    <li key={x.orgs?.slug ?? i} className="flex items-center justify-between gap-3 rounded-lg bg-light px-4 py-2.5 text-sm">
                      <span className="font-bold">{x.orgs?.name ?? "A client organisation"}</span>
                      <span className="text-xs text-slate">{x.withdrawn_at ? `Withdrawn ${date(x.withdrawn_at)}` : `Consented ${date(x.consent_at)}`}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate">No client has opted in yet.</p>
              )}
            </Panel>

            <Panel
              title="Model registry"
              action={admin && approved && (
                <form action={rollbackModel.bind(null, program.id)}>
                  <button className={`${btn} border border-line hover:border-green-700`}>Roll back v{approved.version}</button>
                </form>
              )}
            >
              {models.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="text-xs text-slate">
                      <tr><th className="py-2 pr-3">Version</th><th className="pr-3">Status</th><th className="pr-3">Holdout AUC</th><th className="pr-3">Lineage</th><th>Decision</th></tr>
                    </thead>
                    <tbody>
                      {models.map((x) => (
                        <tr key={x.id} className="border-t border-line align-top">
                          <td className="py-3 pr-3 font-bold">
                            <Link href={`/e/fl?run=${x.run_id}`} className="hover:underline">v{x.version}</Link>
                            <span className="block font-mono text-[10px] font-normal text-slate" title={x.weights_sha256}>{x.weights_sha256.slice(0, 10)}</span>
                          </td>
                          <td className="py-3 pr-3"><span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${STATUS[x.status]}`}>{x.status}</span></td>
                          <td className="py-3 pr-3 tabular-nums">{x.metrics.auc.toFixed(3)}</td>
                          <td className="py-3 pr-3 text-xs text-slate">{x.parent_id ? `from v${versionOf[x.parent_id]}` : "first"}</td>
                          <td className="py-3 text-xs text-slate">
                            {x.status === "candidate" && admin ? (
                              <form className="flex flex-wrap items-center gap-2">
                                <input name="note" placeholder="Note (optional)" aria-label={`Decision note for v${x.version}`} maxLength={1000} className="w-36 rounded border border-line px-2 py-1" />
                                <button formAction={decideModel.bind(null, x.id, "approved")} className={`${btn} bg-green text-on-green`}>Approve</button>
                                <button formAction={decideModel.bind(null, x.id, "rejected")} className={`${btn} border border-line`}>Reject</button>
                              </form>
                            ) : x.decided_at ? (
                              <>{date(x.decided_at)}{x.note && <span className="block">{x.note}</span>}</>
                            ) : (
                              "Awaiting a portal admin"
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-slate">No candidate yet. Run <code>npm run fl</code> to train one.</p>
              )}
            </Panel>
          </div>

          {run && (
            <>
              <Panel title={`Run · ${date(run.finished_at)}`}>
                <p className="mb-5 text-xs text-slate">{run.aggregation} · participants: {run.participants.join(", ")}</p>
                <div className="grid gap-3">
                  <Bar label="Federated (global)" auc={run.comparison.federated.auc} tone="bg-green" />
                  <Bar label="Local-only, mean" auc={run.comparison.local_only_mean.auc} tone="bg-navy" />
                  {Object.entries(run.comparison.local_only).map(([k, v]) => (
                    <Bar key={k} label={`Local-only · ${k}`} auc={v.auc} tone="bg-navy/40" />
                  ))}
                  <Bar label="Centralised oracle" hint="reference only, pools raw data" auc={run.comparison.oracle_reference_only.auc} tone="bg-slate/40" />
                </div>
                <p className="mt-3 text-xs text-slate">Holdout AUC on a separate synthetic population with an even sector mix. The bar starts at 0.5 (chance).</p>
              </Panel>

              <div className="grid grid-cols-[1.4fr_1fr] gap-8 max-[959px]:grid-cols-1">
                <Panel title="Rounds">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="text-xs text-slate">
                        <tr><th className="py-2 pr-3">#</th><th className="pr-3">Aggregated</th><th className="pr-3">Dropped / rejected</th><th className="pr-3">Clipped</th><th>AUC</th></tr>
                      </thead>
                      <tbody>
                        {rounds.map((x) => (
                          <tr key={x.n} className="border-t border-line align-top">
                            <td className="py-2.5 pr-3 font-bold">{x.n}</td>
                            <td className="py-2.5 pr-3 text-xs">{x.status === "aggregated" ? x.participants.join(", ") : <span className="text-orange-800">{x.status}</span>}</td>
                            <td className="py-2.5 pr-3 text-xs">
                              {x.dropped.map((d) => <span key={d} className="block text-amber-900">{d}: no response</span>)}
                              {Object.entries(x.rejected).map(([k, v]) => <span key={k} className="block text-orange-800">{k}: {v}</span>)}
                              {!x.dropped.length && !Object.keys(x.rejected).length && <span className="text-slate">none</span>}
                            </td>
                            <td className="py-2.5 pr-3 text-xs">{x.clipped.join(", ") || "none"}</td>
                            <td className="py-2.5 tabular-nums">{x.holdout.auc.toFixed(3)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Panel>
                <Panel title="Why the clients differ">
                  <ul className="grid gap-2 text-sm leading-[1.6] text-slate">
                    {run.skew.explanation.map((l) => <li key={l}>{l}</li>)}
                  </ul>
                  <p className="mt-4 text-xs text-slate">Only aggregate statistics are logged. No training rows ever leave a client.</p>
                </Panel>
              </div>
            </>
          )}
        </div>
      </Section>
    </>
  );
}

export default function Page(props: { searchParams: Promise<{ run?: string; done?: string; error?: string }> }) {
  return (
    <Suspense fallback={<Section><p className="text-slate">Loading…</p></Section>}>
      <Federated {...props} />
    </Suspense>
  );
}
