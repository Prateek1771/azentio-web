import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Plus } from "lucide-react";
import { requireOrg } from "@/lib/authz";
import { createInsForgeServerClient } from "@/lib/insforge/server";
import { EmptyState, Section } from "@/components/portal/primitives";
import { Panel, PortalBand, Tile, roleLabel } from "@/components/portal/portal";
import { ContributionList } from "@/components/portal/contributions";
import { type Contribution, NOTIFY, STATE } from "@/lib/contributions/model";

export const metadata: Metadata = { title: "Client workspace" };

type Offering = { slug: string; name: string; category: string; summary: string };
type Note = { id: string; kind: string; payload: { contribution_id?: string; title?: string }; read_at: string | null; at: string };

const COUNTED = ["draft", "submitted", "returned", "published"] as const;

async function ClientHome({ params }: { params: Promise<{ org: string }> }) {
  const { org, session } = await requireOrg((await params).org);
  const insforge = await createInsForgeServerClient();
  const db = insforge.database;
  const cols = "id, title, type, state, visibility_choice, version, updated_at";
  const [{ data: ents }, { data: mine }, { data: shared }, { data: notes }] = await Promise.all([
    db.from("entitlements").select("offerings(slug, name, category, summary)").eq("org_id", org.org_id),
    db.from("contributions").select("state").eq("org_id", org.org_id).eq("author_id", session.user.id),
    db.from("contributions").select(cols).eq("org_id", org.org_id).neq("author_id", session.user.id).order("updated_at", { ascending: false }).limit(5),
    db.from("notifications").select("id, kind, payload, read_at, at").eq("payload->>org_id", org.org_id).order("at", { ascending: false }).limit(5),
  ]);
  const offerings = ((ents ?? []) as unknown as { offerings: Offering }[]).map((r) => r.offerings);
  const counts = Object.fromEntries(COUNTED.map((k) => [k, ((mine ?? []) as { state: string }[]).filter((r) => r.state === k).length]));
  const isAdmin = org.role === "client_admin";
  const obs = `/c/${org.slug}/observations`;

  return (
    <>
      <PortalBand
        eyebrow={`Client workspace · ${roleLabel(org.role)}`}
        title={org.name}
        lead="Your organisation's private workspace. Anything you contribute stays private until you choose to share it, and nothing reaches the community without moderator approval."
      >
        <Link href={`${obs}/new`} className="inline-flex items-center gap-2 rounded-[5px] bg-green px-5 py-3 text-sm font-bold text-on-green">
          <Plus className="size-4" aria-hidden /> New observation
        </Link>
        <Link href="/learning" className="rounded-[5px] border border-white/40 px-5 py-3 text-sm font-bold hover:border-green hover:text-green">
          Community learning
        </Link>
        <Link href={`/c/${org.slug}/resources`} className="rounded-[5px] border border-white/40 px-5 py-3 text-sm font-bold hover:border-green hover:text-green">
          Resources
        </Link>
        {isAdmin && (
          <Link href={`/c/${org.slug}/members`} className="rounded-[5px] border border-white/40 px-5 py-3 text-sm font-bold hover:border-green hover:text-green">
            Members &amp; invitations
          </Link>
        )}
      </PortalBand>
      <Section className="py-14">
        <div className="grid gap-8">
          <ul aria-label="Your contributions by status" className="grid grid-cols-4 gap-4 max-md:grid-cols-2">
            {COUNTED.map((k) => (
              <li key={k}>
                <Link href={obs} className="lift block rounded-[10px] border border-line bg-white p-5">
                  <span className="block text-[32px] leading-none font-bold">{counts[k]}</span>
                  <span className="mt-2 block text-sm font-bold text-slate">{STATE[k].label}</span>
                </Link>
              </li>
            ))}
          </ul>

          <Panel title="Sandboxes for your entitled offerings">
            {offerings.length ? (
              <ul className="grid grid-cols-3 gap-4 max-[959px]:grid-cols-2 max-sm:grid-cols-1">
                {offerings.map((o) => (
                  <li key={o.slug}>
                    <Tile title={o.name} body={o.summary} href={`/c/${org.slug}/sandboxes/${o.slug}`} />
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="No offerings assigned yet" body="Your Azentio contact can enable product demonstrations for your organisation." />
            )}
          </Panel>

          <div className="grid grid-cols-2 gap-5 max-md:grid-cols-1">
            <Panel title={`Shared in ${org.name}`} action={<Link href={`${obs}?tab=org`} className="text-sm font-bold text-green-700 hover:underline">View all</Link>}>
              {shared?.length ? (
                <ContributionList rows={shared as Contribution[]} base={obs} />
              ) : (
                <EmptyState title="Nothing shared yet" body="Observations colleagues share with your organisation appear here. Drafts and private notes never do." />
              )}
            </Panel>
            <Panel title="Recent updates">
              {notes?.length ? (
                <ul className="grid grid-cols-1 gap-2">
                  {(notes as Note[]).map((n) => (
                    <li key={n.id}>
                      <Link href={n.payload.contribution_id ? `${obs}/${n.payload.contribution_id}` : obs} className="block rounded-lg bg-light px-4 py-3 text-sm hover:bg-green-050">
                        <span className="font-bold">{NOTIFY[n.kind] ?? n.kind}</span>
                        <span className="block truncate text-slate">{n.payload.title}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState title="No updates yet" body="Status changes on your contributions show up here and in the bell at the top of the page." />
              )}
            </Panel>
          </div>
        </div>
      </Section>
    </>
  );
}

export default function Page({ params }: { params: Promise<{ org: string }> }) {
  return (
    <Suspense fallback={<Section><p className="text-slate">Loading workspace…</p></Section>}>
      <ClientHome params={params} />
    </Suspense>
  );
}
