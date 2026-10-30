import "server-only";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { createServerClient } from "@insforge/sdk/ssr";

// Per-request, user-scoped client: queries run as the signed-in user so Postgres RLS applies.
// connection() marks the caller as request-time (the SDK reads the clock to check token expiry).
export async function createInsForgeServerClient() {
  await connection();
  return createServerClient({ cookies: await cookies() });
}
