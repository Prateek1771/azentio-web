import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { productBySlug, products } from "@/lib/content";
import { CtaLink, Eyebrow, Section, SectionHead } from "@/components/portal/primitives";
import { CtaPanel } from "@/components/portal/cards";
import { NumberedCard, pad } from "@/components/site/numbered-card";

// Every product page is prerendered via generateStaticParams, so a blocking route costs nothing.
export const instant = false;

export function generateStaticParams() {
  return products.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const p = productBySlug((await params).slug);
  return p ? { title: p.name, description: p.summary, openGraph: { title: `${p.name} | azentio.ai`, description: p.summary, images: [`/products/${p.slug}.svg`] } } : {};
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const p = productBySlug((await params).slug);
  if (!p) notFound();

  return (
    <>
      <section className="on-dark bg-page-hero relative overflow-hidden pt-16 pb-[100px] text-white">
        <div className="glow-blob" aria-hidden />
        <div className="container-x relative grid grid-cols-[1.1fr_1fr] items-center gap-12 max-[959px]:grid-cols-1">
          <div>
            <Link href="/products" className="mb-8 inline-flex items-center gap-2 text-[13px] text-[#d1e4d0] hover:text-green">
              <ArrowLeft className="size-4" aria-hidden /> All Products
            </Link>
            <Eyebrow>{p.tagline}</Eyebrow>
            <h1 className="h-page my-6">{p.headline}</h1>
            <p className="lead max-w-[560px]">{p.summary}</p>
            <div className="mt-9 flex flex-wrap items-center gap-5">
              <CtaLink href={`/connect?interest=demo&product=${p.slug}`}>Request a Demo</CtaLink>
              <span className="text-xs text-[#c3d5df]">Development status: {p.status}</span>
            </div>
          </div>
          <div className="overflow-hidden rounded-[14px] border border-white/10 shadow-panel">
            <Image src={`/products/${p.slug}.svg`} alt={`${p.name} interface illustration`} width={720} height={405} priority className="w-full" />
          </div>
        </div>
      </section>

      <Section>
        <SectionHead eyebrow="What we built" title={p.name} intro={p.summary} />
        <div className="grid grid-cols-3 gap-5 max-[959px]:grid-cols-1">
          {p.features.map((f, i) => (
            <NumberedCard key={f} n={i + 1} title={f} body="Designed to support transparent, configurable, and practical workflows." />
          ))}
        </div>
      </Section>

      <Section muted>
        <SectionHead eyebrow="How it works" title="From Input to Insight." />
        <ol className="flex flex-wrap gap-0 overflow-hidden rounded-[10px] border border-[#e2e9ed]" aria-label={`${p.name} workflow`}>
          {p.flow.map((step, i) => (
            <li key={step} className="flex min-w-[170px] flex-1 items-center gap-3 border-r border-[#e2e9ed] bg-white p-[22px] last:border-r-0 max-md:min-w-full max-md:border-r-0 max-md:border-b">
              <span className="text-xs font-bold text-green-700">{pad(i + 1)}</span>
              <strong className="text-[13px]">{step}</strong>
              {i < p.flow.length - 1 && <ChevronRight className="ml-auto size-4 text-green max-md:rotate-90" aria-hidden />}
            </li>
          ))}
        </ol>
      </Section>

      <Section>
        <SectionHead eyebrow="Potential business value" title="Intelligence That Supports Action." />
        <div className="grid grid-cols-3 gap-5 max-[959px]:grid-cols-1">
          {p.benefits.map((b, i) => (
            <NumberedCard key={b} n={i + 1} title={b} />
          ))}
        </div>
        <p className="mt-6 text-xs text-slate">Benefits describe intended outcomes, not verified performance claims.</p>
      </Section>

      <CtaPanel
        eyebrow="Build what's next"
        title={`Explore ${p.name}`}
        body="See how this solution could fit your business processes and enterprise environment."
        href={`/connect?interest=demo&product=${p.slug}`}
      />
    </>
  );
}
