import type { Metadata } from "next";
import { Suspense } from "react";
import { Users } from "lucide-react";
import { requireMember } from "@/lib/authz";
import { createInsForgeServerClient } from "@/lib/insforge/server";
import { CONFIDENCE } from "@/lib/contributions/model";
import { type ThemeStat, orgCountLabel, period } from "@/lib/learning/model";
import { EmptyState, Section } from "@/components/portal/primitives";
import { PortalBand } from "@/components/portal/portal";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Themes" };

type Theme = {
  id: string;
  name: string;
  summary: string;
  limitations: string | null;
  confidence: keyof typeof CONFIDENCE;
  offering_ids: string[];
  status: string;
  updated_at: string;
  theme_links: { shared_contributions: { id: string; title: string } | null }[];
};

async function Themes() {
  await requireMember();
  const db = (await createInsForgeServerClient()).database;
  const [{ data }, { data: stats }, { data: offs }] = await Promise.all([
    db.from("themes").select("id, name, summary, limitations, confidence, offering_ids, status, updated_at, theme_links(shared_contributions(id, title))").order("updated_at", { ascending: false }),
    db.rpc("theme_stats"),
    db.from("offerings").select("id, name"),
  ]);
  const themes = (data ?? []) as unknown as Theme[];
  const stat = new Map(((stats ?? []) as ThemeStat[]).map((s) => [s.theme_id, s]));
  const offering = new Map(((offs ?? []) as { id: string; name: string }[]).map((o) => [o.id, o.name]));

  return (
    <>
      <PortalBand
        eyebrow="Community learning"
        title="Themes"
        lead="Patterns moderators and product owners see across approved contributions. Counts show distinct organisations, never posts, and are hidden below three so no single client can be singled out."
      />
      <Section className="py-12">
        {themes.length ? (
          <ul className="grid grid-cols-1 gap-5">
            {themes.map((t) => {
              const s = stat.get(t.id);
              const evidence = t.theme_links.map((l) => l.shared_contributions).filter(Boolean) as { id: string; title: string }[];
              return (
                <li key={t.id}>
                  <article aria-labelledby={`theme-${t.id}`} className="grid gap-4 rounded-[10px] border border-line bg-white p-7">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-extrabold tracking-[2px] text-green-700 uppercase">
                          {t.offering_ids.map((o) => offering.get(o)).filter(Boolean).join(" · ") || "Cross-offering"}
                          {t.status === "draft" && " · Draft (staff only)"}
                        </p>
                        <h2 id={`theme-${t.id}`} className="mt-1 text-[22px] font-bold">{t.name}</h2>
                      </div>
                      <span className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold", s?.org_count === null || !s ? "bg-amber-50 text-amber-800" : "bg-green-050 text-green-700")}>
                        <Users className="size-3.5" aria-hidden /> {orgCountLabel(s)}
                      </span>
                    </div>
                    <p className="text-[15px] leading-[1.7]">{t.summary}</p>
                    <dl className="grid grid-cols-3 gap-4 text-sm max-sm:grid-cols-1">
                      <div><dt className="text-xs font-bold text-slate">Approved evidence</dt><dd className="font-bold">{s?.evidence_count ?? 0} contribution{s?.evidence_count === 1 ? "" : "s"}</dd></div>
                      <div><dt className="text-xs font-bold text-slate">Observation period</dt><dd className="font-bold">{period(s?.period_start ?? null, s?.period_end ?? null)}</dd></div>
                      <div><dt className="text-xs font-bold text-slate">Confidence</dt><dd className="font-bold">{CONFIDENCE[t.confidence]}</dd></div>
                    </dl>
                    <p className="rounded-md bg-light px-4 py-3 text-sm text-slate">
                      <strong className="text-ink">Limitations:</strong> {t.limitations || "Based only on contributions clients chose to share; not a measure of market prevalence."}
                      {s?.small_sample && " Small sample: treat as an early signal."}
                    </p>
                    {evidence.length > 0 && (
                      <details>
                        <summary className="cursor-pointer text-sm font-bold text-green-700">Linked evidence ({evidence.length})</summary>
                        <ul className="mt-2 grid gap-1.5 text-sm">
                          {evidence.map((e) => <li key={e.id}>· {e.title}</li>)}
                        </ul>
                      </details>
                    )}
                    <p className="text-xs text-slate">Last updated {new Date(t.updated_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</p>
                  </article>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState title="No themes yet" body="Themes appear once product owners group enough approved contributions." />
        )}
      </Section>
    </>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<Section><p className="text-slate">Loading themes…</p></Section>}>
      <Themes />
    </Suspense>
  );
}
