"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireGrant, requireUser } from "@/lib/authz";
import { createInsForgeServerClient } from "@/lib/insforge/server";

export type ActionState = { error?: string; ok?: string; values?: Record<string, string> };

const uuid = z.string().uuid();
const text = (form: FormData, k: string) => String(form.get(k) ?? "").trim();
// Messages raised by our own triggers are written for people; anything else stays generic.
const friendly = (e: { message?: string } | null, fallback: string) =>
  e?.message && /contribution|review|moderat|shared copy|report|transition|reason/i.test(e.message) ? e.message.replace(/^.*?:\s*(?=[A-Z])/, "") : fallback;
const values = (form: FormData) => Object.fromEntries([...form.entries()].filter(([, v]) => typeof v === "string") as [string, string][]);

// ── moderation ───────────────────────────────────────────────────────────
export async function publishShared(id: string, _: ActionState, form: FormData): Promise<ActionState> {
  await requireGrant("moderate");
  const insforge = await createInsForgeServerClient();
  const { error } = await insforge.database.rpc("moderate_publish", {
    p_id: uuid.parse(id),
    p_title: text(form, "title"),
    p_body: text(form, "body"),
    p_industry: text(form, "industry"),
    p_region: text(form, "region"),
  });
  if (error) return { error: friendly(error, "Couldn't publish the shared copy."), values: values(form) };
  revalidatePath("/s/moderation", "layout");
  revalidatePath("/learning", "layout");
  redirect(`/s/moderation/${id}?done=published`);
}

const moderationSchema = z.object({
  id: uuid,
  to: z.enum(["returned", "rejected", "unpublished", "published", "withdrawn"]),
  reason: z.string().trim().max(1000).optional(),
});

export async function moderate(_: ActionState, form: FormData): Promise<ActionState> {
  await requireGrant("moderate");
  const parsed = moderationSchema.safeParse({ id: form.get("id"), to: form.get("to"), reason: form.get("reason") || undefined });
  if (!parsed.success) return { error: "Invalid request." };
  const { id, to, reason } = parsed.data;
  if ((to === "returned" || to === "rejected") && (reason?.length ?? 0) < 5)
    return { error: "Give the contributor a reason (at least 5 characters)." };
  const insforge = await createInsForgeServerClient();
  const patch = to === "returned" || to === "rejected" ? { state: to, moderator_reason: reason } : { state: to };
  const { data, error } = await insforge.database.from("contributions").update(patch).eq("id", id).select("id");
  if (error || !data?.length) return { error: friendly(error, "That change isn't allowed from the current state.") };
  revalidatePath("/s/moderation", "layout");
  revalidatePath("/learning", "layout");
  return { ok: to };
}

// ── reports ──────────────────────────────────────────────────────────────
export async function reportShared(sharedId: string, _: ActionState, form: FormData): Promise<ActionState> {
  await requireUser();
  const reason = text(form, "reason");
  if (reason.length < 5) return { error: "Tell the moderators what's wrong (at least 5 characters)." };
  const insforge = await createInsForgeServerClient();
  const { error } = await insforge.database.from("reports").insert([{ shared_id: uuid.parse(sharedId), reason: reason.slice(0, 1000) }]);
  if (error) return { error: /duplicate|unique/i.test(error.message ?? "") ? "You've already reported this; moderators are looking at it." : "Couldn't send the report." };
  return { ok: "Thanks. A moderator will review it; you'll get a notification with the decision." };
}

const decisionSchema = z.object({
  id: uuid,
  contribution: uuid,
  decision: z.enum(["unpublish", "upheld", "dismissed"]),
  note: z.string().trim().max(1000).optional(),
});

export async function decideReport(form: FormData): Promise<void> {
  await requireGrant("moderate");
  const parsed = decisionSchema.safeParse({ id: form.get("id"), contribution: form.get("contribution"), decision: form.get("decision"), note: form.get("note") || undefined });
  if (!parsed.success) return;
  const { id, contribution, decision, note } = parsed.data;
  const db = (await createInsForgeServerClient()).database;
  if (decision === "unpublish") {
    await db.from("contributions").update({ state: "unpublished" }).eq("id", contribution).eq("state", "published");
  } else {
    await db.from("reports").update({ status: decision, decision_note: note ?? null }).eq("id", id);
    // upheld → withdrawn (purged everywhere); dismissed → back on the feed if it was hidden
    if (decision === "upheld") await db.from("contributions").update({ state: "withdrawn" }).eq("id", contribution).in("state", ["published", "unpublished"]);
    else await db.from("contributions").update({ state: "published" }).eq("id", contribution).eq("state", "unpublished");
  }
  revalidatePath("/s/reports");
  revalidatePath("/learning", "layout");
}

