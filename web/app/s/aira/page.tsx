import type { Metadata } from "next";
import { Suspense } from "react";
import { requireGrant } from "@/lib/authz";
import { createInsForgeServerClient } from "@/lib/insforge/server";
import { EmptyState, Section } from "@/components/portal/primitives";
import { Panel, PortalBand } from "@/components/portal/portal";
import { cn } from "@/lib/utils";
import { toggleRule } from "./actions";

export const metadata: Metadata = { title: "AIRA guardrails" };

type Rule = { key: string; kind: string; stage: string; severity: string; enabled: boolean; description: string | null };
type Day = { day: string; total: number; answered: number; refused: number; blocked: number; no_evidence: number; up: number; down: number; corrections: number; red_lines: number };
type Event = { rule_key: string; stage: string; severity: string; created_at: string };
type Interaction = { question: string; verdict: string; red_line: string | null; feedback: string | null; created_at: string };

const SEV: Record<string, string> = { critical: "bg-orange-100 text-orange-900", high: "bg-orange-50 text-orange-800", medium: "bg-amber-50 text-amber-800", low: "bg-light text-slate" };
const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : "—");

async function Aira() {
  await requireGrant("portal_admin");
  const db = (await createInsForgeServerClient()).database;
  const [{ data: rules }, { data: days }, { data: events }, { data: recent }] = await Promise.all([
    // org-name rules list real client names: shown to portal admins only, never to AIRA users
    db.from("guardrail_rules").select("key, kind, stage, severity, enabled, description").order("stage").order("key"),
    db.rpc("aira_metrics", { p_days: 14 }),
    db.from("guardrail_events").select("rule_key, stage, severity, created_at").order("created_at", { ascending: false }).limit(30),
    db.from("aira_interactions").select("question, verdict, red_line, feedback, created_at").order("created_at", { ascending: false }).limit(20),
  ]);
  const rs = (rules ?? []) as Rule[];
  const ds = (days ?? []) as Day[];
  const sum = (k: keyof Day) => ds.reduce((n, d) => n + Number(d[k]), 0);
  const total = sum("total");
  const live = rs.find((r) => r.key === "aira_enabled")?.enabled;
  const redLines = sum("red_lines");

  return (
    <>
      <PortalBand eyebrow="Staff console · Administration" title="AIRA guardrails" lead="Deterministic rules run before and after every model call and fail closed. Every trigger is logged; the red-line rate must stay at zero." />
      <Section className="py-12">
        <div className="grid gap-6">
          <div className={cn("flex flex-wrap items-center justify-between gap-4 rounded-[10px] border p-5", live ? "border-green/50 bg-green-050" : "border-orange-300 bg-orange-50")}>
            <p className="text-sm"><strong>{live ? "AIRA is on." : "AIRA is switched off."}</strong> {live ? "Members can ask questions." : "Members see a temporary-unavailable message."} Changes apply to the next question.</p>
            <form action={toggleRule}>
              <input type="hidden" name="key" value="aira_enabled" />
              <input type="hidden" name="enabled" value={String(!live)} />
              <button className={cn("rounded-[5px] px-5 py-2.5 text-sm font-bold", live ? "border border-orange-300 bg-white text-orange-800" : "bg-green text-on-green")}>{live ? "Switch AIRA off" : "Switch AIRA on"}</button>
            </form>
          </div>

          <ul aria-label="Last 14 days" className="grid grid-cols-6 gap-3 max-md:grid-cols-3">
            {([
              ["Questions", String(total)],
              ["Answered", pct(sum("answered"), total)],
              ["Refused", pct(sum("refused"), total)],
              ["Not enough evidence", pct(sum("no_evidence"), total)],
              ["Helpful / not", `${sum("up")} / ${sum("down") + sum("corrections")}`],
              ["Red-line rate", pct(redLines, total)],
            ] as const).map(([k, v]) => (
              <li key={k} className={cn("rounded-[10px] border bg-white p-4", k === "Red-line rate" && redLines > 0 ? "border-orange-400" : "border-line")}>
                <span className={cn("block text-[24px] leading-none font-bold", k === "Red-line rate" && redLines > 0 && "text-orange-800")}>{v}</span>
                <span className="mt-1.5 block text-xs font-bold text-slate">{k}</span>
              </li>
            ))}
          </ul>

          <div className="grid grid-cols-2 gap-6 max-[959px]:grid-cols-1">
            <Panel title="Recent guardrail events">
              {events?.length ? (
                <ul className="grid grid-cols-1 gap-1.5 text-sm">
                  {(events as Event[]).map((e, i) => (
                    <li key={i} className="flex items-center justify-between gap-3 rounded-lg bg-light px-3 py-2">
                      <span className="min-w-0 truncate font-mono text-xs">{e.rule_key}</span>
                      <span className="flex shrink-0 items-center gap-2 text-xs">
                        <span className={cn("rounded-full px-2 py-0.5 font-bold", SEV[e.severity])}>{e.severity}</span>
                        <span className="text-slate">{new Date(e.created_at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState title="No events yet" body="Refusals and blocks appear here with their rule and severity." />
              )}
            </Panel>
            <Panel title="Recent questions">
              {recent?.length ? (
                <ul className="grid grid-cols-1 gap-1.5 text-sm">
                  {(recent as Interaction[]).map((r, i) => (
                    <li key={i} className="grid gap-0.5 rounded-lg bg-light px-3 py-2">
                      <span className="min-w-0 truncate">{r.question}</span>
                      <span className="text-xs text-slate">{r.verdict}{r.red_line && ` · ${r.red_line}`}{r.feedback && ` · feedback: ${r.feedback}`}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState title="No questions yet" body="Questions are logged with their verdict. Personal data is redacted before storage." />
              )}
            </Panel>
          </div>

          <Panel title={`Rules (${rs.length})`}>
            <p className="mb-3 text-xs text-slate">Disabling a rule weakens AIRA&rsquo;s protection; every change is audited.</p>
            <ul className="grid grid-cols-1 gap-1.5 text-sm">
              {rs.filter((r) => r.key !== "aira_enabled").map((r) => (
                <li key={r.key} className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-light px-3 py-2">
                  <span className="min-w-0">
                    <span className="font-mono text-xs font-bold">{r.key}</span>
                    <span className="block text-xs text-slate">{r.stage} · {r.kind} · {r.description}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className={cn("rounded-full px-2 py-0.5 text-xs font-bold", SEV[r.severity])}>{r.severity}</span>
                    <form action={toggleRule}>
                      <input type="hidden" name="key" value={r.key} />
                      <input type="hidden" name="enabled" value={String(!r.enabled)} />
                      <button aria-label={`${r.enabled ? "Disable" : "Enable"} ${r.key}`} className={cn("rounded-[5px] border px-3 py-1 text-xs font-bold", r.enabled ? "border-line-strong bg-white" : "border-orange-300 bg-orange-50 text-orange-800")}>
                        {r.enabled ? "On" : "Off"}
                      </button>
                    </form>
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </Section>
    </>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<Section><p className="text-slate">Loading…</p></Section>}>
      <Aira />
    </Suspense>
  );
}
