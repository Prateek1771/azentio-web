import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Users } from "lucide-react";
import { requireEmployee } from "@/lib/authz";
import { createInsForgeServerClient } from "@/lib/insforge/server";
import { EmptyState, Section } from "@/components/portal/primitives";
import { Panel, PortalBand } from "@/components/portal/portal";
import { TeamForm } from "../workspace-forms";

export const metadata: Metadata = { title: "Team spaces" };

type Team = { id: string; name: string; kind: string; description: string | null; team_members: { user_id: string }[] };

async function Teams() {
  const s = await requireEmployee();
  const { data } = await (await createInsForgeServerClient()).database.from("teams").select("id, name, kind, description, team_members(user_id)").order("created_at", { ascending: false });
  const teams = (data ?? []) as Team[];
  return (
    <>
      <PortalBand eyebrow="Employee portal · Collaboration" title="Team spaces" lead="Hackathon teams and working groups. Every employee can see them; leads manage who's in." />
      <Section className="py-12">
        <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-6 max-[959px]:grid-cols-1">
          <Panel title={`Teams (${teams.length})`}>
            {teams.length ? (
              <ul className="grid grid-cols-1 gap-2">
                {teams.map((t) => (
                  <li key={t.id}>
                    <Link href={`/e/teams/${t.id}`} className="lift flex items-center justify-between gap-3 rounded-lg border border-line bg-white px-4 py-3 text-sm">
                      <span className="min-w-0">
                        <span className="block truncate font-bold">{t.name}</span>
                        <span className="text-xs text-slate">{t.kind === "hackathon" ? "Hackathon team" : "Working group"}{t.team_members.some((m) => m.user_id === s.user.id) && " · You're in"}</span>
                      </span>
                      <span className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-slate"><Users className="size-3.5" aria-hidden /> {t.team_members.length}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="No teams yet" body="Start one for the hackathon or a cross-functional working group." />
            )}
          </Panel>
          <Panel title="Start a team"><TeamForm /></Panel>
        </div>
      </Section>
    </>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<Section><p className="text-slate">Loading teams…</p></Section>}>
      <Teams />
    </Suspense>
  );
}
