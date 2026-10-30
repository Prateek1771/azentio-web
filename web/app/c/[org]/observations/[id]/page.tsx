import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ArrowLeft, Eye, Pencil } from "lucide-react";
import { requireOrg } from "@/lib/authz";
import { discardDraft, transition } from "@/lib/contributions/actions";
import { CONFIDENCE, CONSENTS, type Consents, EVIDENCE, NOTIFY, TYPES, VISIBILITY, whoCanSee } from "@/lib/contributions/model";
import { piiLabel } from "@/lib/contributions/pii";
import { Section } from "@/components/portal/primitives";
import { Panel, PortalBand } from "@/components/portal/portal";
import { StateBadge } from "@/components/portal/contributions";
import { loadContribution } from "../queries";

export const metadata: Metadata = { title: "Observation" };

type Props = { params: Promise<{ org: string; id: string }>; searchParams: Promise<{ error?: string }> };

const when = (d: string) => new Date(d).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
const btn = "inline-flex items-center gap-2 rounded-[5px] px-4 py-2.5 text-sm font-bold";

function Step({ slug, id, to, label, tone = "primary" }: { slug: string; id: string; to: string; label: string; tone?: "primary" | "danger" }) {
  return (
    <form action={transition.bind(null, slug)}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="to" value={to} />
      <button className={tone === "danger" ? `${btn} border border-orange-300 text-orange-800 hover:bg-orange-50` : `${btn} bg-green text-on-green`}>{label}</button>
    </form>
  );
}

