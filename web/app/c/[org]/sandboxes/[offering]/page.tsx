import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireOrg } from "@/lib/authz";
import { productBySlug } from "@/lib/content";
import { scenarios } from "@/lib/playground/scenarios";
import { createInsForgeServerClient } from "@/lib/insforge/server";
import { Section } from "@/components/portal/primitives";
import { PortalBand } from "@/components/portal/portal";
import { SimulatedBanner } from "@/components/portal/simulated-banner";
import { Runner } from "@/app/e/playground/[offering]/runner";

export const metadata: Metadata = { title: "Sandbox" };

type Props = { params: Promise<{ org: string; offering: string }> };

async function Sandbox({ params }: Props) {
  const p = await params;
  const { org } = await requireOrg(p.org);
  const product = productBySlug(p.offering);
  if (!product || !scenarios[product.slug]) notFound();
  const insforge = await createInsForgeServerClient();
  const { data } = await insforge.database
    .from("entitlements").select("offerings!inner(slug)").eq("org_id", org.org_id).eq("offerings.slug", product.slug).limit(1);
  if (!data?.length) notFound(); // never confirm what other tenants are entitled to

  return (
    <>
      <PortalBand eyebrow={`${org.name} · Sandbox`} title={product.name} lead="Your organisation's private sandbox. Runs are visible only to you.">
        <Link href={`/c/${org.slug}`} className="inline-flex items-center gap-2 rounded-[5px] border border-white/40 px-5 py-3 text-sm font-bold hover:border-green hover:text-green">
          <ArrowLeft className="size-4" aria-hidden /> Workspace
        </Link>
      </PortalBand>
      <Section className="py-12">
        <div className="grid gap-6">
          <SimulatedBanner />
          <Runner offering={product.slug} flow={product.flow} scenarios={scenarios[product.slug]} org={org.slug} />
        </div>
      </Section>
    </>
  );
}

export default function Page(props: Props) {
  return (
    <Suspense fallback={<Section><p className="text-slate">Loading sandbox…</p></Section>}>
      <Sandbox {...props} />
    </Suspense>
  );
}
