import type { Metadata } from "next";
import { Suspense } from "react";
import { requireGrant } from "@/lib/authz";
import { createInsForgeServerClient } from "@/lib/insforge/server";
import { EmptyState, Section } from "@/components/portal/primitives";
import { Panel, PortalBand } from "@/components/portal/portal";
import { cn } from "@/lib/utils";
import { emailDeliveryOn } from "@/lib/email/outbox";

export const metadata: Metadata = { title: "Email outbox" };

// "Sent to provider" is the strongest claim we can make: there is no delivery callback, so nothing says "delivered".
const STATUS: Record<string, { label: string; cls: string }> = {
  queued: { label: "Queued", cls: "bg-light text-slate" },
  sending: { label: "Sending", cls: "bg-amber-50 text-amber-800" },
  retry: { label: "Will retry", cls: "bg-amber-50 text-amber-800" },
  sent: { label: "Sent to provider", cls: "bg-green-050 text-green-700" },
  failed: { label: "Failed", cls: "bg-orange-50 text-orange-800" },
  unknown: { label: "Unknown (not resent)", cls: "bg-orange-50 text-orange-800" },
};

type Row = { id: string; to_email: string; template: string; status: string; attempts: number; last_error: string | null; created_at: string };

async function Outbox() {
  await requireGrant("portal_admin");
  const { data } = await (await createInsForgeServerClient()).database.rpc("outbox_overview");
  const rows = (data ?? []) as Row[];
  const counts = Object.keys(STATUS).map((k) => [k, rows.filter((r) => r.status === k).length] as const);

  return (
    <>
      <PortalBand eyebrow="Staff console · Administration" title="Email outbox" lead="Every email is queued once per event and sent at most once. Failed sends retry with backoff; anything interrupted mid-send is marked unknown rather than risk a duplicate." />
      <Section className="py-12">
        <div className="grid gap-6">
          {!emailDeliveryOn() && (
            <p role="note" className="rounded-[10px] border border-amber-300 bg-amber-50 px-5 py-4 text-sm text-amber-900">
              <strong>Email delivery is off.</strong> Custom email needs a paid InsForge plan, so emails stay queued here and people are
              notified in the portal (bell and realtime) instead. Set <code>EMAIL_DELIVERY=insforge</code> after upgrading; queued emails then send once each.
            </p>
          )}
          <ul aria-label="Outbox by status" className="grid grid-cols-6 gap-3 max-md:grid-cols-3">
            {counts.map(([k, n]) => (
              <li key={k} className="rounded-[10px] border border-line bg-white p-4">
                <span className="block text-[26px] leading-none font-bold">{n}</span>
                <span className="mt-1.5 block text-xs font-bold text-slate">{STATUS[k].label}</span>
              </li>
            ))}
          </ul>
          <Panel title="Recent emails (last 100)">
            {rows.length ? (
              <ul className="grid grid-cols-1 gap-2">
                {rows.map((r) => (
                  <li key={r.id} className="grid gap-1 rounded-lg bg-light px-4 py-3 text-sm">
                    <span className="flex flex-wrap items-center justify-between gap-2">
                      <span className="min-w-0 break-all font-bold">{r.to_email}</span>
                      <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-bold", STATUS[r.status]?.cls)}>{STATUS[r.status]?.label ?? r.status}</span>
                    </span>
                    <span className="text-xs text-slate">
                      {r.template} · attempt {r.attempts} · {new Date(r.created_at).toLocaleString("en-GB")}
                      {r.last_error && <> · <span className="text-orange-800">{r.last_error}</span></>}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="No emails yet" body="Emails appear here when contributions are reviewed, ideas change status or invitations are sent." />
            )}
          </Panel>
        </div>
      </Section>
    </>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<Section><p className="text-slate">Loading…</p></Section>}>
      <Outbox />
    </Suspense>
  );
}
