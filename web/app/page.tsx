import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { capabilities, featuredProducts, heroSlides, newsItems, trustItems, whoWeAre } from "@/lib/content";
import { CtaLink, Eyebrow, Section, SectionHead, TextLink } from "@/components/portal/primitives";
import { CtaPanel, ProductCard } from "@/components/portal/cards";
import { HeroCarousel } from "@/components/site/hero-carousel";
import { CapabilityCard } from "@/components/site/capability-card";
import { NumberedCard } from "@/components/site/numbered-card";

export default function Home() {
  return (
    <>
      <HeroCarousel slides={heroSlides} />

      <Section>
        <div className="grid grid-cols-[1fr_1.2fr] items-end gap-12 max-[959px]:grid-cols-1">
          <div>
            <Eyebrow>{whoWeAre.eyebrow}</Eyebrow>
            <h2 className="h-section mt-3.5">{whoWeAre.title}</h2>
          </div>
          <p className="lead">{whoWeAre.body}</p>
        </div>
      </Section>

      <Section muted>
        <SectionHead eyebrow="What we do" title="Intelligence in Every Layer." intro="Capabilities designed to connect information, intelligence, and action." />
        <div className="grid grid-cols-3 gap-5 max-[959px]:grid-cols-2 max-sm:grid-cols-1">
          {capabilities.map((c) => (
            <CapabilityCard key={c.title} c={c} />
          ))}
        </div>
      </Section>

      <Section>
        <SectionHead
          eyebrow="Featured products"
          title="Built to Work. Designed to Evolve."
          action={<TextLink href="/products">View all products</TextLink>}
        />
        <div className="grid grid-cols-4 gap-5 max-[1100px]:grid-cols-2 max-sm:grid-cols-1">
          {featuredProducts.map((p) => (
            <ProductCard key={p.slug} product={p} />
          ))}
        </div>
      </Section>

      <section className="on-dark relative overflow-hidden bg-[radial-gradient(ellipse_at_75%_45%,#2d635a,#171b3a_55%)] py-[110px] text-white max-md:py-20">
        <div className="glow-blob" aria-hidden />
        <div className="container-x relative max-w-[1180px]">
          <Eyebrow>See intelligence in action</Eyebrow>
          <h2 className="h-section mt-3.5 mb-5 max-w-[760px]">
            Don&rsquo;t Just Imagine What AI Can Do. <em>See It.</em>
          </h2>
          <p className="lead mb-9 max-w-[600px]">Explore real product experiences, intelligent workflows, and ideas brought to life through engineering.</p>
          <CtaLink href="/media">Watch Product Showcases</CtaLink>
        </div>
      </section>

      <Section muted>
        <SectionHead eyebrow="Trust by design" title="Innovation Without Compromising Trust." intro="Enterprise AI must be as accountable as it is intelligent." />
        <div className="grid grid-cols-3 gap-4 max-[959px]:grid-cols-2 max-sm:grid-cols-1">
          {trustItems.map((t, i) => (
            <NumberedCard key={t} n={i + 1} title={t} />
          ))}
        </div>
      </Section>

      <Section>
        <SectionHead eyebrow="What's happening" title="Ideas in Motion." />
        <div className="grid grid-cols-3 gap-5 max-[959px]:grid-cols-1">
          {newsItems.map((n) => (
            <Link key={n.href} href={n.href} className="lift group on-dark relative flex min-h-[220px] flex-col justify-between overflow-hidden rounded-[10px] bg-navy p-8 text-white">
              <div className="glow-blob opacity-60" aria-hidden />
              <span className="eyebrow relative">{n.eyebrow}</span>
              <span className="relative flex items-end justify-between gap-4">
                <span className="text-[22px] leading-tight font-bold">{n.title}</span>
                <ArrowUpRight className="size-5 shrink-0 text-green transition-transform group-hover:-translate-y-1" aria-hidden />
              </span>
            </Link>
          ))}
        </div>
      </Section>

      <CtaPanel eyebrow="Build what's next" />
    </>
  );
}
