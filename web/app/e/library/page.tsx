import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Plus } from "lucide-react";
import { requireEmployee } from "@/lib/authz";
import { createInsForgeServerClient } from "@/lib/insforge/server";
import { EmptyState, Section } from "@/components/portal/primitives";
import { PortalBand } from "@/components/portal/portal";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Knowledge library" };

type Row = { id: string; title: string; review_date: string | null; published: boolean; owner_id: string | null; updated_at: string };
const today = () => new Date().toISOString().slice(0, 10);

async function Library() {
  const s = await requireEmployee();
  // published employee entries plus your own drafts (RLS)
  const { data } = await (await createInsForgeServerClient()).database
    .from("content").select("id, title, review_date, published, owner_id, updated_at").eq("kind", "library").eq("audience", "employee").order("updated_at", { ascending: false });
  const rows = (data ?? []) as Row[];
  const now = today();

  return (
    <>
      <PortalBand eyebrow="Employee portal · Knowledge" title="Knowledge library" lead="Internal guides and know-how. Every entry has an owner and a review date, so nothing goes quietly stale.">
        <Link href="/e/library/new" className="inline-flex items-center gap-2 rounded-[5px] bg-green px-5 py-3 text-sm font-bold text-on-green">
          <Plus className="size-4" aria-hidden /> New entry
        </Link>
      </PortalBand>
      <Section className="py-12">
        {rows.length ? (
          <ul className="grid grid-cols-1 gap-3">
            {rows.map((r) => {
              const overdue = r.review_date !== null && r.review_date < now;
              return (
                <li key={r.id}>
                  <Link href={`/e/library/${r.id}`} className="lift flex items-center justify-between gap-4 rounded-[10px] border border-line bg-white px-5 py-4 max-sm:flex-col max-sm:items-start">
                    <span className="min-w-0 max-w-full">
                      <span className="block truncate font-bold">{r.title}</span>
                      <span className="mt-1 block text-xs text-slate">
                        {r.owner_id === s.user.id ? "Owned by you" : "Owned by a colleague"} · review by {r.review_date ?? "not set"}
                      </span>
                    </span>
                    <span className="flex shrink-0 gap-2">
                      {!r.published && <span className="rounded-full bg-light px-2.5 py-1 text-[11px] font-bold text-slate">Draft</span>}
                      <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-bold", overdue ? "bg-orange-50 text-orange-800" : "bg-green-050 text-green-700")}>
                        {overdue ? "Review overdue" : "Current"}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState title="The library is empty" body="Write the first guide. You'll own it and set when it should be reviewed." />
        )}
      </Section>
    </>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<Section><p className="text-slate">Loading the library…</p></Section>}>
      <Library />
    </Suspense>
  );
}
