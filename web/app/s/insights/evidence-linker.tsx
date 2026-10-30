import { Search } from "lucide-react";
import { createInsForgeServerClient } from "@/lib/insforge/server";
import { toggleLink } from "@/lib/learning/actions";
import { fieldCls } from "@/components/site/form-bits";

// Link approved shared contributions to a theme or an idea. Search runs through RLS (live copies only).
export async function EvidenceLinker({ table, owner, linked, q }: { table: "theme_links" | "idea_evidence"; owner: string; linked: { id: string; title: string }[]; q?: string }) {
  const db = (await createInsForgeServerClient()).database;
  let query = db.from("shared_contributions").select("id, title, industry, region").eq("status", "live").order("published_at", { ascending: false }).limit(10);
  if (q?.trim()) query = query.textSearch("tsv", q.trim().slice(0, 200), { type: "websearch", config: "english" });
  const { data } = await query;
  const ids = new Set(linked.map((l) => l.id));
  const results = ((data ?? []) as { id: string; title: string; industry: string | null; region: string | null }[]).filter((r) => !ids.has(r.id));
  const action = toggleLink.bind(null, table);
  const row = "flex items-center justify-between gap-3 rounded-lg bg-light px-4 py-2.5 text-sm";
  const btn = "shrink-0 rounded-[5px] border px-3 py-1 text-xs font-bold";

  return (
    <div className="grid gap-5">
      <div>
        <h3 className="mb-2 text-sm font-bold">Linked evidence ({linked.length})</h3>
        {linked.length ? (
          <ul className="grid grid-cols-1 gap-2">
            {linked.map((l) => (
              <li key={l.id} className={row}>
                <span className="min-w-0 truncate">{l.title}</span>
                <form action={action}>
                  <input type="hidden" name="owner" value={owner} />
                  <input type="hidden" name="shared" value={l.id} />
                  <button name="op" value="remove" className={`${btn} border-orange-300 text-orange-800`}>Remove</button>
                </form>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate">Nothing linked yet.</p>
        )}
      </div>
      <form role="search" className="flex gap-2">
        <input name="q" defaultValue={q} aria-label="Search approved contributions" placeholder="Search approved contributions" className={fieldCls} />
        <button className="inline-flex items-center gap-2 rounded-[5px] bg-navy px-4 text-sm font-bold text-white">
          <Search className="size-4" aria-hidden /> Find
        </button>
      </form>
      <ul className="grid grid-cols-1 gap-2">
        {results.map((r) => (
          <li key={r.id} className={row}>
            <span className="min-w-0">
              <span className="block truncate font-bold">{r.title}</span>
              <span className="text-xs text-slate">{[r.industry, r.region].filter(Boolean).join(" · ")}</span>
            </span>
            <form action={action}>
              <input type="hidden" name="owner" value={owner} />
              <input type="hidden" name="shared" value={r.id} />
              <button name="op" value="add" className={`${btn} border-green-700 text-green-700`}>Link</button>
            </form>
          </li>
        ))}
      </ul>
    </div>
  );
}
