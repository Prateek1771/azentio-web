import type { Metadata } from "next";
import { Suspense } from "react";
import { requireGrant } from "@/lib/authz";
import { createInsForgeServerClient } from "@/lib/insforge/server";
import { decideReport } from "@/lib/learning/actions";
import { EmptyState, Section } from "@/components/portal/primitives";
import { Panel, PortalBand } from "@/components/portal/portal";
import { StateBadge } from "@/components/portal/contributions";
import type { ContribState } from "@/lib/contributions/model";
import { fieldCls } from "@/components/site/form-bits";

export const metadata: Metadata = { title: "Reports" };

type Report = {
  id: string;
  reason: string;
  status: string;
  decision_note: string | null;
  at: string;
  contribution_id: string | null;
  shared_contributions: { title: string } | null;
  contributions: { state: ContribState } | null;
};

const btn = "rounded-[5px] px-4 py-2.5 text-sm font-bold";

async function Reports() {
  await requireGrant("moderate");
  const { data } = await (await createInsForgeServerClient()).database
    .from("reports")
    .select("id, reason, status, decision_note, at, contribution_id, shared_contributions(title), contributions(state)")
    .order("at", { ascending: false })
    .limit(50);
  const rows = (data ?? []) as unknown as Report[];
  const open = rows.filter((r) => r.status === "open");
  const decided = rows.filter((r) => r.status !== "open");

  return (
    <>
      <PortalBand eyebrow="Staff console · Moderation" title="Reports" lead="Hide a reported item while you investigate, then uphold (withdraw and purge) or dismiss (restore). Every decision is recorded and the reporter is told the outcome." />
      <Section className="py-12">
        <div className="grid gap-6">
          <Panel title={`Open (${open.length})`}>
            {open.length ? (
              <ul className="grid grid-cols-1 gap-4">
                {open.map((r) => (
                  <li key={r.id} className="grid gap-3 rounded-[10px] border border-line p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="font-bold">{r.shared_contributions?.title ?? "Shared copy no longer exists"}</p>
                      {r.contributions && <StateBadge state={r.contributions.state} />}
                    </div>
                    <p className="text-sm">“{r.reason}”</p>
                    {r.contribution_id && (
                      <form action={decideReport} className="grid gap-3">
                        <input type="hidden" name="id" value={r.id} />
                        <input type="hidden" name="contribution" value={r.contribution_id} />
                        <label className="grid gap-1.5 text-[13px] font-bold">
                          Decision note
                          <input name="note" maxLength={1000} className={fieldCls} />
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {r.contributions?.state === "published" && (
                            <button name="decision" value="unpublish" className={`${btn} border border-line-strong hover:border-green-700`}>Hide while investigating</button>
                          )}
                          <button name="decision" value="upheld" className={`${btn} border border-orange-300 text-orange-800 hover:bg-orange-50`}>Uphold &amp; withdraw</button>
                          <button name="decision" value="dismissed" className={`${btn} bg-green text-on-green`}>Dismiss &amp; restore</button>
                        </div>
                      </form>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="No open reports" body="Reports from the shared feed appear here." />
            )}
          </Panel>
          {decided.length > 0 && (
            <Panel title="Decided">
              <ul className="grid grid-cols-1 gap-2">
                {decided.map((r) => (
                  <li key={r.id} className="rounded-lg bg-light px-4 py-3 text-sm">
                    <span className="font-bold capitalize">{r.status}</span> · “{r.reason}”{r.decision_note && <span className="text-slate"> · Note: {r.decision_note}</span>}
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>
      </Section>
    </>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<Section><p className="text-slate">Loading reports…</p></Section>}>
      <Reports />
    </Suspense>
  );
}
