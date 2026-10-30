import Image from "next/image";
import { featuredProducts } from "@/lib/content";
import { CtaLink, Eyebrow, Section, SectionHead, TextLink } from "@/components/portal/primitives";
import { CtaPanel, ProductCard } from "@/components/portal/cards";

// ponytail: Phase 0 shell proving the look; the full home (carousel, flip cards, media, trust, news) is Phase 3.
export default function Home() {
  return (
    <>
      <section className="on-dark relative flex min-h-[680px] items-center overflow-hidden bg-navy text-white">
        <Image src="/banners/intelligence.svg" alt="" fill priority className="object-cover" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,#171b3af2,#171b3abb_35%,#171b3a30_75%)]" aria-hidden />
        <div className="container-x relative py-24">
          <Eyebrow>Applied AI · Enterprise innovation</Eyebrow>
          <h1 className="h-hero my-6 max-w-[900px]">
            Build Intelligence. <em>Create Impact.</em>
          </h1>
          <p className="lead max-w-[580px]">
            From ideas to intelligent products. From complexity to clarity. From AI potential to meaningful outcomes.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <CtaLink href="/products">Explore our products</CtaLink>
            <CtaLink href="/connect" variant="outline" icon={false}>
              Start a Conversation
            </CtaLink>
          </div>
        </div>
      </section>

      <Section>
        <SectionHead
          eyebrow="Products"
          title="Built to Work. Designed to Evolve."
          intro="Applied AI experiences, from credit decisioning to reporting and document intelligence."
          action={<TextLink href="/products">View all products</TextLink>}
        />
        <div className="grid grid-cols-4 gap-5 max-[1100px]:grid-cols-2 max-sm:grid-cols-1">
          {featuredProducts.map((p) => (
            <ProductCard key={p.slug} product={p} />
          ))}
        </div>
        <p className="mt-6 text-xs text-[#7a8790]">
          Product capabilities and release readiness must be validated before public marketing or customer commitments.
        </p>
      </Section>

      <CtaPanel />
    </>
  );
}
