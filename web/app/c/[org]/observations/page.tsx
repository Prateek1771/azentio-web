import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Plus } from "lucide-react";
import { requireOrg } from "@/lib/authz";
import { createInsForgeServerClient } from "@/lib/insforge/server";
import { EmptyState, Section } from "@/components/portal/primitives";
import { PortalBand } from "@/components/portal/portal";
import { ContributionList } from "@/components/portal/contributions";
import type { Contribution } from "@/lib/contributions/model";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Observations" };

type Props = { params: Promise<{ org: string }>; searchParams: Promise<{ tab?: string }> };

async function Observations({ params, searchParams }: Props) {
  const { org, session } = await requireOrg((await params).org);
  const tab = (await searchParams).tab === "org" ? "org" : "mine";
  const insforge = await createInsForgeServerClient();
  const q = insforge.database
    .from("contributions")
    .select("id, title, type, state, visibility_choice, version, updated_at, author_id")
    .eq("org_id", org.org_id)
    .order("updated_at", { ascending: false })
    .limit(50);
  // "Our org" = what colleagues shared with the org (RLS hides their drafts and private notes).
  const { data } = await (tab === "mine" ? q.eq("author_id", session.user.id) : q.neq("author_id", session.user.id));
  const rows = (data ?? []) as Contribution[];
  const base = `/c/${org.slug}/observations`;

  return (
    <>
      <PortalBand
        eyebrow={`${org.name} · Learning`}
        title="Observations"
        lead="Your organisation's own market observations. Separate from the shared community feed: nothing here leaves your organisation unless a moderator approves a proposal."
      >
        <Link href={`${base}/new`} className="inline-flex items-center gap-2 rounded-[5px] bg-green px-5 py-3 text-sm font-bold text-on-green">
          <Plus className="size-4" aria-hidden /> New observation
        </Link>
      </PortalBand>
      <Section className="py-12">
        <nav aria-label="Observation lists" className="mb-6 flex gap-2">
          {[
            ["mine", "My observations"],
            ["org", `Shared in ${org.name}`],
          ].map(([k, l]) => (
            <Link
              key={k}
              href={k === "mine" ? base : `${base}?tab=org`}
              aria-current={tab === k ? "page" : undefined}
              className={cn("rounded-full border px-4 py-2 text-sm font-bold", tab === k ? "border-navy bg-navy text-white" : "border-line-strong hover:border-green-700")}
            >
              {l}
            </Link>
          ))}
        </nav>
        {rows.length ? (
          <ContributionList rows={rows} base={base} />
        ) : tab === "mine" ? (
          <EmptyState
            title="You haven't written anything yet"
            body="Start with a private draft. You decide later whether to keep it, share it with your organisation, or propose it to the community."
            action={<Link href={`${base}/new`} className="text-sm font-bold text-green-700 hover:underline">Write your first observation</Link>}
          />
        ) : (
          <EmptyState title="Nothing shared in your organisation yet" body="When colleagues share observations with the organisation, they appear here." />
        )}
      </Section>
    </>
  );
}

export default function Page(props: Props) {
  return (
    <Suspense fallback={<Section><p className="text-slate">Loading observations…</p></Section>}>
      <Observations {...props} />
    </Suspense>
  );
}
