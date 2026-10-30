"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOrg } from "@/lib/authz";
import { createInsForgeServerClient } from "@/lib/insforge/server";
import { createInsForgeAdminClient } from "@/lib/insforge/admin";

export type UploadState = { error?: string; ok?: boolean };

const TYPES: Record<string, string> = {
  "application/pdf": "pdf",
  "image/png": "png",
  "image/jpeg": "jpg",
  "text/csv": "csv",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
};
const MAX = 10 * 1024 * 1024;

// Authorise through RLS (author, draft/returned, ≤5) by inserting the row first; upload with the admin
// key only after the row exists, and roll the row back if the upload fails.
export async function uploadAttachment(slug: string, contributionId: string, _: UploadState, form: FormData): Promise<UploadState> {
  await requireOrg(slug);
  const id = z.string().uuid().parse(contributionId);
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a file to attach." };
  const ext = TYPES[file.type];
  if (!ext) return { error: "Attach a PDF, PNG, JPEG, CSV, XLSX or DOCX file." };
  if (file.size > MAX) return { error: "Files can be up to 10 MB." };

  const db = (await createInsForgeServerClient()).database;
  const storage_key = `${id}/${randomUUID()}.${ext}`;
  const name = file.name.replace(/[^\w.\- ()]/g, "_").slice(0, 200) || `attachment.${ext}`;
  const { data, error } = await db.from("contribution_attachments").insert([{ contribution_id: id, storage_key, name, mime: file.type, size: file.size }]).select("id").single();
  if (error) return { error: /at most 5/i.test(error.message ?? "") ? "A contribution can have at most 5 attachments." : "You can only attach files to your own drafts or items returned for changes." };

  const up = await createInsForgeAdminClient().storage.from("attachments").upload(storage_key, file);
  if (up.error) {
    await db.from("contribution_attachments").delete().eq("id", (data as { id: string }).id);
    return { error: "The upload failed. Please try again." };
  }
  revalidatePath(`/c/${slug}/observations/${id}`);
  return { ok: true };
}

export async function removeAttachment(slug: string, form: FormData) {
  await requireOrg(slug);
  const id = z.string().uuid().safeParse(form.get("id"));
  if (!id.success) return;
  const db = (await createInsForgeServerClient()).database;
  const { data } = await db.from("contribution_attachments").delete().eq("id", id.data).select("storage_key, contribution_id");
  const row = (data as { storage_key: string; contribution_id: string }[] | null)?.[0];
  if (!row) return; // RLS: not yours, or no longer editable
  await createInsForgeAdminClient().storage.from("attachments").remove(row.storage_key);
  revalidatePath(`/c/${slug}/observations/${row.contribution_id}`);
}
