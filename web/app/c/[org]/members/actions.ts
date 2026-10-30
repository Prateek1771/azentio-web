"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOrg } from "@/lib/authz";
import { createInsForgeServerClient } from "@/lib/insforge/server";

export type InviteState = { error?: string; link?: string; email?: string };

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
  // The raw token is shown once and never stored; only its hash lives in the database.
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3100";
  return { link: `${base}/invite/${data as string}`, email: parsed.data.email };
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
