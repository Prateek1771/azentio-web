import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { requireOrg } from "@/lib/authz";
import { Section } from "@/components/portal/primitives";
import { PortalBand } from "@/components/portal/portal";
import { ContributionForm } from "../../contribution-form";
import { entitledOfferings, loadContribution } from "../../queries";

export const metadata: Metadata = { title: "Edit observation" };

async function Edit({ params }: { params: Promise<{ org: string; id: string }> }) {
  const p = await params;
  const { org, session } = await requireOrg(p.org);
  const found = await loadContribution(p.id, org.org_id);
  if (!found || found.c.author_id !== session.user.id || !["draft", "submitted", "returned", "published"].includes(found.c.state)) notFound();
  return (
    <>
      <PortalBand eyebrow={`${org.name} · Editing version ${found.c.version}`} title={<span className="break-words">{found.c.title}</span>} />
      <Section className="py-12">
        <ContributionForm slug={org.slug} offerings={await entitledOfferings(org.org_id)} initial={found.c} consents={found.consents[0]} />
      </Section>
    </>
  );
}

export default function Page({ params }: { params: Promise<{ org: string; id: string }> }) {
  return (
    <Suspense fallback={<Section><p className="text-slate">Loading…</p></Section>}>
      <Edit params={params} />
    </Suspense>
  );
}
