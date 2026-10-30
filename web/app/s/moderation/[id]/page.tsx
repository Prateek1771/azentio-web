import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireGrant } from "@/lib/authz";
import { createInsForgeServerClient } from "@/lib/insforge/server";
import { CONFIDENCE, type Consents, type Contribution, EVIDENCE, TYPES } from "@/lib/contributions/model";
import { piiLabel } from "@/lib/contributions/pii";
import { Section } from "@/components/portal/primitives";
import { Panel, PortalBand } from "@/components/portal/portal";
import { FeedbackTally, StateBadge } from "@/components/portal/contributions";
import { ModerationActions, SharedCopyForm } from "./panel";

export const metadata: Metadata = { title: "Review contribution" };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ done?: string }> };

async function Review({ params, searchParams }: Props) {
  await requireGrant("moderate");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const db = (await createInsForgeServerClient()).database;
  const [{ data }, { data: consentRows }, { data: versions }, { data: files }] = await Promise.all([
    db.from("contributions").select("*, offerings(name)").eq("id", id).maybeSingle(),
    db.from("consents").select("store, publish, attribute, train").eq("contribution_id", id).order("id", { ascending: false }).limit(1),
    db.from("contribution_versions").select("version, created_at").eq("contribution_id", id).order("version", { ascending: false }),
    db.from("contribution_attachments").select("id, name").eq("contribution_id", id).order("at"),
  ]);
  if (!data) notFound(); // RLS: drafts, private and org-only items don't exist for moderators
  const c = data as Contribution & { offerings: { name: string } | null };
  const consent = (consentRows?.[0] ?? null) as Consents | null;
  // duplicate detection (trigram, deterministic): approved copies that read like this proposal
  const { data: dupRows } = c.state === "submitted" ? await db.rpc("similar_shared", { p_text: `${c.title} ${c.body}`, p_limit: 5 }) : { data: [] };
  const dups = ((dupRows ?? []) as { id: string; title: string; similarity: number }[]).filter((d) => d.similarity >= 0.35);
  const done = (await searchParams).done;

  return (
    <>
      <PortalBand eyebrow={`Review · ${TYPES[c.type as keyof typeof TYPES]} · version ${c.version}`} title={<span className="break-words">{c.title}</span>}>
        <Link href="/s/moderation" className="inline-flex items-center gap-2 rounded-[5px] border border-white/40 px-5 py-3 text-sm font-bold hover:border-green hover:text-green">
          <ArrowLeft className="size-4" aria-hidden /> Queue
        </Link>
      </PortalBand>
      <Section className="py-12">
        {done === "published" && (
          <p role="status" className="mb-6 rounded-md border border-green/40 bg-green-050 px-4 py-3 text-sm">
            Published. The reviewed copy is now in the shared feed; the contributor has been notified.
          </p>
        )}
        <div className="grid grid-cols-2 gap-6 max-[959px]:grid-cols-1">
          <Panel title="Source (private)" action={<StateBadge state={c.state} />}>
            {c.pii_flags.length > 0 && (
              <p className="mb-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                Sensitive data flagged: {c.pii_flags.map((f) => piiLabel[f] ?? f).join(", ")}.
              </p>
            )}
            <p className="text-[15px] leading-[1.75] whitespace-pre-wrap">{c.body}</p>
            <dl className="mt-5 grid grid-cols-2 gap-3 border-t border-line pt-4 text-sm">
              {[
                ["Offering", c.offerings?.name ?? "General"],
                ["Evidence", EVIDENCE[c.evidence_type as keyof typeof EVIDENCE]],
                ["Confidence", CONFIDENCE[c.confidence as keyof typeof CONFIDENCE]],
                ["Period", c.period_start ? `${c.period_start} → ${c.period_end ?? "ongoing"}` : "—"],
                ["Consents", consent ? (["store", "publish", "attribute", "train"] as const).filter((k) => consent[k]).join(", ") || "none" : "none"],
                ["Earlier versions", String(versions?.length ?? 0)],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="text-xs font-bold text-slate">{k}</dt>
                  <dd className="mt-0.5 font-bold">{v}</dd>
                </div>
              ))}
            </dl>
            {c.moderator_reason && <p className="mt-4 text-sm text-slate">Last reason given: “{c.moderator_reason}”</p>}
            {!!files?.length && (
              <div className="mt-4 border-t border-line pt-4 text-sm">
                <p className="text-xs font-bold text-slate">Attachments (private; never part of the shared copy)</p>
                <ul className="mt-1.5 grid grid-cols-1 gap-1">
                  {(files as { id: string; name: string }[]).map((f) => (
                    <li key={f.id} className="min-w-0 truncate"><a href={`/api/attachments/${f.id}`} className="font-bold text-green-700 hover:underline">{f.name}</a></li>
                  ))}
                </ul>
              </div>
            )}
          </Panel>

          <div className="grid content-start gap-6">
            {dups.length > 0 && (
              <section aria-label="Possible duplicates" className="rounded-[10px] border border-amber-300 bg-amber-50 p-5 text-sm">
                <p className="font-bold text-amber-900">Possible duplicates already in the shared feed</p>
                <ul className="mt-2 grid grid-cols-1 gap-1">
                  {dups.map((d) => (
                    <li key={d.id} className="min-w-0 truncate">
                      <a href={`/learning/${d.id}`} className="font-bold text-green-700 hover:underline">{d.title}</a>{" "}
                      <span className="text-xs text-amber-900">({Math.round(d.similarity * 100)}% similar)</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-amber-900">Consider linking it to the same theme rather than publishing a near-copy.</p>
              </section>
            )}
            {c.state === "submitted" && (
              <Panel title="Shared copy (what the community will see)">
                <SharedCopyForm
                  id={c.id}
                  draft={{ title: c.title, body: c.body, industry: c.industry ?? "", region: c.region ?? "" }}
                  attribution={consent?.attribute ? "the contributor's organisation" : null}
                />
              </Panel>
            )}
            {["published", "unpublished"].includes(c.state) && <FeedbackTally contribution={c.id} />}
            <Panel title="Decision">
              <ModerationActions id={c.id} state={c.state} />
            </Panel>
          </div>
        </div>
      </Section>
    </>
  );
}

export default function Page(props: Props) {
  return (
    <Suspense fallback={<Section><p className="text-slate">Loading…</p></Section>}>
      <Review {...props} />
    </Suspense>
  );
}
