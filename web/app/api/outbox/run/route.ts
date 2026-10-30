import { timingSafeEqual } from "node:crypto";
import { processOutbox } from "@/lib/email/outbox";

// For an InsForge schedule once deployed: POST with header x-outbox-secret.
export async function POST(request: Request) {
  const secret = process.env.OUTBOX_RUN_SECRET ?? "";
  const given = request.headers.get("x-outbox-secret") ?? "";
  if (!secret || given.length !== secret.length || !timingSafeEqual(Buffer.from(given), Buffer.from(secret)))
    return new Response("Not found", { status: 404 });
  return Response.json(await processOutbox());
}
