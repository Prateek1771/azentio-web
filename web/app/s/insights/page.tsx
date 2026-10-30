import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Plus } from "lucide-react";
import { requireGrant } from "@/lib/authz";
import { createInsForgeServerClient } from "@/lib/insforge/server";
import { IDEA_STATUS, type ThemeStat, orgCountLabel } from "@/lib/learning/model";
import { EmptyState, Section } from "@/components/portal/primitives";
import { Panel, PortalBand } from "@/components/portal/portal";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Themes & ideas" };

const add = "inline-flex items-center gap-1.5 rounded-[5px] bg-green px-3.5 py-2 text-xs font-bold text-on-green";
const row = "lift flex items-center justify-between gap-3 rounded-lg border border-line bg-white px-4 py-3 text-sm";

async function Insights() {
  const s = await requireGrant("product_owner", "moderate");
  const db = (await createInsForgeServerClient()).database;
  const [{ data: themes }, { data: stats }, { data: ideas }] = await Promise.all([
    db.from("themes").select("id, name, status").order("updated_at", { ascending: false }),
    db.rpc("theme_stats"),
    db.from("ideas").select("id, title, status, priority, client_visible").order("updated_at", { ascending: false }),
  ]);
  const stat = new Map(((stats ?? []) as ThemeStat[]).map((x) => [x.theme_id, x]));
  const po = s.grants.includes("product_owner");

  return (
    <>
      <PortalBand eyebrow="Staff console · Insights" title="Themes & ideas" lead="Group approved contributions into themes, then turn themes into improvement ideas with an audited status and an audience-safe update for contributors." />
      <Section className="py-12">
        <div className="grid grid-cols-2 gap-6 max-[959px]:grid-cols-1">
          <Panel title="Themes" action={<Link href="/s/insights/themes/new" className={add}><Plus className="size-3.5" aria-hidden /> New theme</Link>}>
            {themes?.length ? (
              <ul className="grid grid-cols-1 gap-2">
                {(themes as { id: string; name: string; status: string }[]).map((t) => (
                  <li key={t.id}>
                    <Link href={`/s/insights/themes/${t.id}`} className={row}>
                      <span className="min-w-0 truncate font-bold">{t.name}</span>
                      <span className="shrink-0 text-xs text-slate">{t.status === "draft" ? "Draft · " : ""}{orgCountLabel(stat.get(t.id))}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="No themes yet" body="Create a theme and link approved contributions to it." />
            )}
          </Panel>
          <Panel title="Improvement ideas" action={po ? <Link href="/s/insights/ideas/new" className={add}><Plus className="size-3.5" aria-hidden /> New idea</Link> : undefined}>
            {ideas?.length ? (
              <ul className="grid grid-cols-1 gap-2">
                {(ideas as { id: string; title: string; status: string; priority: string; client_visible: boolean }[]).map((i) => (
                  <li key={i.id}>
                    <Link href={`/s/insights/ideas/${i.id}`} className={row}>
                      <span className="min-w-0 truncate font-bold">{i.title}</span>
                      <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold", IDEA_STATUS[i.status].cls)}>
                        {IDEA_STATUS[i.status].label}{i.client_visible ? "" : " · internal"}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="No ideas yet" body={po ? "Turn a theme into an improvement idea." : "Product owners create improvement ideas."} />
            )}
          </Panel>
        </div>
      </Section>
    </>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<Section><p className="text-slate">Loading…</p></Section>}>
      <Insights />
    </Suspense>
  );
}
