"use client";

import { useActionState } from "react";
import { type CommentState, addComment } from "@/lib/learning/collab";
import { fieldCls } from "@/components/site/form-bits";

export function CommentForm({ type, parentId, back }: { type: "shared" | "content"; parentId: string; back: string }) {
  const [state, action, pending] = useActionState(addComment.bind(null, type, parentId, back), {} as CommentState);
  return (
    <form action={action} className="grid gap-2">
      <label className="grid gap-1.5 text-[13px] font-bold">
        Add a comment
        <textarea name="body" rows={3} maxLength={2000} required className={fieldCls} />
      </label>
      <p className="text-xs text-slate">Visible to everyone who can see this item. No names, contact details or client-identifying information.</p>
      {state.error && <p role="alert" className="text-sm font-bold text-orange-700">{state.error}</p>}
      <button disabled={pending} className="justify-self-start rounded-[5px] bg-navy px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60">Post comment</button>
    </form>
  );
}
