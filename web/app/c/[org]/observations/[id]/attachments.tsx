"use client";

import { useActionState } from "react";
import { Loader2, Paperclip } from "lucide-react";
import { type UploadState, removeAttachment, uploadAttachment } from "@/lib/contributions/attachments";

type A = { id: string; name: string; size: number };
const kb = (n: number) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

export function Attachments({ slug, contributionId, items, editable }: { slug: string; contributionId: string; items: A[]; editable: boolean }) {
  const [state, action, pending] = useActionState(uploadAttachment.bind(null, slug, contributionId), {} as UploadState);
  return (
    <div className="grid gap-4">
      {items.length ? (
        <ul className="grid grid-cols-1 gap-2">
          {items.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-3 rounded-lg bg-light px-4 py-2.5 text-sm">
              <a href={`/api/attachments/${a.id}`} className="inline-flex min-w-0 items-center gap-2 font-bold text-green-700 hover:underline">
                <Paperclip className="size-4 shrink-0" aria-hidden /> <span className="truncate">{a.name}</span>
              </a>
              <span className="flex shrink-0 items-center gap-3 text-xs text-slate">
                {kb(a.size)}
                {editable && (
                  <form action={removeAttachment.bind(null, slug)}>
                    <input type="hidden" name="id" value={a.id} />
                    <button className="font-bold text-orange-800 hover:underline">Remove</button>
                  </form>
                )}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-slate">No attachments.</p>
      )}
      {editable && items.length < 5 && (
        <form action={action} className="grid gap-2">
          <label className="grid gap-1.5 text-[13px] font-bold">
            Attach a file
            <input type="file" name="file" required accept=".pdf,.png,.jpg,.jpeg,.csv,.xlsx,.docx" className="text-sm" />
          </label>
          <p className="text-xs text-slate">PDF, PNG, JPEG, CSV, XLSX or DOCX, up to 10 MB, 5 per observation. Attachments stay with your organisation and moderators; they are never part of the shared copy.</p>
          {state.error && <p role="alert" className="text-sm font-bold text-orange-700">{state.error}</p>}
          <button disabled={pending} className="inline-flex items-center gap-2 justify-self-start rounded-[5px] bg-navy px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60">
            {pending && <Loader2 className="size-4 animate-spin" aria-hidden />} Upload
          </button>
        </form>
      )}
    </div>
  );
}
