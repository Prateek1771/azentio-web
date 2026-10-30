import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createInsForgeServerClient } from "@/lib/insforge/server";
import { EmptyState, Eyebrow, Section } from "@/components/portal/primitives";
import { signOut } from "../login/actions";

export const metadata: Metadata = { title: "Your account" };

type Membership = { role: string; status: string; orgs: { name: string; kind: string; slug: string } | null };

async function AccountDetails() {
  const insforge = await createInsForgeServerClient();
  const { data: auth } = await insforge.auth.getCurrentUser();
  if (!auth?.user) redirect("/login");

  // Everything below is read through RLS as the signed-in user.
  const [{ data: memberships }, { data: grants }] = await Promise.all([
    insforge.database.from("memberships").select("role, status, orgs(name, kind, slug)").eq("user_id", auth.user.id),
    insforge.database.from("grants").select("kind").eq("user_id", auth.user.id),
  ]);
  const ms = (memberships ?? []) as unknown as Membership[];

  return (
    <div className="grid gap-8">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <Eyebrow>Signed in</Eyebrow>
          <h1 className="h-section mt-3 break-all">{auth.user.email}</h1>
        </div>
        <form action={signOut}>
          <button className="rounded-[5px] border border-line-strong px-5 py-3 text-sm font-bold hover:border-green-700 hover:text-green-700">
            Sign out
          </button>
        </form>
      </div>

      <div className="grid grid-cols-2 gap-5 max-md:grid-cols-1">
        <div className="rounded-[10px] border border-line bg-white p-7">
          <h2 className="text-[19px] font-bold">Organisations</h2>
          {ms.length ? (
            <ul className="mt-4 grid gap-3">
              {ms.map((m) => (
                <li key={m.orgs?.slug} className="flex items-center justify-between rounded-lg bg-light px-4 py-3">
                  <span className="font-bold">{m.orgs?.name}</span>
                  <span className="text-xs font-bold tracking-wide text-green-700 uppercase">{m.role.replace("_", " ")}</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-4">
              <EmptyState
                title="No workspace yet"
                body="Your email isn't linked to an organisation. Ask your client administrator for an invitation, or an Azentio admin to approve your employee access."
              />
            </div>
          )}
        </div>
        <div className="rounded-[10px] border border-line bg-white p-7">
          <h2 className="text-[19px] font-bold">Permissions</h2>
          {grants?.length ? (
            <ul className="mt-4 flex flex-wrap gap-2">
              {(grants as { kind: string }[]).map((g) => (
                <li key={g.kind} className="rounded-full bg-navy px-3 py-1.5 text-xs font-bold text-green">
                  {g.kind.replace("_", " ")}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-slate">No platform grants. Access comes from your organisation membership.</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AccountPage() {
  return (
    <Section>
      <Suspense fallback={<p className="text-slate">Loading your account…</p>}>
        <AccountDetails />
      </Suspense>
    </Section>
  );
}
