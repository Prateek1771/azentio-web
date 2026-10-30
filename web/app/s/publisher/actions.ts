"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireGrant } from "@/lib/authz";
import { createInsForgeServerClient } from "@/lib/insforge/server";
import { createInsForgeAdminClient } from "@/lib/insforge/admin";
import { toEmbed } from "@/lib/media/embed";

// Every write runs on the publisher's own session, so RLS (publish_media, audience ≠ org_private)
// and the embed-URL trigger are the enforcement; requireGrant just gives a clean 403 first.

export type ActionState = { ok?: string; error?: string };

const audience = z.enum(["public", "employee", "client_entitled"]);
const parentHost = () => new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3100").hostname;

async function offeringId(slug: string | undefined) {
  if (!slug) return null;
  const insforge = await createInsForgeServerClient();
  const { data } = await insforge.database.from("offerings").select("id").eq("slug", slug).maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}

const refresh = () => {
  for (const p of ["/s/publisher", "/e/live", "/live", "/media", "/"]) revalidatePath(p);
};

const sessionSchema = z.object({
  title: z.string().trim().min(2, "Give the session a title.").max(200),
  url: z.string().trim().min(1, "Paste a video or stream URL."),
  audience,
  offering: z.string().optional(),
  starts_at: z.string().optional(),
  is_live: z.literal("on").optional(),
});

export async function saveSession(_: ActionState, form: FormData): Promise<ActionState> {
  await requireGrant("publish_media");
  const p = sessionSchema.safeParse(Object.fromEntries(form));
  if (!p.success) return { error: p.error.issues[0].message };
  const embed = toEmbed(p.data.url, parentHost());
  if (!embed) return { error: "Use a YouTube, Vimeo or Twitch link, or a direct https .mp4/.webm file." };
  const offering_id = p.data.audience === "client_entitled" ? await offeringId(p.data.offering) : null;
  if (p.data.audience === "client_entitled" && !offering_id) return { error: "Choose which offering's clients can watch." };

  const db = (await createInsForgeServerClient()).database;
  if (p.data.is_live) await db.from("live_sessions").update({ is_live: false }).eq("is_live", true);
  const { error } = await db.from("live_sessions").insert([{
    title: p.data.title,
    embed_url: embed.url,
    audience: p.data.audience,
    offering_id,
    is_live: Boolean(p.data.is_live),
    starts_at: p.data.starts_at ? new Date(p.data.starts_at).toISOString() : null,
  }]);
  if (error) return { error: "Couldn't save the session." };
  refresh();
  return { ok: p.data.is_live ? "Saved and now showing on Live." : "Session saved." };
}

const idSchema = z.string().uuid();

export async function setLive(id: string, live: boolean) {
  await requireGrant("publish_media");
  if (!idSchema.safeParse(id).success) return;
  const db = (await createInsForgeServerClient()).database;
  if (live) await db.from("live_sessions").update({ is_live: false }).eq("is_live", true);
  await db.from("live_sessions").update({ is_live: live }).eq("id", id);
  refresh();
}

export async function deleteSession(id: string) {
  await requireGrant("publish_media");
  if (!idSchema.safeParse(id).success) return;
  await (await createInsForgeServerClient()).database.from("live_sessions").delete().eq("id", id);
  refresh();
}

const MAX_UPLOAD = 200 * 1024 * 1024;
const recordingSchema = z.object({
  title: z.string().trim().min(2, "Give the recording a title.").max(200),
  summary: z.string().trim().max(500).optional(),
  url: z.string().trim().optional(),
  audience,
  offering: z.string().optional(),
});

