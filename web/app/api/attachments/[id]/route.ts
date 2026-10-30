import { NextResponse } from "next/server";
import { z } from "zod";
import { createInsForgeServerClient } from "@/lib/insforge/server";
import { createInsForgeAdminClient } from "@/lib/insforge/admin";

// Same audience as the source contribution (RLS on the caller's session); never reachable from a shared copy.
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = z.string().uuid().safeParse((await params).id);
  if (!id.success) return new NextResponse("Not found", { status: 404 });

  const insforge = await createInsForgeServerClient();
  const { data } = await insforge.database.from("contribution_attachments").select("storage_key").eq("id", id.data).maybeSingle();
  if (!data) return new NextResponse("Not found", { status: 404 }); // invisible and nonexistent look the same

  const { data: signed } = await createInsForgeAdminClient().storage.from("attachments").createSignedUrl((data as { storage_key: string }).storage_key, 300);
  if (!signed?.signedUrl) return new NextResponse("Unavailable", { status: 503 });
  return NextResponse.redirect(signed.signedUrl, { headers: { "Cache-Control": "private, no-store" } });
}
