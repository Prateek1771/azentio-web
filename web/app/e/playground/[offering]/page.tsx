import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireEmployee } from "@/lib/authz";
import { productBySlug, products } from "@/lib/content";
import { scenarios } from "@/lib/playground/scenarios";
import { Section } from "@/components/portal/primitives";
import { PortalBand } from "@/components/portal/portal";
import { SimulatedBanner } from "@/components/portal/simulated-banner";
import { Runner } from "./runner";

export const metadata: Metadata = { title: "Playground" };

export function generateStaticParams() {
  return products.map((p) => ({ offering: p.slug }));
}

async function Workflow({ params }: { params: Promise<{ offering: string }> }) {
  await requireEmployee();
  const product = productBySlug((await params).offering);
  if (!product || !scenarios[product.slug]) notFound();
  return (
    <>
      <PortalBand eyebrow={`Playground · ${product.tagline}`} title={product.name} lead={product.summary}>
        <Link href="/e/playground" className="inline-flex items-center gap-2 rounded-[5px] border border-white/40 px-5 py-3 text-sm font-bold hover:border-green hover:text-green">
          <ArrowLeft className="size-4" aria-hidden /> All offerings
        </Link>
      </PortalBand>
      <Section className="py-12">
        <div className="grid gap-6">
          <SimulatedBanner />
          <Runner offering={product.slug} flow={product.flow} scenarios={scenarios[product.slug]} />
        </div>
      </Section>
    </>
  );
}

export default function Page({ params }: { params: Promise<{ offering: string }> }) {
  return (
    <Suspense fallback={<Section><p className="text-slate">Loading…</p></Section>}>
      <Workflow params={params} />
    </Suspense>
  );
}
