import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ArrowLeft, Bookmark, BookmarkCheck } from "lucide-react";
import { requireMember } from "@/lib/authz";
import { createInsForgeServerClient } from "@/lib/insforge/server";
import { TYPES } from "@/lib/contributions/model";
import { SHARED_COLS, type Shared, period } from "@/lib/learning/model";
import { setFeedback, toggleBookmark } from "@/lib/learning/collab";
import { Section } from "@/components/portal/primitives";
import { Panel, PortalBand } from "@/components/portal/portal";
import { CommentThread } from "@/components/portal/comments";
import { cn } from "@/lib/utils";
import { ReportButton } from "../report-button";

export const metadata: Metadata = { title: "Shared contribution" };

const pill = "inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-bold";

async function Item({ params }: { params: Promise<{ id: string }> }) {
  const s = await requireMember();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const db = (await createInsForgeServerClient()).database;
  const [{ data }, { data: bm }, { data: fb }] = await Promise.all([
    db.from("shared_contributions").select(`${SHARED_COLS}, offerings(name)`).eq("id", id).maybeSingle(),
    db.from("bookmarks").select("shared_id").eq("shared_id", id),
    db.from("shared_feedback").select("kind").eq("shared_id", id),
  ]);
  if (!data) notFound(); // RLS: only live, approved copies exist for members
  const item = data as unknown as Shared & { offerings: { name: string } | null };
  const saved = !!bm?.length;
  const mine = (fb?.[0] as { kind: string } | undefined)?.kind ?? null;
  const back = `/learning/${id}`;

  return (
    <>
      <PortalBand eyebrow={`${TYPES[item.type as keyof typeof TYPES]}${item.offerings ? ` · ${item.offerings.name}` : ""}`} title={<span className="break-words">{item.title}</span>}>
        <Link href="/learning" className="inline-flex items-center gap-2 rounded-[5px] border border-white/40 px-5 py-3 text-sm font-bold hover:border-green hover:text-green">
          <ArrowLeft className="size-4" aria-hidden /> Shared feed
        </Link>
      </PortalBand>
      <Section className="py-12">
        <div className="grid grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] gap-6 max-[959px]:grid-cols-1">
          <div className="grid content-start gap-6">
            <Panel title="Approved contribution">
              <p className="text-[15px] leading-[1.75] whitespace-pre-wrap">{item.body}</p>
              <p className="mt-5 border-t border-line pt-4 text-xs text-slate">
                {[item.industry, item.region, period(item.period_start, item.period_end)].filter(Boolean).join(" · ")}
                {item.attributed_org_name ? ` · Shared by ${item.attributed_org_name}` : " · Contributor not disclosed"}
              </p>
            </Panel>
            <Panel title="Comments">
              <CommentThread type="shared" parentId={id} back={back} moderator={s.grants.includes("moderate")} />
            </Panel>
          </div>
          <div className="grid content-start gap-6">
            <Panel title="Your take">
              <div className="grid gap-4">
                <form action={toggleBookmark.bind(null, id, !saved)}>
                  <button aria-pressed={saved} className={cn(pill, saved ? "border-green-700 bg-green-050 text-green-700" : "border-line-strong")}>
                    {saved ? <BookmarkCheck className="size-4" aria-hidden /> : <Bookmark className="size-4" aria-hidden />}
                    {saved ? "Bookmarked" : "Bookmark"}
                  </button>
                </form>
                <div>
                  <p className="mb-2 text-xs font-bold text-slate">Was this useful? Only the contributor and moderators see the totals.</p>
                  <div className="flex flex-wrap gap-2">
                    {(["useful", "needs_evidence"] as const).map((k) => (
                      <form key={k} action={setFeedback.bind(null, id, mine === k ? null : k)}>
                        <button aria-pressed={mine === k} className={cn(pill, mine === k ? "border-green-700 bg-green-050 text-green-700" : "border-line-strong")}>
                          {k === "useful" ? "Useful" : "Needs evidence"}
                        </button>
                      </form>
                    ))}
                  </div>
                </div>
                <ReportButton id={id} />
              </div>
            </Panel>
          </div>
        </div>
      </Section>
    </>
  );
}

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<Section><p className="text-slate">Loading…</p></Section>}>
      <Item params={params} />
    </Suspense>
  );
}
