import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { requireOrg } from "@/lib/authz";
import { createInsForgeServerClient } from "@/lib/insforge/server";
import { acknowledge } from "@/lib/learning/collab";
import { Section } from "@/components/portal/primitives";
import { Panel, PortalBand } from "@/components/portal/portal";
import { CommentThread } from "@/components/portal/comments";

export const metadata: Metadata = { title: "Resource" };

const KIND: Record<string, string> = { briefing: "Briefing", release_note: "Release note", library: "Resource" };

async function Resource({ params }: { params: Promise<{ org: string; id: string }> }) {
  const p = await params;
  const { org } = await requireOrg(p.org);
  if (!/^[0-9a-f-]{36}$/i.test(p.id)) notFound();
  const db = (await createInsForgeServerClient()).database;
  const [{ data }, { data: ack }] = await Promise.all([
    db.from("content").select("id, kind, title, body, updated_at, offerings(name)").eq("id", p.id).eq("published", true).in("kind", ["briefing", "release_note", "library"]).maybeSingle(),
    db.from("acknowledgements").select("at").eq("content_id", p.id),
  ]);
  if (!data) notFound(); // RLS: not for this organisation
  const r = data as unknown as { id: string; kind: string; title: string; body: string; updated_at: string; offerings: { name: string } | null };
  const acked = (ack?.[0] as { at: string } | undefined)?.at;
  const back = `/c/${org.slug}/resources/${r.id}`;

  return (
    <>
      <PortalBand eyebrow={`${KIND[r.kind]}${r.offerings ? ` · ${r.offerings.name}` : ""}`} title={<span className="break-words">{r.title}</span>}>
        <Link href={`/c/${org.slug}/resources`} className="inline-flex items-center gap-2 rounded-[5px] border border-white/40 px-5 py-3 text-sm font-bold hover:border-green hover:text-green">
          <ArrowLeft className="size-4" aria-hidden /> Resources
        </Link>
      </PortalBand>
      <Section className="py-12">
        <div className="grid grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] gap-6 max-[959px]:grid-cols-1">
          <div className="grid content-start gap-6">
            <Panel title={KIND[r.kind]}>
              <p className="text-[15px] leading-[1.75] whitespace-pre-wrap">{r.body}</p>
            </Panel>
            <Panel title="Questions">
              <CommentThread type="content" parentId={r.id} back={back} />
            </Panel>
          </div>
          <Panel title="Acknowledgement">
            {acked ? (
              <p className="inline-flex items-center gap-2 text-sm font-bold text-green-700">
                <CheckCircle2 className="size-4" aria-hidden /> You acknowledged this on {new Date(acked).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
              </p>
            ) : (
              <form action={acknowledge.bind(null, r.id, back)} className="grid gap-3">
                <p className="text-sm text-slate">Let your Azentio team know you&rsquo;ve read this. They see how many people acknowledged it, not who.</p>
                <button className="justify-self-start rounded-[5px] bg-green px-5 py-3 text-sm font-bold text-on-green">Acknowledge</button>
              </form>
            )}
          </Panel>
        </div>
      </Section>
    </>
  );
}

export default function Page({ params }: { params: Promise<{ org: string; id: string }> }) {
  return (
    <Suspense fallback={<Section><p className="text-slate">Loading…</p></Section>}>
      <Resource params={params} />
    </Suspense>
  );
}
