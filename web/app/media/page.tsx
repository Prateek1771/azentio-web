import type { Metadata } from "next";
import { Suspense } from "react";
import { PlayCircle } from "lucide-react";
import { mediaShowcases } from "@/lib/content";
import { createInsForgeServerClient } from "@/lib/insforge/server";
import { PageHero, Section } from "@/components/portal/primitives";
import { CtaPanel } from "@/components/portal/cards";

export const metadata: Metadata = {
  title: "Media & Videos",
  description: "Product demonstrations, explainers, engineering stories, and ideas in motion.",
};

type Media = { id: string; title: string; summary: string | null; embed_url: string | null };

// Published public videos added by a publisher (Phase 4). RLS returns only public + published rows to visitors.
async function PublishedMedia() {
  const insforge = await createInsForgeServerClient();
  const { data } = await insforge.database.from("media").select("id, title, summary, embed_url").eq("audience", "public").eq("published", true).not("embed_url", "is", null);
  const items = (data ?? []) as Media[];
  if (!items.length) return null;
  return (
    <div className="mb-10 grid grid-cols-2 gap-5 max-md:grid-cols-1">
      {items.map((m) => (
        <article key={m.id} className="overflow-hidden rounded-[10px] border border-line">
          <iframe src={m.embed_url!} title={m.title} className="aspect-video w-full bg-navy-900" allow="encrypted-media; picture-in-picture" allowFullScreen loading="lazy" />
          <div className="p-5">
            <h2 className="text-[17px] font-bold">{m.title}</h2>
            {m.summary && <p className="mt-1 text-sm text-slate">{m.summary}</p>}
          </div>
        </article>
      ))}
    </div>
  );
}

export default function Page() {
  return (
    <>
      <PageHero eyebrow="Media & Videos" title="See the Thinking. Experience the Technology." lead="Product demonstrations, explainers, engineering stories, and ideas in motion." />
      <Section>
        <Suspense>
          <PublishedMedia />
        </Suspense>
        <div className="grid grid-cols-4 gap-5 max-[1100px]:grid-cols-2 max-sm:grid-cols-1">
          {mediaShowcases.map((m, i) => (
            <article key={m.title} className="overflow-hidden rounded-[10px] border border-line">
              <div className={`on-dark relative grid aspect-video place-items-center text-white ${["bg-[radial-gradient(circle_at_50%_45%,#416e68,#112334_70%)]", "bg-[radial-gradient(circle_at_55%_45%,#365b91,#101d37_70%)]", "bg-[radial-gradient(circle_at_50%_45%,#416d57,#132d36_70%)]", "bg-[radial-gradient(circle_at_50%_45%,#405c78,#142239_70%)]"][i % 4]}`}>
                <PlayCircle className="size-12 text-white/70" aria-hidden />
                <span className="absolute bottom-3 left-3 rounded-full bg-black/30 px-2.5 py-1 text-[10px] font-bold tracking-[1.5px] uppercase">Video coming soon</span>
              </div>
              <div className="p-5">
                <p className="eyebrow">{m.kind}</p>
                <h2 className="mt-2 text-[17px] font-bold">{m.title}</h2>
                <p className="mt-1 text-sm leading-[1.6] text-slate">{m.summary}</p>
              </div>
            </article>
          ))}
        </div>
      </Section>
      <CtaPanel eyebrow="Build what's next" />
    </>
  );
}
