import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Plus } from "lucide-react";
import { requireEmployee } from "@/lib/authz";
import { createInsForgeServerClient } from "@/lib/insforge/server";
import { EmptyState, Section } from "@/components/portal/primitives";
import { PortalBand } from "@/components/portal/portal";
import { cn } from "@/lib/utils";
import { EXPERIMENT_STATUS } from "./status";

export const metadata: Metadata = { title: "Experiments" };

type Props = { searchParams: Promise<{ status?: string; mine?: string }> };
type Row = { id: string; title: string; status: string; updated_at: string; owner_id: string; teams: { name: string } | null; offerings: { name: string } | null };

async function Experiments({ searchParams }: Props) {
  const s = await requireEmployee();
  const f = await searchParams;
  let q = (await createInsForgeServerClient()).database
    .from("experiments").select("id, title, status, updated_at, owner_id, teams(name), offerings(name)").order("updated_at", { ascending: false }).limit(100);
  if (f.status && f.status in EXPERIMENT_STATUS) q = q.eq("status", f.status);
  if (f.mine) q = q.eq("owner_id", s.user.id);
  const { data } = await q;
  const rows = (data ?? []) as unknown as Row[];
  const filters: [string, string][] = [["", "All"], ["mine=1", "Mine"], ...Object.entries(EXPERIMENT_STATUS).filter(([k]) => k !== "draft").map(([k, v]) => [`status=${k}`, v.label] as [string, string])];
  const current = f.mine ? "mine=1" : f.status ? `status=${f.status}` : "";

  return (
    <>
      <PortalBand eyebrow="Employee portal · Collaboration" title="Experiments" lead="What we're trying, why, and what happened, including what didn't work. Drafts stay with you and your team.">
        <Link href="/e/experiments/new" className="inline-flex items-center gap-2 rounded-[5px] bg-green px-5 py-3 text-sm font-bold text-on-green">
          <Plus className="size-4" aria-hidden /> New experiment
        </Link>
      </PortalBand>
      <Section className="py-12">
        <nav aria-label="Filter experiments" className="mb-6 flex flex-wrap gap-2">
          {filters.map(([k, l]) => (
            <Link key={k} href={k ? `/e/experiments?${k}` : "/e/experiments"} aria-current={current === k ? "page" : undefined}
              className={cn("rounded-full border px-4 py-2 text-sm font-bold", current === k ? "border-navy bg-navy text-white" : "border-line-strong hover:border-green-700")}>
              {l}
            </Link>
          ))}
        </nav>
        {rows.length ? (
          <ul className="grid grid-cols-1 gap-3">
            {rows.map((e) => (
              <li key={e.id}>
                <Link href={`/e/experiments/${e.id}`} className="lift flex items-center justify-between gap-4 rounded-[10px] border border-line bg-white px-5 py-4 max-sm:flex-col max-sm:items-start">
                  <span className="min-w-0 max-w-full">
                    <span className="block truncate font-bold">{e.title}</span>
                    <span className="mt-1 block text-xs text-slate">
                      {[e.teams?.name ?? (e.owner_id === s.user.id ? "You" : "Individual"), e.offerings?.name].filter(Boolean).join(" · ")} · updated {new Date(e.updated_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                    </span>
                  </span>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${EXPERIMENT_STATUS[e.status].cls}`}>{EXPERIMENT_STATUS[e.status].label}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="No experiments here" body="File one to share what you're testing with colleagues." />
        )}
      </Section>
    </>
  );
}

export default function Page(props: Props) {
  return (
    <Suspense fallback={<Section><p className="text-slate">Loading experiments…</p></Section>}>
      <Experiments {...props} />
    </Suspense>
  );
}
