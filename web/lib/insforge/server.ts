import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@insforge/sdk/ssr";

// Per-request, user-scoped client: queries run as the signed-in user so Postgres RLS applies.
export async function createInsForgeServerClient() {
  return createServerClient({ cookies: await cookies() });
}
