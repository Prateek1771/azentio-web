import type { Metadata } from "next";
import { contentPages } from "@/lib/content";
import { Section } from "@/components/portal/primitives";
import { ContentPage } from "@/components/site/content-page";

const data = contentPages.about;
export const metadata: Metadata = { title: "About", description: data.lead };

const POLICIES = [
  {
    id: "privacy",
    title: "Privacy",
    body: "We collect only what a form asks for, store it privately and use it to respond to you. Portal contributions are private by default; sharing beyond your organisation requires your explicit choice and moderator review. All demonstration data on this site is synthetic.",
  },
  {
    id: "terms",
    title: "Terms",
    body: "Product information is indicative and subject to validation. Benefits describe intended outcomes, not verified performance claims. Sandbox outputs are simulations and are never approved credit or business decisions.",
  },
  {
    id: "accessibility",
    title: "Accessibility",
    body: "We design to WCAG 2.2 AA: keyboard navigation, visible focus, sufficient contrast, labelled controls and reduced-motion support. If something gets in your way, tell us through Connect.",
  },
];

export default function Page() {
  return (
    <ContentPage data={data}>
      <Section muted>
        <div className="grid grid-cols-3 gap-5 max-[959px]:grid-cols-1">
          {POLICIES.map((p) => (
            <section key={p.id} id={p.id} aria-labelledby={`${p.id}-h`} className="scroll-mt-28 rounded-[10px] border border-line bg-white p-7">
              <h2 id={`${p.id}-h`} className="text-[19px] font-bold">{p.title}</h2>
              <p className="mt-3 text-sm leading-[1.65] text-slate">{p.body}</p>
            </section>
          ))}
        </div>
      </Section>
    </ContentPage>
  );
}
