import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ArrowLeft, Plus } from "lucide-react";
import { requireEmployee } from "@/lib/authz";
import { createInsForgeServerClient } from "@/lib/insforge/server";
import { rosterAction } from "@/lib/workspace/actions";
import { EmptyState, Section } from "@/components/portal/primitives";
import { Panel, PortalBand } from "@/components/portal/portal";
import { AddMemberForm } from "../../workspace-forms";
import { EXPERIMENT_STATUS } from "../../experiments/status";

export const metadata: Metadata = { title: "Team space" };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> };
const btn = "rounded-[5px] border px-3 py-1.5 text-xs font-bold";

async function Team({ params, searchParams }: Props) {
  const s = await requireEmployee();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const db = (await createInsForgeServerClient()).database;
  const [{ data }, { data: dir }, { data: exps }] = await Promise.all([
    db.from("teams").select("id, name, kind, description, team_members(user_id, role)").eq("id", id).maybeSingle(),
    db.rpc("employee_directory"),
    db.from("experiments").select("id, title, status").eq("team_id", id).order("updated_at", { ascending: false }),
  ]);
  if (!data) notFound();
  const team = data as { id: string; name: string; kind: string; description: string | null; team_members: { user_id: string; role: string }[] };
  const email = new Map(((dir ?? []) as { user_id: string; email: string }[]).map((e) => [e.user_id, e.email]));
  const lead = team.team_members.some((m) => m.user_id === s.user.id && m.role === "lead");
  const member = team.team_members.some((m) => m.user_id === s.user.id);
  const error = (await searchParams).error;
  const roster = rosterAction.bind(null, id);

  return (
    <>
      <PortalBand eyebrow={team.kind === "hackathon" ? "Hackathon team" : "Working group"} title={team.name} lead={team.description ?? undefined}>
        <Link href="/e/teams" className="inline-flex items-center gap-2 rounded-[5px] border border-white/40 px-5 py-3 text-sm font-bold hover:border-green hover:text-green">
          <ArrowLeft className="size-4" aria-hidden /> All teams
        </Link>
      </PortalBand>
      <Section className="py-12">
        {error && <p role="alert" className="mb-6 rounded-md border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800">{error}</p>}
        <div className="grid grid-cols-2 gap-6 max-[959px]:grid-cols-1">
          <Panel title={`Members (${team.team_members.length})`}>
            <ul className="grid grid-cols-1 gap-2">
              {team.team_members.map((m) => (
                <li key={m.user_id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-light px-4 py-3 text-sm">
                  <span className="min-w-0 break-all">
                    <span className="font-bold">{email.get(m.user_id) ?? "Former employee"}</span>
                    {m.user_id === s.user.id && " (you)"} <span className="text-xs font-bold text-green-700 uppercase">· {m.role}</span>
                  </span>
                  {(lead || m.user_id === s.user.id) && (
                    <form action={roster} className="flex gap-2">
                      <input type="hidden" name="user" value={m.user_id} />
                      {lead && <button name="op" value={m.role === "lead" ? "member" : "lead"} className={`${btn} border-line-strong bg-white`}>{m.role === "lead" ? "Make member" : "Make lead"}</button>}
                      <button name="op" value="remove" className={`${btn} border-orange-300 bg-white text-orange-800`}>{m.user_id === s.user.id ? "Leave" : "Remove"}</button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
            {lead && (
              <div className="mt-5 border-t border-line pt-5">
                <AddMemberForm teamId={id} directory={[...email.values()].filter((e) => ![...team.team_members].some((m) => email.get(m.user_id) === e))} />
              </div>
            )}
          </Panel>
          <Panel title="Team experiments" action={member ? <Link href={`/e/experiments/new?team=${id}`} className="inline-flex items-center gap-1.5 rounded-[5px] bg-green px-3.5 py-2 text-xs font-bold text-on-green"><Plus className="size-3.5" aria-hidden /> New</Link> : undefined}>
            {exps?.length ? (
              <ul className="grid grid-cols-1 gap-2">
                {(exps as { id: string; title: string; status: string }[]).map((e) => (
                  <li key={e.id}>
                    <Link href={`/e/experiments/${e.id}`} className="lift flex items-center justify-between gap-3 rounded-lg border border-line bg-white px-4 py-3 text-sm">
                      <span className="min-w-0 truncate font-bold">{e.title}</span>
                      <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${EXPERIMENT_STATUS[e.status].cls}`}>{EXPERIMENT_STATUS[e.status].label}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="No experiments yet" body={member ? "File the team's first experiment." : "Members file experiments here."} />
            )}
          </Panel>
        </div>
      </Section>
    </>
  );
}

export default function Page(props: Props) {
  return (
    <Suspense fallback={<Section><p className="text-slate">Loading team…</p></Section>}>
      <Team {...props} />
    </Suspense>
  );
}