// ── themes ───────────────────────────────────────────────────────────────
const themeSchema = z.object({
  name: z.string().trim().min(3, "Name needs at least 3 characters.").max(120),
  summary: z.string().trim().min(10, "Summarise the theme in at least 10 characters.").max(2000),
  limitations: z.string().trim().max(1000).transform((v) => v || null),
  confidence: z.enum(["low", "med", "high"]),
  status: z.enum(["draft", "confirmed"]),
});

export async function saveTheme(id: string | null, _: ActionState, form: FormData): Promise<ActionState> {
  await requireGrant("product_owner", "moderate");
  const parsed = themeSchema.safeParse(values(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message, values: values(form) };
  const offering_ids = form.getAll("offering_ids").map(String).filter((v) => uuid.safeParse(v).success);
  const db = (await createInsForgeServerClient()).database;
  const row = { ...parsed.data, offering_ids };
  const { data, error } = id
    ? await db.from("themes").update(row).eq("id", id).select("id").single()
    : await db.from("themes").insert([row]).select("id").single();
  if (error) return { error: /unique|duplicate/i.test(error.message ?? "") ? "A theme with that name already exists." : "Couldn't save the theme.", values: values(form) };
  revalidatePath("/s/insights", "layout");
  revalidatePath("/learning", "layout");
  redirect(`/s/insights/themes/${(data as { id: string }).id}`);
}

export async function toggleLink(table: "theme_links" | "idea_evidence", form: FormData): Promise<void> {
  await requireGrant(...(table === "theme_links" ? (["product_owner", "moderate"] as const) : (["product_owner"] as const)));
  const owner = uuid.safeParse(form.get("owner"));
  const shared = uuid.safeParse(form.get("shared"));
  if (!owner.success || !shared.success) return;
  const key = table === "theme_links" ? "theme_id" : "idea_id";
  const db = (await createInsForgeServerClient()).database;
  if (form.get("op") === "remove") await db.from(table).delete().eq(key, owner.data).eq("shared_id", shared.data);
  else await db.from(table).insert([{ [key]: owner.data, shared_id: shared.data }]);
  revalidatePath("/s/insights", "layout");
  revalidatePath("/learning", "layout");
}

// ── ideas ────────────────────────────────────────────────────────────────
const IDEA_STATUS = ["proposed", "under_review", "planned", "in_progress", "released", "not_proceeding"] as const;
const opt = (max: number) => z.string().trim().max(max).transform((v) => v || null);
const ideaSchema = z.object({
  title: z.string().trim().min(5, "Title needs at least 5 characters.").max(140),
  problem: z.string().trim().min(10, "Describe the problem in at least 10 characters.").max(2000),
  offering_id: z.union([z.literal(""), uuid]).transform((v) => v || null),
  theme_id: z.union([z.literal(""), uuid]).transform((v) => v || null),
  proposed_outcome: opt(2000),
  owner_team: opt(80),
  priority: z.enum(["low", "med", "high"]),
  status: z.enum(IDEA_STATUS),
  public_update: opt(600),
});

export async function saveIdea(id: string | null, _: ActionState, form: FormData): Promise<ActionState> {
  await requireGrant("product_owner");
  const parsed = ideaSchema.safeParse(values(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message, values: values(form) };
  const row = { ...parsed.data, client_visible: form.get("client_visible") === "on" };
  const db = (await createInsForgeServerClient()).database;
  const { data, error } = id
    ? await db.from("ideas").update(row).eq("id", id).select("id").single()
    : await db.from("ideas").insert([row]).select("id").single();
  if (error) return { error: "Couldn't save the idea.", values: values(form) };
  revalidatePath("/s/insights", "layout");
  revalidatePath("/learning", "layout");
  redirect(`/s/insights/ideas/${(data as { id: string }).id}`);
}
