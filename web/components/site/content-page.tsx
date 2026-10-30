import type { ContentPageData } from "@/lib/content";
import { PageHero, Section } from "@/components/portal/primitives";
import { CtaPanel } from "@/components/portal/cards";
import { NumberedCard } from "./numbered-card";

// Shared template for the prototype's text pages: hero → numbered card grid → optional extra → CTA.
export function ContentPage({ data, children }: { data: ContentPageData; children?: React.ReactNode }) {
  return (
    <>
      <PageHero eyebrow={data.eyebrow} title={data.title} lead={data.lead} />
      <Section>
        <div className={`grid gap-5 ${data.cards.length % 3 === 0 ? "grid-cols-3" : "grid-cols-2"} max-[959px]:grid-cols-2 max-sm:grid-cols-1`}>
          {data.cards.map((c, i) => (
            <NumberedCard key={c.title} n={i + 1} title={c.title} body={c.body} href={c.href} />
          ))}
        </div>
      </Section>
      {children}
      <CtaPanel />
    </>
  );
}
