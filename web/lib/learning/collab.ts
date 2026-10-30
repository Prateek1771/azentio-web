"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireMember, requireUser } from "@/lib/authz";
import { createInsForgeServerClient } from "@/lib/insforge/server";

export type CommentState = { error?: string; ok?: boolean };

const uuid = z.string().uuid();
const path = z.string().regex(/^\/[a-z0-9/_-]*$/i).catch("/learning");
const db = async () => (await createInsForgeServerClient()).database;

// RLS decides everything here: own rows only, and only on parents the user can already see.
export async function addComment(type: "shared" | "content" | "experiment", parentId: string, back: string, _: CommentState, form: FormData): Promise<CommentState> {
  await requireUser();
  const body = String(form.get("body") ?? "").trim();
  if (body.length < 2 || body.length > 2000) return { error: "Comments need 2–2,000 characters." };
  const { error } = await (await db()).from("comments").insert([{ parent_type: type, parent_id: uuid.parse(parentId), body }]);
  if (error)
    return { error: /contact details|account numbers/i.test(error.message ?? "") ? "Comments can't include contact details, ID or account numbers." : "Couldn't post your comment." };
  revalidatePath(path.parse(back));
  return { ok: true };
}

export async function commentAction(back: string, form: FormData) {
  await requireUser();
  const id = uuid.safeParse(form.get("id"));
  if (!id.success) return;
  const d = await db();
  if (form.get("op") === "hide") await d.from("comments").update({ hidden: true }).eq("id", id.data);
  else await d.from("comments").delete().eq("id", id.data);
  revalidatePath(path.parse(back));
}

export async function toggleBookmark(sharedId: string, on: boolean) {
  await requireMember();
  const d = await db();
  if (on) await d.from("bookmarks").insert([{ shared_id: uuid.parse(sharedId) }]);
  else await d.from("bookmarks").delete().eq("shared_id", uuid.parse(sharedId));
  revalidatePath(`/learning/${sharedId}`);
  revalidatePath("/learning/saved");
}

export async function setFeedback(sharedId: string, kind: "useful" | "needs_evidence" | null) {
  await requireMember();
  const d = await db();
  await d.from("shared_feedback").delete().eq("shared_id", uuid.parse(sharedId));
  if (kind) await d.from("shared_feedback").insert([{ shared_id: sharedId, kind }]);
  revalidatePath(`/learning/${sharedId}`);
}

const QUERY_KEYS = ["q", "offering", "industry", "region", "year", "type"] as const;

export async function saveSearch(form: FormData) {
  await requireMember();
  const name = String(form.get("name") ?? "").trim().slice(0, 80);
  const query = Object.fromEntries(QUERY_KEYS.map((k) => [k, String(form.get(k) ?? "").slice(0, 200)]).filter(([, v]) => v));
  if (!name || !Object.keys(query).length) return;
  await (await db()).from("saved_searches").insert([{ name, query }]);
  revalidatePath("/learning/saved");
  redirect("/learning/saved"); // confirms the save by showing it
}

export async function deleteSavedSearch(form: FormData) {
  await requireMember();
  const id = uuid.safeParse(form.get("id"));
  if (id.success) await (await db()).from("saved_searches").delete().eq("id", id.data);
  revalidatePath("/learning/saved");
}

export async function acknowledge(contentId: string, back: string) {
  await requireUser();
  await (await db()).from("acknowledgements").insert([{ content_id: uuid.parse(contentId) }]);
  revalidatePath(path.parse(back));
}
