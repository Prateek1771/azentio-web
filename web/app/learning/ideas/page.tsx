import type { Metadata } from "next";
import { Suspense } from "react";
import { requireMember } from "@/lib/authz";
import { createInsForgeServerClient } from "@/lib/insforge/server";
import { IDEA_STATUS } from "@/lib/learning/model";
import { EmptyState, Section } from "@/components/portal/primitives";
import { PortalBand } from "@/components/portal/portal";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Improvement ideas" };

type Idea = { id: string; title: string; offering: string | null; theme: string | null; status: string; public_update: string | null; owner_team: string | null; updated_at: string };

async function Ideas() {
  await requireMember();
  // Audience-safe columns only (no priority, problem notes or evidence), for entitled offerings.
  const { data } = await (await createInsForgeServerClient()).database.rpc("client_ideas");
  const ideas = (data ?? []) as Idea[];

  return (
    <>
      <PortalBand
        eyebrow="Community learning"
        title="Improvement ideas"
        lead="What Azentio's product teams are doing with the community's learning. A status describes where an idea stands today. It isn't a promised delivery date."
      />
      <Section className="py-12">
        {ideas.length ? (
          <ul className="grid grid-cols-1 gap-4">
            {ideas.map((i) => {
              const st = IDEA_STATUS[i.status];
              return (
                <li key={i.id} className="grid gap-3 rounded-[10px] border border-line bg-white p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-extrabold tracking-[2px] text-green-700 uppercase">
                        {[i.offering ?? "Cross-offering", i.theme && `Theme: ${i.theme}`].filter(Boolean).join(" · ")}
                      </p>
                      <h2 className="mt-1 text-[19px] font-bold">{i.title}</h2>
                    </div>
                    <span className={cn("rounded-full px-3 py-1.5 text-xs font-bold", st.cls)}>{st.label}</span>
                  </div>
                  <p className="text-sm text-slate">{st.plain}</p>
                  {i.public_update && <p className="rounded-md bg-light px-4 py-3 text-sm"><strong>Latest update:</strong> {i.public_update}</p>}
                  <p className="text-xs text-slate">
                    {i.owner_team ? `Owner: ${i.owner_team} · ` : ""}Updated {new Date(i.updated_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState title="No ideas shared yet" body="When product teams act on community themes for offerings you use, you'll see the status here." />
        )}
      </Section>
    </>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<Section><p className="text-slate">Loading ideas…</p></Section>}>
      <Ideas />
    </Suspense>
  );
}
