import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireEmployee } from "@/lib/authz";
import { createInsForgeServerClient } from "@/lib/insforge/server";
import { Section } from "@/components/portal/primitives";
import { Panel, PortalBand } from "@/components/portal/portal";
import { CommentThread } from "@/components/portal/comments";
import { ExperimentForm, type ExperimentInit } from "../../workspace-forms";
import { EXPERIMENT_STATUS } from "../status";

export const metadata: Metadata = { title: "Experiment" };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ team?: string; edit?: string }> };
type Row = { id: string; title: string; hypothesis: string; method: string | null; result: string | null; status: string; offering_id: string | null; team_id: string | null; owner_id: string; teams: { name: string } | null };

async function Experiment({ params, searchParams }: Props) {
  const s = await requireEmployee();
  const { id } = await params;
  const sp = await searchParams;
  const isNew = id === "new";
  if (!isNew && !/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const db = (await createInsForgeServerClient()).database;
  const [{ data: offs }, { data: myTeams }, exp] = await Promise.all([
    db.from("offerings").select("id, name").order("name"),
    db.from("team_members").select("teams(id, name)").eq("user_id", s.user.id),
    isNew ? Promise.resolve({ data: null }) : db.from("experiments").select("*, teams(name)").eq("id", id).maybeSingle(),
  ]);
  const e = exp.data as Row | null;
  if (!isNew && !e) notFound(); // RLS: other people's drafts don't exist
  const teams = ((myTeams ?? []) as unknown as { teams: { id: string; name: string } }[]).map((t) => t.teams);
  const canEdit = isNew || e!.owner_id === s.user.id || (e!.team_id !== null && teams.some((t) => t.id === e!.team_id));
  const init: ExperimentInit = e
    ? { title: e.title, hypothesis: e.hypothesis, method: e.method ?? "", result: e.result ?? "", status: e.status, offering_id: e.offering_id ?? "", team_id: e.team_id ?? "" }
    : { title: "", hypothesis: "", method: "", result: "", status: "draft", offering_id: "", team_id: teams.some((t) => t.id === sp.team) ? sp.team! : "" };
  const editing = isNew || (canEdit && sp.edit === "1");

  return (
    <>
      <PortalBand eyebrow={isNew ? "New experiment" : `Experiment · ${EXPERIMENT_STATUS[e!.status].label}${e!.teams ? ` · ${e!.teams.name}` : ""}`} title={<span className="break-words">{isNew ? "File an experiment" : e!.title}</span>}>
        <Link href="/e/experiments" className="inline-flex items-center gap-2 rounded-[5px] border border-white/40 px-5 py-3 text-sm font-bold hover:border-green hover:text-green">
          <ArrowLeft className="size-4" aria-hidden /> All experiments
        </Link>
        {!editing && canEdit && (
          <Link href={`/e/experiments/${id}?edit=1`} className="rounded-[5px] bg-green px-5 py-3 text-sm font-bold text-on-green">Edit</Link>
        )}
      </PortalBand>
      <Section className="py-12">
        {editing ? (
          <Panel title="Details">
            <ExperimentForm id={isNew ? null : id} init={init} offerings={(offs ?? []) as { id: string; name: string }[]} teams={teams} />
          </Panel>
        ) : (
          <div className="grid grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] gap-6 max-[959px]:grid-cols-1">
            <Panel title="Experiment">
              <dl className="grid gap-5 text-[15px] leading-[1.7]">
                {([["Hypothesis", e!.hypothesis], ["Method", e!.method], ["Result", e!.result]] as const).map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-xs font-bold tracking-wide text-slate uppercase">{k}</dt>
                    <dd className="mt-1 whitespace-pre-wrap">{v || <span className="text-slate">Not written yet.</span>}</dd>
                  </div>
                ))}
              </dl>
            </Panel>
            <Panel title="Comments">
              <CommentThread type="experiment" parentId={id} back={`/e/experiments/${id}`} />
            </Panel>
          </div>
        )}
      </Section>
    </>
  );
}

export default function Page(props: Props) {
  return (
    <Suspense fallback={<Section><p className="text-slate">Loading…</p></Section>}>
      <Experiment {...props} />
    </Suspense>
  );
}
