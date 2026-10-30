import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireGrant } from "@/lib/authz";
import { createInsForgeServerClient } from "@/lib/insforge/server";
import { EmptyState, Section } from "@/components/portal/primitives";
import { PortalBand } from "@/components/portal/portal";
import { fieldCls } from "@/components/site/form-bits";

export const metadata: Metadata = { title: "Audit log" };

type Row = { id: number; actor_id: string | null; action: string; entity: string; entity_id: string | null; before: object | null; after: object | null; at: string };
type Props = { searchParams: Promise<{ entity?: string; action?: string; page?: string }> };
const PAGE = 50;

async function Audit({ searchParams }: Props) {
  await requireGrant("portal_admin");
  const f = await searchParams;
  const page = Math.max(0, Number(f.page) || 0);
  const db = (await createInsForgeServerClient()).database;
  // append-only (trigger-enforced); readable by portal admins only (RLS)
  let q = db.from("audit_log").select("id, actor_id, action, entity, entity_id, before, after, at", { count: "exact" }).order("at", { ascending: false }).range(page * PAGE, page * PAGE + PAGE - 1);
  if (f.entity && /^[a-z_]{2,40}$/.test(f.entity)) q = q.eq("entity", f.entity);
  if (f.action && ["insert", "update", "delete"].includes(f.action)) q = q.eq("action", f.action);
  const [{ data, count }, { data: dir }] = await Promise.all([q, db.rpc("employee_directory")]);
  const rows = (data ?? []) as Row[];
  const who = new Map(((dir ?? []) as { user_id: string; email: string }[]).map((e) => [e.user_id, e.email]));
  const qs = (p: number) => `/s/audit?${new URLSearchParams({ ...(f.entity ? { entity: f.entity } : {}), ...(f.action ? { action: f.action } : {}), page: String(p) })}`;

  return (
    <>
      <PortalBand eyebrow="Staff console · Administration" title="Audit log" lead="Every change to governed data, written by database triggers. Nobody can edit or delete it, including administrators." />
      <Section className="py-12">
        <form className="mb-6 flex flex-wrap items-end gap-3">
          <label className="grid gap-1.5 text-[13px] font-bold">Entity<input name="entity" defaultValue={f.entity} placeholder="e.g. contributions" className={fieldCls} /></label>
          <label className="grid gap-1.5 text-[13px] font-bold">
            Action
            <select name="action" defaultValue={f.action ?? ""} className={fieldCls}>
              <option value="">Any</option><option value="insert">Insert</option><option value="update">Update</option><option value="delete">Delete</option>
            </select>
          </label>
          <button className="rounded-[5px] bg-navy px-5 py-3 text-sm font-bold text-white">Filter</button>
          <p className="ml-auto text-sm text-slate" role="status">{count ?? 0} entries</p>
        </form>
        {rows.length ? (
          <ul className="grid grid-cols-1 gap-2">
            {rows.map((r) => (
              <li key={r.id} className="rounded-lg border border-line bg-white px-4 py-3 text-sm">
                <details>
                  <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2">
                    <span className="min-w-0"><strong className="uppercase">{r.action}</strong> · {r.entity} <span className="font-mono text-xs text-slate">{r.entity_id?.slice(0, 8)}</span></span>
                    <span className="text-xs text-slate">{r.actor_id ? who.get(r.actor_id) ?? `client user ${r.actor_id.slice(0, 8)}` : "system"} · {new Date(r.at).toLocaleString("en-GB")}</span>
                  </summary>
                  <div className="mt-3 grid grid-cols-2 gap-3 max-md:grid-cols-1">
                    {(["before", "after"] as const).map((k) => (
                      <div key={k} className="min-w-0">
                        <p className="text-xs font-bold text-slate uppercase">{k}</p>
                        <pre className="mt-1 max-h-64 overflow-auto rounded bg-light p-2 text-[11px] whitespace-pre-wrap break-all">{r[k] ? JSON.stringify(r[k], null, 1) : "—"}</pre>
                      </div>
                    ))}
                  </div>
                </details>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="No entries" body="Try a different filter." />
        )}
        <nav aria-label="Pages" className="mt-6 flex justify-between text-sm font-bold">
          {page > 0 ? <Link href={qs(page - 1)} className="text-green-700 hover:underline">Newer</Link> : <span />}
          {(count ?? 0) > (page + 1) * PAGE && <Link href={qs(page + 1)} className="text-green-700 hover:underline">Older</Link>}
        </nav>
      </Section>
    </>
  );
}

export default function Page(props: Props) {
  return (
    <Suspense fallback={<Section><p className="text-slate">Loading the audit log…</p></Section>}>
      <Audit {...props} />
    </Suspense>
  );
}