async function Detail({ params, searchParams }: Props) {
  const p = await params;
  const { org, session } = await requireOrg(p.org);
  const found = await loadContribution(p.id, org.org_id);
  if (!found) notFound();
  const { c, consents, versions, events } = found;
  const error = (await searchParams).error;
  const mine = c.author_id === session.user.id;
  const base = `/c/${org.slug}/observations`;
  const s = c.state;
  const editable = mine && ["draft", "submitted", "returned", "published"].includes(s);

  return (
    <>
      <PortalBand eyebrow={`${TYPES[c.type as keyof typeof TYPES]} · version ${c.version}`} title={<span className="break-words">{c.title}</span>}>
        <Link href={base} className="inline-flex items-center gap-2 rounded-[5px] border border-white/40 px-5 py-3 text-sm font-bold hover:border-green hover:text-green">
          <ArrowLeft className="size-4" aria-hidden /> All observations
        </Link>
      </PortalBand>
      <Section className="py-12">
        <div className="grid grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] gap-6 max-[959px]:grid-cols-1">
          <div className="grid content-start gap-6">
            {error && <p role="alert" className="rounded-md border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800">{error}</p>}
            {c.moderator_reason && ["returned", "rejected"].includes(s) && (
              <div role="note" className="rounded-[10px] border border-orange-300 bg-orange-50 p-5 text-sm">
                <p className="font-bold text-orange-900">{s === "returned" ? "A moderator requested changes" : "Moderator's reason"}</p>
                <p className="mt-1 text-orange-900">{c.moderator_reason}</p>
              </div>
            )}
            <Panel title="Observation" action={<StateBadge state={s} />}>
              <p className="text-[15px] leading-[1.75] whitespace-pre-wrap">{c.body}</p>
              <dl className="mt-6 grid grid-cols-3 gap-4 border-t border-line pt-5 text-sm max-sm:grid-cols-2">
                {[
                  ["Offering", c.offerings?.name ?? "General"],
                  ["Evidence", EVIDENCE[c.evidence_type as keyof typeof EVIDENCE]],
                  ["Confidence", CONFIDENCE[c.confidence as keyof typeof CONFIDENCE]],
                  ["Industry", c.industry ?? "—"],
                  ["Region", c.region ?? "—"],
                  ["Period", c.period_start ? `${c.period_start} → ${c.period_end ?? "ongoing"}` : "—"],
                ].map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-xs font-bold text-slate">{k}</dt>
                    <dd className="mt-0.5 font-bold">{v}</dd>
                  </div>
                ))}
              </dl>
              {mine && c.pii_flags.length > 0 && (
                <p className="mt-5 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  Possible sensitive data: {c.pii_flags.map((f) => piiLabel[f] ?? f).join(", ")}. Moderators see this flag.
                </p>
              )}
            </Panel>

            {mine && (
              <div className="flex flex-wrap gap-3">
                {editable && (
                  <Link href={`${base}/${c.id}/edit`} className={`${btn} border border-line-strong bg-white hover:border-green-700`}>
                    <Pencil className="size-4" aria-hidden /> {s === "returned" ? "Edit & resubmit" : "Edit"}
                  </Link>
                )}
                {s === "draft" && c.visibility_choice === "org" && <Step slug={org.slug} id={c.id} to="published" label="Share with my organisation" />}
                {s === "draft" && c.visibility_choice === "propose_shared" && <Step slug={org.slug} id={c.id} to="submitted" label="Submit for review" />}
                {s === "returned" && <Step slug={org.slug} id={c.id} to="submitted" label="Resubmit unchanged" />}
                {["submitted", "returned", "published", "unpublished"].includes(s) && <Step slug={org.slug} id={c.id} to="withdrawn" label="Withdraw" tone="danger" />}
                {s === "draft" && (
                  <form action={discardDraft.bind(null, org.slug)}>
                    <input type="hidden" name="id" value={c.id} />
                    <button className={`${btn} border border-orange-300 text-orange-800 hover:bg-orange-50`}>Discard draft</button>
                  </form>
                )}
              </div>
            )}

            {versions.length > 0 && (
              <Panel title="Earlier versions">
                <ul className="grid grid-cols-1 gap-3">
                  {versions.map((v) => (
                    <li key={v.version} className="rounded-lg bg-light px-4 py-3 text-sm">
                      <details>
                        <summary className="cursor-pointer font-bold">
                          Version {v.version} · replaced {when(v.created_at)}
                        </summary>
                        <p className="mt-2 font-bold">{v.snapshot.title}</p>
                        <p className="mt-1 whitespace-pre-wrap text-slate">{v.snapshot.body}</p>
                      </details>
                    </li>
                  ))}
                </ul>
              </Panel>
            )}
          </div>

          <div className="grid content-start gap-6">
            <section aria-labelledby="who" className="rounded-[10px] border-2 border-green-700 bg-green-050 p-6">
              <h2 id="who" className="flex items-center gap-2 text-[17px] font-bold">
                <Eye className="size-4 text-green-700" aria-hidden /> Who can see this version
              </h2>
              <p className="mt-2 text-sm leading-[1.65]">{whoCanSee(c, org.name)}</p>
              <p className="mt-3 text-xs text-slate">Chosen audience: {VISIBILITY[c.visibility_choice].label}</p>
            </section>

            {mine && (
              <Panel title="Consents">
                {consents.length ? (
                  <ul className="grid grid-cols-1 gap-3 text-sm">
                    {consents.map((k, i) => (
                      <li key={k.at + i} className={i ? "border-t border-line pt-3 text-slate" : ""}>
                        <p className="text-xs font-bold">{i ? "Earlier" : "Current"} · {when(k.at)}</p>
                        <ul className="mt-1.5 grid gap-1">
                          {(Object.keys(CONSENTS) as (keyof Consents)[]).map((f) => (
                            <li key={f} className="flex gap-2">
                              <span aria-hidden>{k[f] ? "✓" : "✕"}</span>
                              <span className="capitalize">{f}</span>
                              <span className="sr-only">{k[f] ? "granted" : "not granted"}</span>
                            </li>
                          ))}
                        </ul>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-slate">No consents given. Nothing can be proposed to the community without them.</p>
                )}
              </Panel>
            )}

            <Panel title="History">
              {events.length ? (
                <ol className="grid gap-3 text-sm">
                  {events.map((e, i) => (
                    <li key={i} className="border-l-2 border-green pl-3">
                      <p className="font-bold">{NOTIFY[`contribution.${e.action}`] ?? e.action}</p>
                      <p className="text-xs text-slate">v{e.version} · {when(e.at)}</p>
                      {e.reason && <p className="mt-1 text-xs">“{e.reason}”</p>}
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm text-slate">Created {when(c.updated_at)}. Not shared yet.</p>
              )}
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
      <Detail {...props} />
    </Suspense>
  );
}
