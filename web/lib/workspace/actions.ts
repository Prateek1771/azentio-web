"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireEmployee } from "@/lib/authz";
import { createInsForgeServerClient } from "@/lib/insforge/server";

export type FormState = { error?: string; values?: Record<string, string> };

const uuid = z.string().uuid();
const opt = (max: number) => z.string().trim().max(max).transform((v) => v || null);
const values = (form: FormData) => Object.fromEntries([...form.entries()].filter(([, v]) => typeof v === "string") as [string, string][]);
const db = async () => (await createInsForgeServerClient()).database;

// ── teams (RLS: any employee creates; the lead manages the roster) ────────
const teamSchema = z.object({
  name: z.string().trim().min(3, "Team names need at least 3 characters.").max(80),
  kind: z.enum(["hackathon", "squad"]),
  description: opt(1000),
});

export async function createTeam(_: FormState, form: FormData): Promise<FormState> {
  await requireEmployee();
  const p = teamSchema.safeParse(values(form));
  if (!p.success) return { error: p.error.issues[0].message, values: values(form) };
  const { data, error } = await (await db()).from("teams").insert([p.data]).select("id").single();
  if (error) return { error: /unique|duplicate/i.test(error.message ?? "") ? "A team with that name already exists." : "Couldn't create the team.", values: values(form) };
  revalidatePath("/e/teams");
  redirect(`/e/teams/${(data as { id: string }).id}`);
}

export async function addTeamMember(teamId: string, _: FormState, form: FormData): Promise<FormState> {
  await requireEmployee();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const d = await db();
  const { data: dir } = await d.rpc("employee_directory");
  const person = ((dir ?? []) as { user_id: string; email: string }[]).find((e) => e.email.toLowerCase() === email);
  if (!person) return { error: "No Azentio employee with that email." };
  const { error } = await d.from("team_members").insert([{ team_id: uuid.parse(teamId), user_id: person.user_id, role: "member" }]);
  if (error) return { error: /duplicate|unique/i.test(error.message ?? "") ? "They're already on the team." : "Only the team lead can add people." };
  revalidatePath(`/e/teams/${teamId}`);
  return {};
}

export async function rosterAction(teamId: string, form: FormData) {
  await requireEmployee();
  const user = uuid.safeParse(form.get("user"));
  const op = z.enum(["lead", "member", "remove"]).safeParse(form.get("op"));
  if (!user.success || !op.success) return;
  const d = await db();
  const q = op.data === "remove"
    ? d.from("team_members").delete().eq("team_id", teamId).eq("user_id", user.data).select("user_id")
    : d.from("team_members").update({ role: op.data }).eq("team_id", teamId).eq("user_id", user.data).select("user_id");
  const { data, error } = await q;
  revalidatePath(`/e/teams/${teamId}`);
  if (error || !data?.length)
    redirect(`/e/teams/${teamId}?error=${encodeURIComponent(/at least one lead/i.test(error?.message ?? "") ? "A team needs at least one lead." : "Only the team lead can change the roster.")}`);
}

// ── experiments ──────────────────────────────────────────────────────────
const experimentSchema = z.object({
  title: z.string().trim().min(5, "Title needs at least 5 characters.").max(140),
  hypothesis: z.string().trim().min(10, "State the hypothesis in at least 10 characters.").max(2000),
  method: opt(4000),
  result: opt(4000),
  status: z.enum(["draft", "running", "completed", "stopped"]),
  offering_id: z.union([z.literal(""), uuid]).transform((v) => v || null),
  team_id: z.union([z.literal(""), uuid]).transform((v) => v || null),
});

export async function saveExperiment(id: string | null, _: FormState, form: FormData): Promise<FormState> {
  await requireEmployee();
  const p = experimentSchema.safeParse(values(form));
  if (!p.success) return { error: p.error.issues[0].message, values: values(form) };
  const d = await db();
  const { data, error } = id
    ? await d.from("experiments").update(p.data).eq("id", uuid.parse(id)).select("id").single()
    : await d.from("experiments").insert([p.data]).select("id").single();
  if (error || !data) return { error: "Couldn't save. You can only file experiments for teams you belong to, and only the owner or team can edit.", values: values(form) };
  revalidatePath("/e/experiments");
  redirect(`/e/experiments/${(data as { id: string }).id}`);
}

// ── knowledge library (owner + review date; employees only) ───────────────
const librarySchema = z.object({
  title: z.string().trim().min(3, "Give the entry a title.").max(200),
  body: z.string().trim().min(10, "Write at least a few words.").max(20000),
  review_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Set a review date so the entry doesn't go stale."),
  published: z.literal("on").optional(),
});

export async function saveLibraryItem(id: string | null, _: FormState, form: FormData): Promise<FormState> {
  const s = await requireEmployee();
  const p = librarySchema.safeParse(values(form));
  if (!p.success) return { error: p.error.issues[0].message, values: values(form) };
  const row = { kind: "library", audience: "employee", owner_id: s.user.id, title: p.data.title, body: p.data.body, review_date: p.data.review_date, published: Boolean(p.data.published) };
  const d = await db();
  const { data, error } = id
    ? await d.from("content").update(row).eq("id", uuid.parse(id)).eq("kind", "library").select("id").single()
    : await d.from("content").insert([row]).select("id").single();
  if (error || !data) return { error: "Couldn't save. Only the entry's owner can edit it.", values: values(form) };
  revalidatePath("/e/library");
  redirect(`/e/library/${(data as { id: string }).id}`);
}
