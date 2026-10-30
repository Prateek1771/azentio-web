import "server-only";
import { after } from "next/server";
import { createInsForgeAdminClient } from "@/lib/insforge/admin";
import { runOutbox } from "./worker";

export async function processOutbox() {
  const admin = createInsForgeAdminClient();
  return runOutbox(admin.database, async (m) => {
    const { error } = await admin.emails.send({ ...m, from: "azentio.ai" });
    return { error: error?.message };
  });
}

// Fire the worker after the response is sent; failures stay in the outbox for the next run.
export function kickOutbox() {
  after(() => processOutbox().catch(() => {}));
}

export async function enqueueEmail(key: string, to: string, template: string, payload: Record<string, unknown>) {
  const { error } = await createInsForgeAdminClient()
    .database.from("outbox")
    .upsert([{ idempotency_key: key, to_email: to, template, payload }], { onConflict: "idempotency_key", ignoreDuplicates: true });
  if (!error) kickOutbox();
  return !error;
}
