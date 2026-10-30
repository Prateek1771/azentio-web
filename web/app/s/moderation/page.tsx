import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ShieldAlert } from "lucide-react";
import { requireGrant } from "@/lib/authz";
import { createInsForgeServerClient } from "@/lib/insforge/server";
import { EmptyState, Section } from "@/components/portal/primitives";
import { PortalBand } from "@/components/portal/portal";
import { StateBadge } from "@/components/portal/contributions";
import { type Contribution, TYPES } from "@/lib/contributions/model";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Moderation queue" };

const TABS = { submitted: "Awaiting review", returned: "Changes requested", published: "Published", unpublished: "Unpublished" } as const;
type Props = { searchParams: Promise<{ tab?: string }> };

const age = (d: string) => {
  const h = Math.round((Date.now() - new Date(d).getTime()) / 36e5);
  return h < 1 ? "just now" : h < 48 ? `${h}h ago` : `${Math.round(h / 24)}d ago`;
};

async function Queue({ searchParams }: Props) {
  await requireGrant("moderate");
  const raw = (await searchParams).tab;
  const tab = (raw && raw in TABS ? raw : "submitted") as keyof typeof TABS;
  const insforge = await createInsForgeServerClient();
  // RLS: moderators only ever see proposals (never drafts, private notes or org-only items).
  const { data } = await insforge.database
    .from("contributions")
    .select("id, title, type, state, version, pii_flags, updated_at, industry, region")
    .eq("state", tab)
    .order("updated_at", { ascending: tab === "submitted" })
    .limit(100);
  const rows = (data ?? []) as Contribution[];

  return (
    <>
      <PortalBand eyebrow="Staff console · Moderation" title="Moderation queue" lead="Review proposals, redact the shared copy, then publish, request changes or reject. Oldest first." />
      <Section className="py-12">
        <nav aria-label="Queue" className="mb-6 flex flex-wrap gap-2">
          {Object.entries(TABS).map(([k, l]) => (
            <Link
              key={k}
              href={k === "submitted" ? "/s/moderation" : `/s/moderation?tab=${k}`}
              aria-current={tab === k ? "page" : undefined}
              className={cn("rounded-full border px-4 py-2 text-sm font-bold", tab === k ? "border-navy bg-navy text-white" : "border-line-strong hover:border-green-700")}
            >
              {l}
            </Link>
          ))}
        </nav>
        {rows.length ? (
          <ul className="grid grid-cols-1 gap-3">
            {rows.map((c) => (
              <li key={c.id}>
                <Link href={`/s/moderation/${c.id}`} className="lift flex items-center justify-between gap-4 rounded-[10px] border border-line bg-white px-5 py-4 max-sm:flex-col max-sm:items-start">
                  <span className="min-w-0 max-w-full">
                    <span className="block truncate font-bold">{c.title}</span>
                    <span className="mt-1 block text-xs text-slate">
                      {TYPES[c.type as keyof typeof TYPES]} · v{c.version} · {[c.industry, c.region].filter(Boolean).join(" · ") || "No context"} · {age(c.updated_at)}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    {c.pii_flags.length > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-800">
                        <ShieldAlert className="size-3" aria-hidden /> Sensitive data flag
                      </span>
                    )}
                    <StateBadge state={c.state} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="Nothing here" body={tab === "submitted" ? "No proposals are waiting for review." : "No contributions in this state."} />
        )}
      </Section>
    </>
  );
}

export default function Page(props: Props) {
  return (
    <Suspense fallback={<Section><p className="text-slate">Loading queue…</p></Section>}>
      <Queue {...props} />
    </Suspense>
  );
}
