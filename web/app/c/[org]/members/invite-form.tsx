"use client";

import { useActionState, useState } from "react";
import { Check, Copy, Loader2, UserPlus } from "lucide-react";
import { type InviteState, createInvite } from "./actions";

const field =
  "w-full rounded-md border border-input bg-white px-3.5 py-3 text-[15px] text-ink outline-none focus:border-green-700 focus:ring-3 focus:ring-green/30";

export function InviteForm({ slug }: { slug: string }) {
  const [state, action, pending] = useActionState(createInvite.bind(null, slug), {} as InviteState);
  const [copied, setCopied] = useState(false);

  return (
    <div className="grid gap-4">
      <form action={action} className="grid grid-cols-[1fr_180px_auto] items-end gap-3 max-md:grid-cols-1">
        <label className="grid gap-2">
          <span className="text-[13px] font-bold">Email</span>
          <input className={field} name="email" type="email" required placeholder="name@company.com" />
        </label>
        <label className="grid gap-2">
          <span className="text-[13px] font-bold">Role</span>
          <select className={field} name="role" defaultValue="client_member">
            <option value="client_member">Member</option>
            <option value="client_admin">Administrator</option>
          </select>
        </label>
        <button
          disabled={pending}
          className="inline-flex items-center justify-center gap-2 rounded-[5px] bg-green px-5 py-3.5 text-sm font-bold text-on-green disabled:opacity-60"
        >
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <UserPlus className="size-4" aria-hidden />}
          Create invite
        </button>
      </form>

      {state.error && (
        <p role="alert" className="rounded-md border border-orange-200 bg-orange-50 px-3 py-2 text-sm text-orange-800">
          {state.error}
        </p>
      )}
      {state.link && (
        <div role="status" className="grid gap-2 rounded-md border border-green/40 bg-green-050 p-4">
          <p className="text-sm text-ink">
            Invitation for <strong>{state.email}</strong>. It&rsquo;s single-use, expires in 7 days and only works for that
            email. Copy it now; it won&rsquo;t be shown again.
          </p>
          <div className="flex gap-2">
            <input readOnly value={state.link} aria-label="Invitation link" className={`${field} font-mono text-xs`} />
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(state.link!).then(() => setCopied(true))}
              className="inline-flex items-center gap-2 rounded-[5px] border border-line-strong bg-white px-4 text-sm font-bold"
            >
              {copied ? <Check className="size-4 text-green-700" aria-hidden /> : <Copy className="size-4" aria-hidden />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <p className="text-xs text-slate">
            {state.emailed ? "We've also emailed the invitation. Delivery depends on their mail provider." : "Email couldn't be queued; share the link directly."}
          </p>
        </div>
      )}
    </div>
  );
}
