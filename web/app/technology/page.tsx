import type { Metadata } from "next";
import { ArrowDown } from "lucide-react";
import { architectureLayers, contentPages } from "@/lib/content";
import { Section, SectionHead } from "@/components/portal/primitives";
import { ContentPage } from "@/components/site/content-page";

const data = contentPages.technology;
export const metadata: Metadata = { title: "Technology & Trust", description: data.lead };

export default function Page() {
  return (
    <ContentPage data={data}>
      <Section muted>
        <SectionHead eyebrow="Reference architecture" title="Intelligence with Governance at Every Layer." />
        <ol className="mx-auto grid max-w-[760px] gap-2" aria-label="Reference architecture layers, top to bottom">
          {architectureLayers.map((l, i) => (
            <li key={l.title} className="grid gap-2">
              <div className={`rounded-[10px] border px-6 py-5 text-center ${i === architectureLayers.length - 1 ? "on-dark border-green bg-navy text-white" : "border-line bg-white"}`}>
                <p className="text-[13px] font-extrabold tracking-[1.5px] uppercase">{l.title}</p>
                {l.items && <p className={`mt-1 text-sm ${i === architectureLayers.length - 1 ? "text-on-dark-muted" : "text-slate"}`}>{l.items}</p>}
              </div>
              {i < architectureLayers.length - 1 && <ArrowDown className="mx-auto size-4 text-green-700" aria-hidden />}
            </li>
          ))}
        </ol>
      </Section>
    </ContentPage>
  );
}
