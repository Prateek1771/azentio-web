import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireGrant } from "@/lib/authz";
import { createInsForgeServerClient } from "@/lib/insforge/server";
import { type ThemeStat, orgCountLabel } from "@/lib/learning/model";
import { Section } from "@/components/portal/primitives";
import { Panel, PortalBand } from "@/components/portal/portal";
import { ThemeForm, type ThemeInit } from "../../forms";
import { EvidenceLinker } from "../../evidence-linker";

export const metadata: Metadata = { title: "Theme" };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ q?: string }> };

async function Theme({ params, searchParams }: Props) {
  await requireGrant("product_owner", "moderate");
  const { id } = await params;
  const isNew = id === "new";
  if (!isNew && !/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const db = (await createInsForgeServerClient()).database;
  const [{ data: offs }, theme, { data: stats }] = await Promise.all([
    db.from("offerings").select("id, name").order("name"),
    isNew ? Promise.resolve({ data: null }) : db.from("themes").select("*, theme_links(shared_contributions(id, title))").eq("id", id).maybeSingle(),
    db.rpc("theme_stats"),
  ]);
  const t = theme.data as (ThemeInit & { theme_links: { shared_contributions: { id: string; title: string } | null }[] }) | null;
  if (!isNew && !t) notFound();
  const init: ThemeInit = t
    ? { ...t, limitations: t.limitations ?? "" }
    : { name: "", summary: "", limitations: "", confidence: "low", status: "draft", offering_ids: [] };
  const stat = ((stats ?? []) as ThemeStat[]).find((s) => s.theme_id === id);

  return (
    <>
      <PortalBand eyebrow="Staff console · Theme" title={isNew ? "New theme" : init.name}>
        <Link href="/s/insights" className="inline-flex items-center gap-2 rounded-[5px] border border-white/40 px-5 py-3 text-sm font-bold hover:border-green hover:text-green">
          <ArrowLeft className="size-4" aria-hidden /> Themes &amp; ideas
        </Link>
      </PortalBand>
      <Section className="py-12">
        <div className="grid grid-cols-2 gap-6 max-[959px]:grid-cols-1">
          <Panel title="Details">
            <ThemeForm id={isNew ? null : id} init={init} offerings={(offs ?? []) as { id: string; name: string }[]} />
          </Panel>
          {!isNew && (
            <Panel title="Evidence" action={<span className="text-xs font-bold text-slate">{orgCountLabel(stat)}</span>}>
              <EvidenceLinker
                table="theme_links"
                owner={id}
                linked={(t?.theme_links ?? []).map((l) => l.shared_contributions).filter(Boolean) as { id: string; title: string }[]}
                q={(await searchParams).q}
              />
            </Panel>
          )}
        </div>
      </Section>
    </>
  );
}

export default function Page(props: Props) {
  return (
    <Suspense fallback={<Section><p className="text-slate">Loading…</p></Section>}>
      <Theme {...props} />
    </Suspense>
  );
}
