import { NextResponse } from "next/server";
import { z } from "zod";
import { createInsForgeServerClient } from "@/lib/insforge/server";
import { createInsForgeAdminClient } from "@/lib/insforge/admin";

// Audience-checked media access. Visibility is decided by RLS on the caller's own session;
// only after that succeeds do we mint a short-lived signed URL for private storage objects.
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = z.string().uuid().safeParse((await params).id);
  if (!id.success) return new NextResponse("Not found", { status: 404 });

  const insforge = await createInsForgeServerClient();
  const { data } = await insforge.database.from("media").select("storage_key, embed_url").eq("id", id.data).maybeSingle();
  const row = data as { storage_key: string | null; embed_url: string | null } | null;
  if (!row) return new NextResponse("Not found", { status: 404 }); // invisible and nonexistent look the same

  if (row.storage_key) {
    const { data: signed } = await createInsForgeAdminClient().storage.from("media").createSignedUrl(row.storage_key, 300);
    if (!signed?.signedUrl) return new NextResponse("Unavailable", { status: 503 });
    return NextResponse.redirect(signed.signedUrl, { headers: { "Cache-Control": "private, no-store" } });
  }
  return NextResponse.redirect(row.embed_url!, { headers: { "Cache-Control": "private, no-store" } });
}
