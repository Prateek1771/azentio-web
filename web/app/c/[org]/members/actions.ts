"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireOrg } from "@/lib/authz";
import { createInsForgeServerClient } from "@/lib/insforge/server";
import { enqueueEmail } from "@/lib/email/outbox";

export type InviteState = { error?: string; link?: string; email?: string; emailed?: boolean };

const inviteSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address.").max(254),
  role: z.enum(["client_member", "client_admin"]),
});

export async function createInvite(slug: string, _: InviteState, form: FormData): Promise<InviteState> {
  const { org } = await requireOrg(slug);
  if (org.role !== "client_admin") return { error: "Only client administrators can invite members." };
  const parsed = inviteSchema.safeParse({ email: form.get("email"), role: form.get("role") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const insforge = await createInsForgeServerClient();
  const { data, error } = await insforge.database.rpc("create_invitation", {
    p_org: org.org_id,
    p_email: parsed.data.email,
    p_role: parsed.data.role,
  });
  if (error) {
    const msg = /already a member/i.test(error.message) ? "That person is already a member." : "Couldn't create the invitation.";
    return { error: msg };
  }
  revalidatePath(`/c/${slug}/members`);
  // The raw token is shown once and never stored; only its hash lives in the database. The emailed copy
  // sits in the outbox payload until sent, then the payload is scrubbed.
  const token = data as string;
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3100";
  const emailed = await enqueueEmail(`invite:${createHash("sha256").update(token).digest("hex")}`, parsed.data.email, "invite", {
    org: org.name,
    path: `/invite/${token}`,
  });
  return { link: `${base}/invite/${token}`, email: parsed.data.email, emailed };
}

export async function revokeInvite(slug: string, form: FormData) {
  const { org } = await requireOrg(slug);
  if (org.role !== "client_admin") return;
  const id = z.string().uuid().safeParse(form.get("id"));
  if (!id.success) return;
  const insforge = await createInsForgeServerClient();
  await insforge.database
    .from("invitations")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id.data)
    .eq("org_id", org.org_id);
  revalidatePath(`/c/${slug}/members`);
}

// Client roles only; the DB refuses everything else (employee role, other orgs, removing the last admin).
export async function manageMember(slug: string, form: FormData) {
  const { org } = await requireOrg(slug);
  if (org.role !== "client_admin") return;
  const user = z.string().uuid().safeParse(form.get("user"));
  const op = z.enum(["admin", "member", "remove"]).safeParse(form.get("op"));
  if (!user.success || !op.success) return;
  const db = (await createInsForgeServerClient()).database;
  const q =
    op.data === "remove"
      ? db.from("memberships").delete().eq("org_id", org.org_id).eq("user_id", user.data).select("id")
      : db.from("memberships").update({ role: op.data === "admin" ? "client_admin" : "client_member" }).eq("org_id", org.org_id).eq("user_id", user.data).select("id");
  const { data, error } = await q;
  revalidatePath(`/c/${slug}/members`);
  if (error || !data?.length) {
    const msg = /at least one active administrator/i.test(error?.message ?? "") ? "Your organisation needs at least one administrator." : "That change isn't allowed.";
    redirect(`/c/${slug}/members?error=${encodeURIComponent(msg)}`);
  }
}