export async function addRecording(_: ActionState, form: FormData): Promise<ActionState> {
  await requireGrant("publish_media");
  const p = recordingSchema.safeParse(Object.fromEntries([...form].filter(([, v]) => typeof v === "string")));
  if (!p.success) return { error: p.error.issues[0].message };
  const file = form.get("file");
  const hasFile = file instanceof File && file.size > 0;
  const offering_id = p.data.audience === "client_entitled" ? await offeringId(p.data.offering) : null;
  if (p.data.audience === "client_entitled" && !offering_id) return { error: "Choose which offering's clients can watch." };

  let embed_url: string | null = null;
  let storage_key: string | null = null;
  if (hasFile) {
    if (!["video/mp4", "video/webm"].includes(file.type)) return { error: "Upload an .mp4 or .webm file." };
    if (file.size > MAX_UPLOAD) return { error: "Files must be 200 MB or smaller." };
    storage_key = `recordings/${randomUUID()}.${file.type === "video/webm" ? "webm" : "mp4"}`;
    // Private bucket; objects are only ever served via /api/media after an RLS audience check.
    const { error } = await createInsForgeAdminClient().storage.from("media").upload(storage_key, file);
    if (error) return { error: "Upload failed. Please try again." };
  } else {
    const embed = p.data.url ? toEmbed(p.data.url, parentHost()) : null;
    if (!embed) return { error: "Paste a YouTube/Vimeo/Twitch link or a direct https video URL, or upload a file." };
    embed_url = embed.url;
  }

  const { error } = await (await createInsForgeServerClient()).database.from("media").insert([{
    title: p.data.title, summary: p.data.summary || null, audience: p.data.audience, offering_id, embed_url, storage_key, published: false,
  }]);
  if (error) {
    if (storage_key) await createInsForgeAdminClient().storage.from("media").remove(storage_key);
    return { error: "Couldn't save the recording." };
  }
  refresh();
  return { ok: "Recording added as a draft. Publish it when ready." };
}

export async function setRecordingPublished(id: string, published: boolean) {
  await requireGrant("publish_media");
  if (!idSchema.safeParse(id).success) return;
  await (await createInsForgeServerClient()).database.from("media").update({ published }).eq("id", id);
  refresh();
}

const bannerSchema = z.object({
  title: z.string().trim().min(2, "Write the announcement.").max(200),
  body: z.string().trim().max(300).optional(),
  link: z.string().trim().regex(/^\/[^/\\]?[^\s]*$/, "Links must be site paths like /hackathon/register").optional().or(z.literal("")),
});

export async function createBanner(_: ActionState, form: FormData): Promise<ActionState> {
  await requireGrant("publish_media");
  const p = bannerSchema.safeParse(Object.fromEntries(form));
  if (!p.success) return { error: p.error.issues[0].message };
  const { error } = await (await createInsForgeServerClient()).database.from("content").insert([{
    kind: "banner", audience: "public", published: false, title: p.data.title, body: p.data.body ?? "", slug: p.data.link || null,
  }]);
  if (error) return { error: "Couldn't save the banner." };
  refresh();
  return { ok: "Banner saved as a draft." };
}

export async function setBannerPublished(id: string, published: boolean) {
  await requireGrant("publish_media");
  if (!idSchema.safeParse(id).success) return;
  const db = (await createInsForgeServerClient()).database;
  if (published) await db.from("content").update({ published: false }).eq("kind", "banner").eq("published", true);
  await db.from("content").update({ published }).eq("id", id).eq("kind", "banner");
  refresh();
}

// Client briefings, release notes and resources: entitled clients of one offering (employees see them too).
const clientContentSchema = z.object({
  kind: z.enum(["briefing", "release_note", "library"]),
  offering: z.string().min(1, "Choose the offering whose clients should see it."),
  title: z.string().trim().min(2, "Give it a title.").max(200),
  body: z.string().trim().min(10, "Write at least a few words.").max(10000),
});

export async function createClientContent(_: ActionState, form: FormData): Promise<ActionState> {
  await requireGrant("publish_media");
  const p = clientContentSchema.safeParse(Object.fromEntries(form));
  if (!p.success) return { error: p.error.issues[0].message };
  const offering_id = await offeringId(p.data.offering);
  if (!offering_id) return { error: "Choose the offering whose clients should see it." };
  const { error } = await (await createInsForgeServerClient()).database.from("content").insert([{
    kind: p.data.kind, audience: "client_entitled", offering_id, title: p.data.title, body: p.data.body, published: false,
  }]);
  if (error) return { error: "Couldn't save it." };
  revalidatePath("/s/publisher");
  return { ok: "Saved as a draft. Publish it when it's ready." };
}

export async function setClientContentPublished(id: string, published: boolean) {
  await requireGrant("publish_media");
  if (!idSchema.safeParse(id).success) return;
  await (await createInsForgeServerClient()).database.from("content").update({ published }).eq("id", id).in("kind", ["briefing", "release_note", "library"]);
  revalidatePath("/s/publisher");
  revalidatePath("/c", "layout");
}
