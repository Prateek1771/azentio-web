import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { TERMS_VERSION, clientOrgs, requireUser } from "@/lib/authz";
import { createInsForgeServerClient } from "@/lib/insforge/server";
import { Section } from "@/components/portal/primitives";
import { PortalBand } from "@/components/portal/portal";

export const metadata: Metadata = { title: "Workspace terms" };

async function accept(form: FormData) {
  "use server";
  const slug = z.string().regex(/^[a-z0-9-]+$/).parse(form.get("org"));
  const s = await requireUser();
  const org = clientOrgs(s).find((m) => m.slug === slug);
  if (!org) notFound();
  const insforge = await createInsForgeServerClient();
  const { error } = await insforge.database.rpc("accept_terms", { p_org: org.org_id, p_version: TERMS_VERSION });
  if (error) throw new Error("Could not record acceptance");
  redirect(`/c/${slug}`);
}

const POINTS = [
  ["Joining is not consent to share", "Being a member of this workspace never shares your organisation's information with anyone, and never allows it to be used to train models."],
  ["You choose who sees each contribution", "Every observation starts as a private draft. You can keep it private, share it within your organisation, or propose it to the cross-client learning community."],
  ["Community sharing is reviewed", "Proposed contributions are de-identified and reviewed by a moderator before anyone outside your organisation can see them. Organisation attribution is opt-in."],
  ["Four separate permissions", "Storing, publishing, attributing and any future model training are separate choices, recorded with history. You can withdraw a shared contribution at any time."],
  ["Use synthetic or approved data", "Don't include customer identities, account numbers, credentials or confidential contract terms. Warnings and automated scans help, but they're not a guarantee."],
] as const;

async function Terms({ searchParams }: { searchParams: Promise<{ org?: string }> }) {
  const slug = (await searchParams).org ?? "";
  const s = await requireUser(`/onboarding/terms?org=${slug}`);
  const org = clientOrgs(s).find((m) => m.slug === slug);
  if (!org) notFound();

  return (
    <>
      <PortalBand eyebrow={`Welcome to ${org.name}`} title="Before you enter: how sharing works." lead={`Workspace terms, version ${TERMS_VERSION}.`} />
      <Section className="py-14">
        <div className="mx-auto grid max-w-[760px] gap-6">
          <ol className="grid gap-4">
            {POINTS.map(([title, body], i) => (
              <li key={title} className="flex gap-4 rounded-[10px] border border-line bg-white p-6">
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-navy text-sm font-extrabold text-green">{i + 1}</span>
                <div>
                  <h2 className="font-bold">{title}</h2>
                  <p className="mt-1 text-sm leading-[1.65] text-slate">{body}</p>
                </div>
              </li>
            ))}
          </ol>
          <form action={accept} className="flex flex-wrap items-center justify-between gap-4 rounded-[10px] bg-light p-6">
            <input type="hidden" name="org" value={org.slug} />
            <p className="max-w-[440px] text-sm text-slate">By continuing you accept the workspace terms. This does not share anything or consent to model training.</p>
            <button className="rounded-[5px] bg-green px-6 py-3.5 text-sm font-bold text-on-green transition hover:-translate-y-0.5">
              Accept and enter workspace
            </button>
          </form>
        </div>
      </Section>
    </>
  );
}

export default function Page({ searchParams }: { searchParams: Promise<{ org?: string }> }) {
  return (
    <Suspense fallback={<Section><p className="text-slate">Loading…</p></Section>}>
      <Terms searchParams={searchParams} />
    </Suspense>
  );
}
