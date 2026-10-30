import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireOrg } from "@/lib/authz";
import { createInsForgeServerClient } from "@/lib/insforge/server";
import { EmptyState, Section } from "@/components/portal/primitives";
import { Panel, PortalBand, Tile, roleLabel } from "@/components/portal/portal";

export const metadata: Metadata = { title: "Client workspace" };

type Offering = { slug: string; name: string; category: string; summary: string };

async function ClientHome({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await requireOrg((await params).org);
  const insforge = await createInsForgeServerClient();
  const { data } = await insforge.database
    .from("entitlements")
    .select("offerings(slug, name, category, summary)")
    .eq("org_id", org.org_id);
  const offerings = ((data ?? []) as unknown as { offerings: Offering }[]).map((r) => r.offerings);
  const isAdmin = org.role === "client_admin";

  return (
    <>
      <PortalBand
        eyebrow={`Client workspace · ${roleLabel(org.role)}`}
        title={org.name}
        lead="Your organisation's private workspace. Anything you contribute stays private until you choose to propose it for sharing, and a moderator approves it."
      >
        {isAdmin && (
          <Link href={`/c/${org.slug}/members`} className="rounded-[5px] border border-white/40 px-5 py-3 text-sm font-bold hover:border-green hover:text-green">
            Members &amp; invitations
          </Link>
        )}
      </PortalBand>
      <Section className="py-14">
        <div className="grid gap-8">
          <Panel title="Entitled offerings">
            {offerings.length ? (
              <ul className="grid grid-cols-3 gap-4 max-[959px]:grid-cols-2 max-sm:grid-cols-1">
                {offerings.map((o) => (
                  <li key={o.slug}>
                    <Tile title={o.name} body={o.summary} href={`/products/${o.slug}`} />
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="No offerings assigned yet" body="Your Azentio contact can enable product demonstrations for your organisation." />
            )}
          </Panel>
          <div className="grid grid-cols-2 gap-5 max-md:grid-cols-1">
            <Panel title="Your observations">
              <EmptyState title="Nothing contributed yet" body="Share market observations privately with your team, or propose them to the learning community. Arrives in Phase 5." />
            </Panel>
            <Panel title="Sessions & briefings">
              <EmptyState title="No sessions scheduled" body="Invitation-only webinars and briefings for your organisation will appear here." />
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
