import "server-only";
import { createAdminClient } from "@insforge/sdk";

// Full-access admin client (bypasses RLS). Only for audited server code: purge, embed, outbox, invites.
// Never import from request paths that act on behalf of a user.
export function createInsForgeAdminClient() {
  const apiKey = process.env.INSFORGE_API_KEY;
  const baseUrl = process.env.NEXT_PUBLIC_INSFORGE_URL;
  if (!apiKey || !baseUrl) throw new Error("INSFORGE_API_KEY and NEXT_PUBLIC_INSFORGE_URL must be set");
  return createAdminClient({ baseUrl, apiKey });
}
