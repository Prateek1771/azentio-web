"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireGrant } from "@/lib/authz";
import { createInsForgeServerClient } from "@/lib/insforge/server";

// Portal admins toggle rules on their own session (RLS: guardrail_rules_admin); every change is audited.
export async function toggleRule(form: FormData) {
  await requireGrant("portal_admin");
  const key = z.string().regex(/^[a-z0-9_.-]{2,80}$/).safeParse(form.get("key"));
  if (!key.success) return;
  await (await createInsForgeServerClient()).database.from("guardrail_rules").update({ enabled: form.get("enabled") === "true" }).eq("key", key.data);
  revalidatePath("/s/aira");
}
