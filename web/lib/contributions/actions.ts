"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireOrg, requireUser } from "@/lib/authz";
import { createInsForgeServerClient } from "@/lib/insforge/server";
import { type Consents, contributionSchema } from "./model";

export type FormState = { error?: string; fieldErrors?: Record<string, string>; values?: Record<string, string> };

// Our trigger messages are written for people; anything else stays generic.
const OURS = /contribution|consent|visibility|transition|review|closed|edited|moderator/i;
const friendly = (e: { message?: string } | null, fallback: string) =>
  e?.message && OURS.test(e.message) ? e.message.replace(/^.*?:\s*(?=[A-Z])/, "") : fallback;

const flag = (form: FormData, k: string) => form.get(k) === "on";

export async function saveContribution(slug: string, id: string | null, _: FormState, form: FormData): Promise<FormState> {
  const { org } = await requireOrg(slug);
  const values = Object.fromEntries(
    [...form.entries()].filter(([, v]) => typeof v === "string") as [string, string][],
  );
  const parsed = contributionSchema.safeParse(values);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[String(i.path[0])] ??= i.message;
    return { error: "Please fix the highlighted fields.", fieldErrors, values };
  }
  const intent = z.enum(["save", "share", "submit"]).catch("save").parse(form.get("intent"));
  const consents: Consents = { store: flag(form, "store"), publish: flag(form, "publish"), attribute: flag(form, "attribute"), train: flag(form, "train") };
  if (intent === "submit" && !(consents.store && consents.publish))
    return { error: "To propose this to the community, consent to storing and publishing it.", values };

  const insforge = await createInsForgeServerClient();
  const db = insforge.database;
  let cid = id;

  // Consents are appended (history kept) only when they change, and before any review transition.
  const recordConsents = async (contributionId: string) => {
    const { data: last } = await db.from("consents").select("store, publish, attribute, train")
      .eq("contribution_id", contributionId).order("id", { ascending: false }).limit(1);
    const prev = (last?.[0] ?? null) as Consents | null;
    if (prev && (Object.keys(consents) as (keyof Consents)[]).every((k) => prev[k] === consents[k])) return null;
    if (!prev && !Object.values(consents).some(Boolean)) return null;
    const { error } = await db.from("consents").insert([{ contribution_id: contributionId, ...consents }]);
    return error ? "Consent can't change once an item is in review. Withdraw it instead." : null;
  };

  if (!cid) {
    const { data, error } = await db.from("contributions").insert([{ org_id: org.org_id, ...parsed.data }]).select("id").single();
    if (error) return { error: friendly(error, "Couldn't save the draft."), values };
    cid = (data as { id: string }).id;
    const ce = await recordConsents(cid);
    if (ce) return { error: ce, values };
  } else {
    const ce = await recordConsents(cid);
    if (ce) return { error: ce, values };
    const { error } = await db.from("contributions").update(parsed.data).eq("id", cid);
    if (error) return { error: friendly(error, "Couldn't save your changes."), values };
  }

  if (intent !== "save") {
    const { data: cur } = await db.from("contributions").select("state").eq("id", cid).single();
    const state = (cur as { state: string } | null)?.state;
    const to = intent === "share" ? "published" : "submitted";
    if (state !== to) {
      const { error } = await db.from("contributions").update({ state: to }).eq("id", cid);
      if (error) {
        revalidatePath(`/c/${slug}/observations`);
        return { error: `Saved as a draft, but ${friendly(error, "it couldn't be shared yet.").replace(/^./, (c) => c.toLowerCase())}`, values };
      }
    }
  }
  revalidatePath(`/c/${slug}`, "layout");
  redirect(`/c/${slug}/observations/${cid}`);
}

const transitionSchema = z.object({ id: z.string().uuid(), to: z.enum(["submitted", "published", "withdrawn"]) });

export async function transition(slug: string, form: FormData): Promise<void> {
  await requireOrg(slug);
  const parsed = transitionSchema.safeParse({ id: form.get("id"), to: form.get("to") });
  if (!parsed.success) return;
  const insforge = await createInsForgeServerClient();
  const { error } = await insforge.database.from("contributions").update({ state: parsed.data.to }).eq("id", parsed.data.id);
  revalidatePath(`/c/${slug}`, "layout");
  redirect(`/c/${slug}/observations/${parsed.data.id}${error ? `?error=${encodeURIComponent(friendly(error, "That change isn't allowed."))}` : ""}`);
}

export async function discardDraft(slug: string, form: FormData): Promise<void> {
  await requireOrg(slug);
  const id = z.string().uuid().safeParse(form.get("id"));
  if (!id.success) return;
  const insforge = await createInsForgeServerClient();
  await insforge.database.from("contributions").delete().eq("id", id.data).eq("state", "draft");
  revalidatePath(`/c/${slug}`, "layout");
  redirect(`/c/${slug}/observations`);
}

export async function markNotificationsRead(): Promise<void> {
  const s = await requireUser();
  const insforge = await createInsForgeServerClient();
  await insforge.database.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", s.user.id).is("read_at", null);
  revalidatePath("/", "layout");
}
