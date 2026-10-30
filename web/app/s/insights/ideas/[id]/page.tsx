import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { forbidden, notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireGrant } from "@/lib/authz";
import { createInsForgeServerClient } from "@/lib/insforge/server";
import { IDEA_STATUS } from "@/lib/learning/model";
import { Section } from "@/components/portal/primitives";
import { Panel, PortalBand } from "@/components/portal/portal";
import { IdeaForm, type IdeaInit } from "../../forms";
import { EvidenceLinker } from "../../evidence-linker";

export const metadata: Metadata = { title: "Improvement idea" };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ q?: string }> };
type Row = Omit<IdeaInit, "offering_id" | "theme_id" | "proposed_outcome" | "owner_team" | "public_update"> & {
  offering_id: string | null; theme_id: string | null; proposed_outcome: string | null; owner_team: string | null; public_update: string | null;
  idea_evidence: { shared_contributions: { id: string; title: string } | null }[];
};

async function Idea({ params, searchParams }: Props) {
  const s = await requireGrant("product_owner", "moderate");
  const { id } = await params;
  const isNew = id === "new";
  if (isNew && !s.grants.includes("product_owner")) forbidden();
  if (!isNew && !/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const db = (await createInsForgeServerClient()).database;
  const [{ data: offs }, { data: themes }, idea, { data: history }] = await Promise.all([
    db.from("offerings").select("id, name").order("name"),
    db.from("themes").select("id, name").order("name"),
    isNew ? Promise.resolve({ data: null }) : db.from("ideas").select("*, idea_evidence(shared_contributions(id, title))").eq("id", id).maybeSingle(),
    isNew ? Promise.resolve({ data: [] }) : db.from("idea_status_history").select("from_status, to_status, at").eq("idea_id", id).order("id", { ascending: false }),
  ]);
  const r = idea.data as Row | null;
  if (!isNew && !r) notFound();
  const init: IdeaInit = r
    ? { ...r, offering_id: r.offering_id ?? "", theme_id: r.theme_id ?? "", proposed_outcome: r.proposed_outcome ?? "", owner_team: r.owner_team ?? "", public_update: r.public_update ?? "" }
    : { title: "", problem: "", offering_id: "", theme_id: "", proposed_outcome: "", owner_team: "", priority: "med", status: "proposed", public_update: "", client_visible: false };
  const canEdit = s.grants.includes("product_owner");

  return (
    <>
      <PortalBand eyebrow="Staff console · Improvement idea" title={isNew ? "New improvement idea" : init.title}>
        <Link href="/s/insights" className="inline-flex items-center gap-2 rounded-[5px] border border-white/40 px-5 py-3 text-sm font-bold hover:border-green hover:text-green">
          <ArrowLeft className="size-4" aria-hidden /> Themes &amp; ideas
        </Link>
      </PortalBand>
      <Section className="py-12">
        <div className="grid grid-cols-2 gap-6 max-[959px]:grid-cols-1">
          <Panel title="Details">
            {canEdit ? (
              <IdeaForm id={isNew ? null : id} init={init} offerings={(offs ?? []) as { id: string; name: string }[]} themes={(themes ?? []) as { id: string; name: string }[]} />
            ) : (
              <p className="text-sm">{init.problem}</p>
            )}
          </Panel>
          {!isNew && (
            <div className="grid content-start gap-6">
              {canEdit && (
                <Panel title="Supporting evidence">
                  <EvidenceLinker
                    table="idea_evidence"
                    owner={id}
                    linked={(r?.idea_evidence ?? []).map((l) => l.shared_contributions).filter(Boolean) as { id: string; title: string }[]}
                    q={(await searchParams).q}
                  />
                </Panel>
              )}
              <Panel title="Status history">
                <ol className="grid gap-2 text-sm">
                  {((history ?? []) as { from_status: string | null; to_status: string; at: string }[]).map((h, i) => (
                    <li key={i} className="border-l-2 border-green pl-3">
                      <span className="font-bold">{h.from_status ? `${IDEA_STATUS[h.from_status].label} → ` : "Created as "}{IDEA_STATUS[h.to_status].label}</span>
                      <span className="block text-xs text-slate">{new Date(h.at).toLocaleString("en-GB")}</span>
                    </li>
                  ))}
                </ol>
              </Panel>
            </div>
          )}
        </div>
      </Section>
    </>
  );
}

export default function Page(props: Props) {
  return (
    <Suspense fallback={<Section><p className="text-slate">Loading…</p></Section>}>
      <Idea {...props} />
    </Suspense>
  );
}
