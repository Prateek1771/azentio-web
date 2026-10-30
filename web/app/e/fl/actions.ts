"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireGrant } from "@/lib/authz";
import { createInsForgeServerClient } from "@/lib/insforge/server";

const uuid = z.string().uuid();
const note = (form: FormData) => String(form.get("note") ?? "").trim().slice(0, 1000);
// Our RPCs raise "fl_x: Sentence for people"; anything else stays generic.
const back = (error: { message?: string } | null, done: string): never => {
  revalidatePath("/e/fl");
  const msg = error?.message?.match(/fl_\w+: (.+)/)?.[1];
  redirect(error ? `/e/fl?error=${encodeURIComponent(msg ?? "That change wasn't allowed.")}` : `/e/fl?done=${done}`);
};

export async function decideModel(id: string, status: "approved" | "rejected", form: FormData) {
  await requireGrant("portal_admin");
  const insforge = await createInsForgeServerClient();
  const { error } = await insforge.database.rpc("fl_decide", { p_id: uuid.parse(id), p_status: z.enum(["approved", "rejected"]).parse(status), p_note: note(form) });
  back(error, status);
}

export async function rollbackModel(programId: string, form: FormData) {
  await requireGrant("portal_admin");
  const insforge = await createInsForgeServerClient();
  const { error } = await insforge.database.rpc("fl_rollback", { p_program: uuid.parse(programId), p_note: note(form) });
  back(error, "rolled-back");
}
