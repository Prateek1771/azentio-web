import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Search } from "lucide-react";
import { requireMember } from "@/lib/authz";
import { createInsForgeServerClient } from "@/lib/insforge/server";
import { TYPES } from "@/lib/contributions/model";
import { SHARED_COLS, type Shared, period } from "@/lib/learning/model";
import { EmptyState, Section } from "@/components/portal/primitives";
import { PortalBand } from "@/components/portal/portal";
import { fieldCls } from "@/components/site/form-bits";
import { ReportButton } from "./report-button";
import { saveSearch } from "@/lib/learning/collab";

export const metadata: Metadata = { title: "Community learning" };

type Q = { q?: string; offering?: string; industry?: string; region?: string; year?: string; type?: string };
type Props = { searchParams: Promise<Q> };

async function Feed({ searchParams }: Props) {
  await requireMember();
  const f = await searchParams;
  const db = (await createInsForgeServerClient()).database;
  const { data: offs } = await db.from("offerings").select("id, slug, name").order("name");
  const offerings = (offs ?? []) as { id: string; slug: string; name: string }[];

  // Read through RLS: only live, moderator-approved copies; the count follows the same visibility.
  let q = db.from("shared_contributions").select(SHARED_COLS, { count: "exact" }).order("published_at", { ascending: false }).limit(50);
  if (f.q?.trim()) q = q.textSearch("tsv", f.q.trim().slice(0, 200), { type: "websearch", config: "english" });
  const off = offerings.find((o) => o.slug === f.offering);
  if (off) q = q.eq("offering_id", off.id);
  if (f.industry?.trim()) q = q.ilike("industry", `%${f.industry.trim().slice(0, 80)}%`);
  if (f.region?.trim()) q = q.ilike("region", `%${f.region.trim().slice(0, 80)}%`);
  if (f.type && f.type in TYPES) q = q.eq("type", f.type);
  if (/^\d{4}$/.test(f.year ?? "")) q = q.lte("period_start", `${f.year}-12-31`).gte("period_end", `${f.year}-01-01`);
  const { data, count } = await q;
  const rows = (data ?? []) as Shared[];
  const name = new Map(offerings.map((o) => [o.id, o.name]));
  const year = new Date().getFullYear();

  return (
    <>
      <PortalBand
        eyebrow="Community learning"
        title="What the community is seeing"
        lead="Moderator-approved, de-identified observations from across Azentio's clients. Patterns, not proof: read each with its period and evidence in mind."
      />
      <Section className="py-12">
        <form role="search" className="mb-8 grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_auto] items-end gap-3 max-[1100px]:grid-cols-3 max-sm:grid-cols-1">
          <label className="grid gap-1.5 text-[13px] font-bold">
            Search
            <input name="q" defaultValue={f.q} placeholder="e.g. seasonal cash flow" className={fieldCls} />
          </label>
          <label className="grid gap-1.5 text-[13px] font-bold">
            Offering
            <select name="offering" defaultValue={f.offering ?? ""} className={fieldCls}>
              <option value="">All</option>
              {offerings.map((o) => <option key={o.slug} value={o.slug}>{o.name}</option>)}
            </select>
          </label>
          <label className="grid gap-1.5 text-[13px] font-bold">
            Topic
            <select name="type" defaultValue={f.type ?? ""} className={fieldCls}>
              <option value="">All</option>
              {Object.entries(TYPES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </label>
          <label className="grid gap-1.5 text-[13px] font-bold">
            Industry
            <input name="industry" defaultValue={f.industry} className={fieldCls} />
          </label>
          <label className="grid gap-1.5 text-[13px] font-bold">
            Region
            <input name="region" defaultValue={f.region} className={fieldCls} />
          </label>
          <label className="grid gap-1.5 text-[13px] font-bold">
            Period
            <select name="year" defaultValue={f.year ?? ""} className={fieldCls}>
              <option value="">Any</option>
              {[0, 1, 2, 3].map((d) => <option key={d} value={year - d}>{year - d}</option>)}
            </select>
          </label>
          <button className="inline-flex items-center justify-center gap-2 rounded-[5px] bg-navy px-5 py-3 text-sm font-bold text-white">
            <Search className="size-4" aria-hidden /> Search
          </button>
        </form>

        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate" role="status">
            {count ?? 0} approved contribution{count === 1 ? "" : "s"}
          </p>
          {Object.values(f).some(Boolean) && (
            <form action={saveSearch} className="flex gap-2">
              {Object.entries(f).map(([k, v]) => v && <input key={k} type="hidden" name={k} value={v} />)}
              <input name="name" required maxLength={80} aria-label="Name for this search" placeholder="Name this search" className={`${fieldCls} py-2 text-sm`} />
              <button className="shrink-0 rounded-[5px] border border-line-strong px-3 text-xs font-bold hover:border-green-700">Save this search</button>
            </form>
          )}
        </div>
        {rows.length ? (
          <ul className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
            {rows.map((s) => (
              <li key={s.id}>
                <article className="grid h-full content-start gap-3 rounded-[10px] border-l-4 border-green bg-white p-6 shadow-[0_1px_0_var(--line)]">
                  <p className="text-[11px] font-extrabold tracking-[2px] text-green-700 uppercase">
                    {TYPES[s.type as keyof typeof TYPES]}{s.offering_id && ` · ${name.get(s.offering_id)}`}
                  </p>
                  <h2 className="text-[18px] leading-snug font-bold">
                    <Link href={`/learning/${s.id}`} className="hover:text-green-700 hover:underline">{s.title}</Link>
                  </h2>
                  <p className="text-sm leading-[1.7] whitespace-pre-wrap text-ink">{s.body}</p>
                  <p className="text-xs text-slate">
                    {[s.industry, s.region, period(s.period_start, s.period_end)].filter(Boolean).join(" · ")}
                    {s.attributed_org_name ? ` · Shared by ${s.attributed_org_name}` : " · Contributor not disclosed"}
                  </p>
                  <ReportButton id={s.id} />
                </article>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="No approved contributions match" body="Try fewer filters. Only moderator-approved, de-identified contributions appear here." />
        )}
      </Section>
    </>
  );
}

export default function Page(props: Props) {
  return (
    <Suspense fallback={<Section><p className="text-slate">Loading the shared feed…</p></Section>}>
      <Feed {...props} />
    </Suspense>
  );
}
