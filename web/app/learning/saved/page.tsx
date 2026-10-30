import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireMember } from "@/lib/authz";
import { createInsForgeServerClient } from "@/lib/insforge/server";
import { deleteSavedSearch } from "@/lib/learning/collab";
import { EmptyState, Section } from "@/components/portal/primitives";
import { Panel, PortalBand } from "@/components/portal/portal";

export const metadata: Metadata = { title: "Saved" };

const row = "flex items-center justify-between gap-3 rounded-lg bg-light px-4 py-3 text-sm";

async function Saved() {
  await requireMember();
  const db = (await createInsForgeServerClient()).database;
  const [{ data: bookmarks }, { data: searches }] = await Promise.all([
    // RLS on shared copies: a bookmark to something withdrawn or hidden simply drops out
    db.from("bookmarks").select("at, shared_contributions(id, title)").order("at", { ascending: false }),
    db.from("saved_searches").select("id, name, query").order("at", { ascending: false }),
  ]);
  const items = ((bookmarks ?? []) as unknown as { shared_contributions: { id: string; title: string } | null }[]).map((b) => b.shared_contributions).filter(Boolean) as { id: string; title: string }[];
  const saved = (searches ?? []) as { id: string; name: string; query: Record<string, string> }[];

  return (
    <>
      <PortalBand eyebrow="Community learning" title="Saved" lead="Your bookmarks and saved searches. Only you can see them." />
      <Section className="py-12">
        <div className="grid grid-cols-2 gap-6 max-md:grid-cols-1">
          <Panel title={`Bookmarks (${items.length})`}>
            {items.length ? (
              <ul className="grid grid-cols-1 gap-2">
                {items.map((b) => (
                  <li key={b.id}><Link href={`/learning/${b.id}`} className={`${row} lift font-bold`}><span className="min-w-0 truncate">{b.title}</span></Link></li>
                ))}
              </ul>
            ) : (
              <EmptyState title="No bookmarks" body="Bookmark approved contributions from the shared feed to find them here." />
            )}
          </Panel>
          <Panel title={`Saved searches (${saved.length})`}>
            {saved.length ? (
              <ul className="grid grid-cols-1 gap-2">
                {saved.map((s) => (
                  <li key={s.id} className={row}>
                    <Link href={`/learning?${new URLSearchParams(s.query)}`} className="min-w-0 truncate font-bold text-green-700 hover:underline">{s.name}</Link>
                    <form action={deleteSavedSearch}>
                      <input type="hidden" name="id" value={s.id} />
                      <button className="shrink-0 text-xs font-bold text-orange-800 hover:underline">Delete</button>
                    </form>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="No saved searches" body="Search the shared feed, then choose “Save this search”." />
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
      <Saved />
    </Suspense>
  );
}
