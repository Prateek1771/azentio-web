import type { Metadata } from "next";
import { productCategories, products } from "@/lib/content";
import { PageHero, Section } from "@/components/portal/primitives";
import { CtaPanel, ProductCard } from "@/components/portal/cards";

export const metadata: Metadata = {
  title: "Products",
  description: "Applied AI experiences, from credit decisioning to reporting and document intelligence.",
};

export default function ProductsPage() {
  return (
    <>
      <PageHero
        eyebrow="Our products"
        title="Intelligent Products. Real-World Purpose."
        lead="Explore a growing portfolio of applied AI experiences, from credit decisioning to reporting and document intelligence."
      />
      <Section>
        <div className="grid gap-16">
          {productCategories.map((c) => (
            <section key={c.id} id={c.id} aria-labelledby={`${c.id}-h`}>
              <h2 id={`${c.id}-h`} className="mb-7 text-[28px] font-bold tracking-[-1px]">{c.name}</h2>
              <div className="grid grid-cols-4 gap-5 max-[1100px]:grid-cols-2 max-sm:grid-cols-1">
                {products.filter((p) => p.category === c.name).map((p) => (
                  <ProductCard key={p.slug} product={p} />
                ))}
              </div>
            </section>
          ))}
        </div>
        <p className="mt-10 text-xs text-slate">
          Product capabilities and release readiness must be validated before public marketing or customer commitments.
        </p>
      </Section>
      <CtaPanel eyebrow="Build what's next" />
    </>
  );
}
