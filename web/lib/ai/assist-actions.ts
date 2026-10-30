"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireGrant } from "@/lib/authz";
import { createInsForgeServerClient } from "@/lib/insforge/server";
import { createInsForgeAdminClient } from "@/lib/insforge/admin";
import type { Rule } from "@/lib/aira/guards";
import { type Pair, type Redaction, type ThemeName, cluster, digest, nameCluster, suggestRedaction } from "./assists";

const uuid = z.string().uuid();
const unavailable = "The AI assistant is unavailable right now. Carry on manually.";
const rules = async () =>
  ((await createInsForgeAdminClient().database.from("guardrail_rules").select("key, kind, stage, pattern, severity").eq("enabled", true)).data ?? []) as Rule[];

// Moderators only; reads the source through their own RLS (proposals in review).
export async function redactionSuggestion(contributionId: string): Promise<{ error?: string; suggestion?: Redaction }> {
  await requireGrant("moderate");
  const { data } = await (await createInsForgeServerClient()).database.from("contributions").select("title, body").eq("id", uuid.parse(contributionId)).maybeSingle();
  if (!data) return { error: "Contribution not found." };
  try {
    const orgNames = (await rules()).filter((r) => r.kind === "org_name").map((r) => r.pattern);
    return { suggestion: await suggestRedaction((data as { title: string }).title, (data as { body: string }).body, orgNames) };
  } catch {
    return { error: unavailable };
  }
}

export type ThemeSuggestion = ThemeName & { ids: string[]; titles: string[] };

export async function suggestThemes(): Promise<{ error?: string; suggestions?: ThemeSuggestion[] }> {
  await requireGrant("product_owner", "moderate");
  const db = (await createInsForgeServerClient()).database;
  const [{ data: live }, { data: pairs }] = await Promise.all([
    db.from("shared_contributions").select("id, title, body").eq("status", "live").order("published_at", { ascending: false }).limit(200),
    db.rpc("shared_pairs", { p_threshold: 0.12 }),
  ]);
  const items = (live ?? []) as { id: string; title: string; body: string }[];
  const groups = cluster(items.map((i) => i.id), (pairs ?? []) as Pair[], 0.12).slice(0, 5); // ≤5 model calls per click
  if (!groups.length) return { suggestions: [] };
  try {
    const byId = new Map(items.map((i) => [i.id, i]));
    const suggestions = await Promise.all(groups.map(async (ids) => {
      const members = ids.map((id) => byId.get(id)!);
      return { ...(await nameCluster(members)), ids, titles: members.map((m) => m.title) };
    }));
    return { suggestions };
  } catch {
    return { error: unavailable };
  }
}

const createSchema = z.object({ name: z.string().trim().min(3).max(120), summary: z.string().trim().min(10).max(2000), limitations: z.string().trim().max(1000), ids: z.array(uuid).min(2).max(50) });

// A person confirms: the theme is created as a draft (staff-only) with its evidence linked.
export async function createSuggestedTheme(form: FormData) {
  await requireGrant("product_owner", "moderate");
  const p = createSchema.safeParse({ name: form.get("name"), summary: form.get("summary"), limitations: form.get("limitations"), ids: form.getAll("ids") });
  if (!p.success) return;
  const db = (await createInsForgeServerClient()).database;
  const { data, error } = await db.from("themes").insert([{ name: p.data.name, summary: p.data.summary, limitations: p.data.limitations || null, status: "draft", confidence: "low" }]).select("id").single();
  if (error || !data) redirect(`/s/insights/suggest?error=${encodeURIComponent(/unique|duplicate/i.test(error?.message ?? "") ? "A theme with that name already exists." : "Couldn't create the theme.")}`);
  const id = (data as { id: string }).id;
  await db.from("theme_links").insert(p.data.ids.map((shared_id) => ({ theme_id: id, shared_id })));
  revalidatePath("/s/insights", "layout");
  redirect(`/s/insights/themes/${id}`);
}

export async function trendDigest(): Promise<{ error?: string; text?: string; blocked?: string; sources?: { n: number; id: string; title: string }[] }> {
  await requireGrant("product_owner", "moderate");
  const since = new Date(Date.now() - 30 * 864e5).toISOString();
  const { data } = await (await createInsForgeServerClient()).database.from("shared_contributions").select("id, title, body")
    .eq("status", "live").gte("published_at", since).order("published_at", { ascending: false }).limit(15);
  const items = (data ?? []) as { id: string; title: string; body: string }[];
  if (items.length < 2) return { error: "Fewer than two contributions were approved in the last 30 days: not enough for a digest." };
  try {
    const r = await digest(items, await rules());
    return { text: r.text, blocked: r.blocked, sources: r.sources.map(({ n, id, title }) => ({ n, id, title })) };
  } catch {
    return { error: unavailable };
  }
}
