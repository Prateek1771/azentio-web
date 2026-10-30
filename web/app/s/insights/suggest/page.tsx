import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import { requireGrant } from "@/lib/authz";
import { Section } from "@/components/portal/primitives";
import { Panel, PortalBand } from "@/components/portal/portal";
import { DigestGenerator, ThemeSuggester } from "./assist";

export const metadata: Metadata = { title: "AI assists" };

async function Suggest({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requireGrant("product_owner", "moderate");
  const error = (await searchParams).error;
  return (
    <>
      <PortalBand eyebrow="Staff console · Insights" title="AI assists" lead="Suggestions to speed up curation. A person confirms everything; suggested themes start as staff-only drafts.">
        <Link href="/s/insights" className="inline-flex items-center gap-2 rounded-[5px] border border-white/40 px-5 py-3 text-sm font-bold hover:border-green hover:text-green">
          <ArrowLeft className="size-4" aria-hidden /> Themes &amp; ideas
        </Link>
      </PortalBand>
      <Section className="py-12">
        {error && <p role="alert" className="mb-6 rounded-md border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800">{error}</p>}
        <div className="grid grid-cols-2 gap-6 max-[959px]:grid-cols-1">
          <Panel title="Theme suggestions"><ThemeSuggester /></Panel>
          <Panel title="Trend digest"><DigestGenerator /></Panel>
        </div>
      </Section>
    </>
  );
}

export default function Page(props: { searchParams: Promise<{ error?: string }> }) {
  return (
    <Suspense fallback={<Section><p className="text-slate">Loading…</p></Section>}>
      <Suggest {...props} />
    </Suspense>
  );
}
