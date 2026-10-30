import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireEmployee } from "@/lib/authz";
import { createInsForgeServerClient } from "@/lib/insforge/server";
import { Section } from "@/components/portal/primitives";
import { Panel, PortalBand } from "@/components/portal/portal";
import { LibraryForm, type LibraryInit } from "../../workspace-forms";

export const metadata: Metadata = { title: "Library entry" };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ edit?: string }> };
type Row = { id: string; title: string; body: string; review_date: string | null; published: boolean; owner_id: string | null };
const inAYear = () => new Date(Date.now() + 365 * 864e5).toISOString().slice(0, 10);
const today = () => new Date().toISOString().slice(0, 10);

async function Entry({ params, searchParams }: Props) {
  const s = await requireEmployee();
  const { id } = await params;
  const isNew = id === "new";
  if (!isNew && !/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { data } = isNew
    ? { data: null }
    : await (await createInsForgeServerClient()).database.from("content").select("id, title, body, review_date, published, owner_id").eq("id", id).eq("kind", "library").eq("audience", "employee").maybeSingle();
  const r = data as Row | null;
  if (!isNew && !r) notFound();
  const mine = isNew || r!.owner_id === s.user.id;
  const editing = isNew || (mine && (await searchParams).edit === "1");
  const init: LibraryInit = r ? { title: r.title, body: r.body, review_date: r.review_date ?? inAYear(), published: r.published } : { title: "", body: "", review_date: inAYear(), published: true };
  const overdue = r?.review_date ? r.review_date < today() : false;

  return (
    <>
      <PortalBand eyebrow="Knowledge library" title={<span className="break-words">{isNew ? "New entry" : r!.title}</span>}>
        <Link href="/e/library" className="inline-flex items-center gap-2 rounded-[5px] border border-white/40 px-5 py-3 text-sm font-bold hover:border-green hover:text-green">
          <ArrowLeft className="size-4" aria-hidden /> Library
        </Link>
        {!editing && mine && <Link href={`/e/library/${id}?edit=1`} className="rounded-[5px] bg-green px-5 py-3 text-sm font-bold text-on-green">Edit</Link>}
      </PortalBand>
      <Section className="py-12">
        {editing ? (
          <Panel title="Entry"><LibraryForm id={isNew ? null : id} init={init} /></Panel>
        ) : (
          <div className="grid gap-6">
            {overdue && (
              <p role="note" className="rounded-[10px] border border-orange-300 bg-orange-50 px-5 py-4 text-sm text-orange-900">
                This entry was due for review on {r!.review_date}. {mine ? "Check it's still right and set a new review date." : "Its owner has been asked to review it; treat it with care."}
              </p>
            )}
            <Panel title={r!.published ? "Published to employees" : "Draft (only you)"}>
              <p className="text-[15px] leading-[1.75] whitespace-pre-wrap">{r!.body}</p>
              <p className="mt-5 border-t border-line pt-4 text-xs text-slate">{mine ? "You own this entry" : "Owned by a colleague"} · review by {r!.review_date ?? "not set"}</p>
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
      <Entry {...props} />
    </Suspense>
  );
}
