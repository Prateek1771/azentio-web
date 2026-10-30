import { z } from "zod";
import { activeWorkspace, getSession, isEmployee, clientOrgs } from "@/lib/authz";
import { createInsForgeServerClient } from "@/lib/insforge/server";
import { createInsForgeAdminClient } from "@/lib/insforge/admin";
import { chat } from "@/lib/ai/gateway";
import { runAira } from "@/lib/aira/run";

const body = z.object({ question: z.string().max(4000) });

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return Response.json({ verdict: "refused", message: "Sign in to ask AIRA.", sources: [] }, { status: 401 });
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ verdict: "refused", message: "Ask a question in plain text.", sources: [] }, { status: 400 });

  const result = await runAira(parsed.data.question, {
    userDb: (await createInsForgeServerClient()).database,
    adminDb: createInsForgeAdminClient().database,
    userId: session.user.id,
    orgId: (await activeWorkspace(session))?.org_id ?? null,
    isMember: isEmployee(session) || clientOrgs(session).length > 0,
    chat: (messages) => chat(messages, { maxTokens: 450 }),
  });
  return Response.json(result, { headers: { "Cache-Control": "private, no-store" } });
}

const feedback = z.object({ id: z.string().uuid(), feedback: z.enum(["up", "down", "correction"]) });

// Feedback updates only the caller's own interaction (RLS policy aira_feedback).
export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session) return new Response(null, { status: 401 });
  const parsed = feedback.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return new Response(null, { status: 400 });
  const { data } = await (await createInsForgeServerClient()).database
    .from("aira_interactions").update({ feedback: parsed.data.feedback }).eq("id", parsed.data.id).select("id");
  return new Response(null, { status: data?.length ? 204 : 404 });
}
