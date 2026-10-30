import { createInsForgeServerClient } from "@/lib/insforge/server";
import { Panel } from "@/components/portal/portal";
import { FlForm } from "./fl-form";

// Federated learning programme opt-in (P2). Separate from publishing consent and from membership.
export async function FlProgrammePanel({ orgId, slug, isAdmin }: { orgId: string; slug: string; isAdmin: boolean }) {
  const db = (await createInsForgeServerClient()).database;
  const { data: p } = await db.from("fl_programs").select("id, name, task").eq("slug", "sme-cashflow-stress").maybeSingle();
  if (!p) return null;
  const program = p as { id: string; name: string; task: string };
  const { data: e } = await db.from("fl_enrollments").select("consent_at, withdrawn_at").eq("program_id", program.id).eq("org_id", orgId).maybeSingle();
  const enrolment = e as { consent_at: string; withdrawn_at: string | null } | null;
  const enrolled = !!enrolment && !enrolment.withdrawn_at;

  return (
    <Panel
      title="Federated learning programme"
      action={<span className={`rounded-full px-3 py-1 text-xs font-bold ${enrolled ? "bg-green-050 text-green-700" : "bg-light text-slate"}`}>{enrolled ? "Enrolled" : "Not enrolled"}</span>}
    >
      <p className="text-sm font-bold">{program.name}</p>
      <p className="mt-1 text-sm leading-[1.65] text-slate">{program.task}</p>
      <p className="mt-3 text-sm leading-[1.65] text-slate">
        Optional and separate from sharing observations. If you join, a training job runs inside your environment and only sends
        clipped model updates, never your records. Updates can still carry some information about the data, so this is a
        demonstration on synthetic data, without secure aggregation or formal privacy guarantees. Withdrawing stops future
        participation; models already trained keep their lineage and can be retired, but can&apos;t be &ldquo;untrained&rdquo;.
      </p>
      {isAdmin ? (
        <FlForm slug={slug} programId={program.id} enrolled={enrolled} />
      ) : (
        <p className="mt-4 text-xs text-slate">Only your organisation&apos;s client admin can change enrolment.</p>
      )}
    </Panel>
  );
}
