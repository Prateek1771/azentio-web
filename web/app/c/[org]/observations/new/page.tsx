import type { Metadata } from "next";
import { Suspense } from "react";
import { requireOrg } from "@/lib/authz";
import { Section } from "@/components/portal/primitives";
import { PortalBand } from "@/components/portal/portal";
import { ContributionForm } from "../contribution-form";
import { entitledOfferings } from "../queries";

export const metadata: Metadata = { title: "New observation" };

async function NewObservation({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await requireOrg((await params).org);
  return (
    <>
      <PortalBand eyebrow={`${org.name} · New observation`} title="Share what you're seeing" lead="Starts as a private draft. Saving never shares." />
      <Section className="py-12">
        <ContributionForm slug={org.slug} offerings={await entitledOfferings(org.org_id)} />
      </Section>
    </>
  );
}

export default function Page({ params }: { params: Promise<{ org: string }> }) {
  return (
    <Suspense fallback={<Section><p className="text-slate">Loading…</p></Section>}>
      <NewObservation params={params} />
    </Suspense>
  );
}
