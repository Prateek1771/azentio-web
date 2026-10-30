import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CalendarClock, CheckCircle2 } from "lucide-react";
import { requireOrg } from "@/lib/authz";
import { createInsForgeServerClient } from "@/lib/insforge/server";
import { EmptyState, Section } from "@/components/portal/primitives";
import { Panel, PortalBand } from "@/components/portal/portal";

export const metadata: Metadata = { title: "Resources" };

const KIND: Record<string, string> = { briefing: "Briefing", release_note: "Release note", library: "Resource" };
// sessions that started up to 2 hours ago still count as "upcoming" (they may be running)
const recentCutoff = () => new Date(Date.now() - 2 * 36e5).toISOString();
const when = (d: string) => new Date(d).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

async function Resources({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await requireOrg((await params).org);
  const db = (await createInsForgeServerClient()).database;
  // RLS decides the audience: public, offerings this org is entitled to, or this org only.
  const [{ data: items }, { data: sessions }, { data: acks }] = await Promise.all([
    db.from("content").select("id, kind, title, updated_at, offerings(name)").in("kind", ["briefing", "release_note", "library"]).eq("published", true).order("updated_at", { ascending: false }).limit(50),
    db.from("live_sessions").select("id, title, starts_at, is_live, offerings(name)").in("audience", ["client_entitled", "org_private"]).or(`is_live.eq.true,starts_at.gte.${recentCutoff()}`).order("starts_at"),
    db.from("acknowledgements").select("content_id"),
  ]);
  const rows = (items ?? []) as unknown as { id: string; kind: string; title: string; updated_at: string; offerings: { name: string } | null }[];
  const webinars = (sessions ?? []) as unknown as { id: string; title: string; starts_at: string | null; is_live: boolean; offerings: { name: string } | null }[];
  const acked = new Set(((acks ?? []) as { content_id: string }[]).map((a) => a.content_id));
  const base = `/c/${org.slug}/resources`;

  return (
    <>
      <PortalBand eyebrow={`${org.name} · Resources`} title="Briefings, release notes & webinars" lead="Material for the Azentio offerings your organisation uses. Acknowledge briefings so your Azentio team knows they've landed." />
      <Section className="py-12">
        <div className="grid grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] gap-6 max-[959px]:grid-cols-1">
          <Panel title="Briefings & release notes">
            {rows.length ? (
              <ul className="grid grid-cols-1 gap-2">
                {rows.map((r) => (
                  <li key={r.id}>
                    <Link href={`${base}/${r.id}`} className="lift flex items-center justify-between gap-3 rounded-lg border border-line bg-white px-4 py-3 text-sm">
                      <span className="min-w-0">
                        <span className="block truncate font-bold">{r.title}</span>
                        <span className="text-xs text-slate">{KIND[r.kind]}{r.offerings && ` · ${r.offerings.name}`}</span>
                      </span>
                      {acked.has(r.id) && (
                        <span className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-green-700"><CheckCircle2 className="size-3.5" aria-hidden /> Acknowledged</span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="Nothing published yet" body="Briefings and release notes for your offerings will appear here." />
            )}
          </Panel>
          <Panel title="Upcoming webinars">
            {webinars.length ? (
              <ul className="grid grid-cols-1 gap-2">
                {webinars.map((w) => (
                  <li key={w.id} className="rounded-lg bg-light px-4 py-3 text-sm">
                    <span className="block font-bold">{w.title}</span>
                    <span className="mt-1 inline-flex items-center gap-1.5 text-xs text-slate">
                      <CalendarClock className="size-3.5" aria-hidden />
                      {w.is_live ? "Live now" : w.starts_at ? when(w.starts_at) : "Time to be confirmed"}{w.offerings && ` · ${w.offerings.name}`}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="No webinars scheduled" body="Invite-only sessions for your organisation's offerings appear here." />
            )}
          </Panel>
        </div>
      </Section>
    </>
  );
}

export default function Page({ params }: { params: Promise<{ org: string }> }) {
  return (
    <Suspense fallback={<Section><p className="text-slate">Loading resources…</p></Section>}>
      <Resources params={params} />
    </Suspense>
  );
}
