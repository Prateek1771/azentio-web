"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOrg } from "@/lib/authz";
import { createInsForgeServerClient } from "@/lib/insforge/server";

export type FlState = { error?: string; ok?: string };

// fl_enroll / fl_withdraw re-check client-admin rights and the consent flag in the database.
export async function setEnrolment(slug: string, programId: string, join: boolean, _: FlState, form: FormData): Promise<FlState> {
  const { org } = await requireOrg(slug);
  if (org.role !== "client_admin") return { error: "Only a client admin can change programme enrolment." };
  if (join && form.get("consent") !== "on") return { error: "Tick the model-training consent to join." };
  const insforge = await createInsForgeServerClient();
  const { error } = join
    ? await insforge.database.rpc("fl_enroll", { p_program: z.string().uuid().parse(programId), p_org: org.org_id, p_consent: true })
    : await insforge.database.rpc("fl_withdraw", { p_program: z.string().uuid().parse(programId), p_org: org.org_id });
  if (error) return { error: "Couldn't update enrolment. Try again." };
  revalidatePath(`/c/${slug}`);
  return { ok: join ? "Enrolled. Your organisation joins from the next training run." : "Withdrawn. Your organisation is excluded from future runs." };
}
