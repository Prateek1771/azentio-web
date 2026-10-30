import type { Metadata } from "next";
import { Suspense } from "react";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { WORKSPACE_COOKIE, clientOrgs, isEmployee, requireUser } from "@/lib/authz";
import { EmptyState, Section } from "@/components/portal/primitives";
import { PortalBand, Tile, roleLabel } from "@/components/portal/portal";

export const metadata: Metadata = { title: "Choose a workspace" };

async function selectWorkspace(form: FormData) {
  "use server";
  const slug = z.string().regex(/^[a-z0-9-]+$/).parse(form.get("org"));
  const s = await requireUser();
  if (!clientOrgs(s).some((m) => m.slug === slug)) notFound();
  (await cookies()).set(WORKSPACE_COOKIE, slug, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 30 });
  redirect(`/c/${slug}`);
}

async function Picker() {
  const s = await requireUser("/workspace");
  const orgs = clientOrgs(s);
  return (
    <>
      <PortalBand eyebrow="Workspaces" title="Choose a workspace." lead="You belong to more than one organisation. Each workspace is separate: nothing crosses between them." />
      <Section className="py-14">
        {orgs.length ? (
          <ul className="grid grid-cols-3 gap-5 max-[959px]:grid-cols-2 max-sm:grid-cols-1">
            {orgs.map((o) => (
              <li key={o.slug}>
                <form action={selectWorkspace}>
                  <input type="hidden" name="org" value={o.slug} />
                  <button className="lift w-full rounded-[10px] border border-line bg-white p-6 text-left">
                    <span className="eyebrow">{roleLabel(o.role)}</span>
                    <span className="mt-2 block text-xl font-bold">{o.name}</span>
                    <span className="mt-3 block text-[13px] font-extrabold text-green-700">Enter workspace ↗</span>
                  </button>
                </form>
              </li>
            ))}
            {isEmployee(s) && (
              <li>
                <Tile title="Employee portal" body="Your Azentio workspace." href="/e" className="h-full" />
              </li>
            )}
          </ul>
        ) : (
          <EmptyState title="No client workspaces" body="You're not a member of any client organisation." />
        )}
      </Section>
    </>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<Section><p className="text-slate">Loading…</p></Section>}>
      <Picker />
    </Suspense>
  );
}
