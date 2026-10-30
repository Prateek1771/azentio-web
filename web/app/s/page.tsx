import type { Metadata } from "next";
import { Suspense } from "react";
import { requireGrant } from "@/lib/authz";
import { Section } from "@/components/portal/primitives";
import { PortalBand, Tile, roleLabel } from "@/components/portal/portal";

export const metadata: Metadata = { title: "Staff console" };

// Each tile appears only for the grant that unlocks it; the pages behind them re-check server-side.
const TILES = [
  { grant: "moderate", title: "Moderation queue", body: "Review submitted contributions, redact shared copies, publish or return.", href: "/s/moderation" },
  { grant: "moderate", title: "Reports", body: "Investigate reported contributions and record decisions.", href: "/s/reports" },
  { grant: "moderate", title: "Themes", body: "Group approved contributions into themes with k-safe organisation counts.", href: "/s/insights" },
  { grant: "publish_media", title: "Publisher workspace", body: "Homepage banners, public content, live stream and recordings.", href: "/s/publisher" },
  { grant: "product_owner", title: "Themes & ideas", body: "Turn approved themes into improvement ideas with audited status.", href: "/s/insights" },
  { grant: "portal_admin", title: "Organisations & roles", body: "Client orgs, entitlements, employee allow-list and grants.", badge: "Phase 7" },
  { grant: "portal_admin", title: "Email outbox", body: "Queued, sent and failed notification emails. Sent at most once.", href: "/s/outbox" },
  { grant: "portal_admin", title: "Audit log", body: "Every privileged action, append-only.", badge: "Phase 10" },
  { grant: "portal_admin", title: "AIRA guardrails", body: "Rules, kill switch, blocked-event review and answer-quality metrics.", href: "/s/aira" },
] as { grant: string; title: string; body: string; badge?: string; href?: string }[];

async function StaffHome() {
  const s = await requireGrant("portal_admin", "moderate", "publish_media", "product_owner");
  const tiles = TILES.filter((t) => s.grants.includes(t.grant as (typeof s.grants)[number]));
  return (
    <>
      <PortalBand
        eyebrow="Staff console"
        title="Governance, publishing and learning operations."
        lead={`Your permissions: ${s.grants.map(roleLabel).join(", ")}. Every action here is audited.`}
      />
      <Section className="py-14">
        <div className="grid grid-cols-3 gap-5 max-[959px]:grid-cols-2 max-sm:grid-cols-1">
          {tiles.map((t) => (
            <Tile key={t.title} title={t.title} body={t.body} badge={t.badge} href={t.href} />
          ))}
          <Tile title="Community learning" body="The shared feed, themes and improvement ideas as members see them." href="/learning" />
          <Tile title="Employee portal" body="Playground, live sessions and experiments." href="/e" />
        </div>
      </Section>
    </>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<Section><p className="text-slate">Loading…</p></Section>}>
      <StaffHome />
    </Suspense>
  );
}
