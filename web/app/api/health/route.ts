import { NextResponse } from "next/server";
import { createInsForgeServerClient } from "@/lib/insforge/server";

// Proves the server → InsForge round-trip without exposing any configuration.
export async function GET() {
  try {
    const insforge = await createInsForgeServerClient();
    await insforge.auth.getPublicAuthConfig();
    return NextResponse.json({ ok: true, insforge: true });
  } catch {
    return NextResponse.json({ ok: false, insforge: false }, { status: 503 });
  }
}
