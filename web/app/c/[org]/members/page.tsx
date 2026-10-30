import type { Metadata } from "next";
import { Suspense } from "react";
import { forbidden } from "next/navigation";
import { requireOrg } from "@/lib/authz";
import { createInsForgeServerClient } from "@/lib/insforge/server";
import { EmptyState, Section } from "@/components/portal/primitives";
import { Panel, PortalBand, roleLabel } from "@/components/portal/portal";
import { InviteForm } from "./invite-form";
import { manageMember, revokeInvite } from "./actions";

export const metadata: Metadata = { title: "Members & invitations" };

type Member = { user_id: string; email: string; role: string; status: string };
type Invite = { id: string; email: string; role: string; expires_at: string; used_at: string | null; revoked_at: string | null };

const inviteStatus = (i: Invite) =>
  i.used_at ? "accepted" : i.revoked_at ? "revoked" : new Date(i.expires_at) < new Date() ? "expired" : "pending";

async function Members({ params, searchParams }: { params: Promise<{ org: string }>; searchParams: Promise<{ error?: string }> }) {
  const { org, session } = await requireOrg((await params).org);
  if (org.role !== "client_admin") forbidden();
  const insforge = await createInsForgeServerClient();
  const [{ data: members }, { data: invites }] = await Promise.all([
    insforge.database.rpc("org_members", { p_org: org.org_id }),
    insforge.database.from("invitations").select("id, email, role, expires_at, used_at, revoked_at").eq("org_id", org.org_id).order("created_at", { ascending: false }).limit(20),
  ]);
  const ms = (members ?? []) as Member[];
  const inv = (invites ?? []) as Invite[];

  return (
    <>
      <PortalBand eyebrow={`${org.name} · Administration`} title="Members & invitations" lead="Invite people into your organisation only. Client roles only: platform roles can never be granted from here." />
      <Section className="py-14">
        <div className="grid gap-6">
          {(await searchParams).error && <p role="alert" className="rounded-md border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800">{(await searchParams).error}</p>}
          <Panel title="Invite someone">
            <InviteForm slug={org.slug} />
          </Panel>
          <div className="grid grid-cols-2 gap-6 max-md:grid-cols-1">
            <Panel title={`Members (${ms.length})`}>
              <ul className="grid grid-cols-1 gap-2">
                {ms.map((m) => (
                  <li key={m.user_id} className="grid gap-2 rounded-lg bg-light px-4 py-3 text-sm">
                    <span className="flex flex-wrap items-center justify-between gap-2">
                      <span className="min-w-0 break-all font-bold">{m.email}{m.user_id === session.user.id && " (you)"}</span>
                      <span className="text-xs font-bold tracking-wide text-green-700 uppercase">{roleLabel(m.role)} · {m.status}</span>
                    </span>
                    {m.status === "active" && (
                      <form action={manageMember.bind(null, org.slug)} className="flex flex-wrap gap-2">
                        <input type="hidden" name="user" value={m.user_id} />
                        <button name="op" value={m.role === "client_admin" ? "member" : "admin"} className="rounded-[5px] border border-line-strong bg-white px-3 py-1.5 text-xs font-bold hover:border-green-700">
                          {m.role === "client_admin" ? "Make member" : "Make administrator"}
                        </button>
                        <button name="op" value="remove" className="rounded-[5px] border border-orange-300 bg-white px-3 py-1.5 text-xs font-bold text-orange-800 hover:bg-orange-50">
                          Remove
                        </button>
                      </form>
                    )}
                  </li>
                ))}
              </ul>
            </Panel>
            <Panel title="Invitations">
              {inv.length ? (
                <ul className="grid grid-cols-1 gap-2">
                  {inv.map((i) => {
                    const st = inviteStatus(i);
                    return (
                      <li key={i.id} className="flex items-center justify-between gap-3 rounded-lg bg-light px-4 py-3 text-sm">
                        <span className="min-w-0 truncate font-bold">{i.email}</span>
                        <span className="flex shrink-0 items-center gap-3">
                          <span className="text-xs font-bold tracking-wide text-slate uppercase">{roleLabel(i.role)} · {st}</span>
                          {st === "pending" && (
                            <form action={revokeInvite.bind(null, org.slug)}>
                              <input type="hidden" name="id" value={i.id} />
                              <button className="text-xs font-bold text-orange-700 hover:underline">Revoke</button>
                            </form>
                          )}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <EmptyState title="No invitations yet" body="Invitations you create appear here with their status." />
              )}
            </Panel>
          </div>
        </div>
      </Section>
    </>
  );
}

export default function Page(props: { params: Promise<{ org: string }>; searchParams: Promise<{ error?: string }> }) {
  return (
    <Suspense fallback={<Section><p className="text-slate">Loading…</p></Section>}>
      <Members {...props} />
    </Suspense>
  );
}
