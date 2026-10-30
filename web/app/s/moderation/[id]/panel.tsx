"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { Field, FormAlert, fieldCls } from "@/components/site/form-bits";
import { type ActionState, moderate, publishShared } from "@/lib/learning/actions";
import { scanPii, piiLabel } from "@/lib/contributions/pii";

const btn = "inline-flex items-center justify-center gap-2 rounded-[5px] px-4 py-2.5 text-sm font-bold disabled:opacity-60";
const DONE: Record<string, string> = {
  returned: "Returned to the contributor with your reason.",
  rejected: "Rejected. The contributor has been told why.",
  unpublished: "Hidden from the community until restored or withdrawn.",
  published: "Restored to the community.",
  withdrawn: "Withdrawn and purged from the feed, themes and ideas.",
};

type Draft = { title: string; body: string; industry: string; region: string };

export function SharedCopyForm({ id, draft, attribution }: { id: string; draft: Draft; attribution: string | null }) {
  const [state, action, pending] = useActionState(publishShared.bind(null, id), {} as ActionState);
  const v = (k: keyof Draft) => state.values?.[k] ?? draft[k];
  const flags = scanPii(`${v("title")} ${v("body")}`);
  return (
    <form action={action} className="grid gap-4">
      <FormAlert error={state.error} />
      <Field label="Shared title" name="title">
        <input id="title" name="title" defaultValue={v("title")} maxLength={140} className={fieldCls} />
      </Field>
      <Field label="Shared text" name="body" hint="Remove names, identifiers and anything that points to a specific client.">
        <textarea id="body" name="body" defaultValue={v("body")} rows={8} maxLength={5000} className={fieldCls} />
      </Field>
      <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
        <Field label="Industry" name="industry">
          <input id="industry" name="industry" defaultValue={v("industry")} maxLength={80} className={fieldCls} />
        </Field>
        <Field label="Region" name="region">
          <input id="region" name="region" defaultValue={v("region")} maxLength={80} className={fieldCls} />
        </Field>
      </div>
      {flags.length > 0 && (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          The draft still contains {flags.map((f) => piiLabel[f]).join(", ")}. Redact before publishing.
        </p>
      )}
      <p className="text-xs text-slate">
        {attribution ? `Will be attributed to ${attribution} (the contributor consented).` : "Published without attribution: no organisation or author is attached."}
      </p>
      <button disabled={pending} className={`${btn} bg-green text-on-green`}>
        {pending && <Loader2 className="size-4 animate-spin" aria-hidden />} Publish shared copy
      </button>
    </form>
  );
}

export function ModerationActions({ id, state: st }: { id: string; state: string }) {
  const [state, action, pending] = useActionState(moderate, {} as ActionState);
  const step = (to: string, label: string, danger = false) => (
    <button name="to" value={to} disabled={pending} className={`${btn} ${danger ? "border border-orange-300 text-orange-800 hover:bg-orange-50" : "border border-line-strong bg-white hover:border-green-700"}`}>
      {label}
    </button>
  );
  if (state.ok) return <p role="status" className="rounded-md border border-green/40 bg-green-050 px-4 py-3 text-sm">{DONE[state.ok]}</p>;
  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="id" value={id} />
      <FormAlert error={state.error} />
      {st === "submitted" && (
        <>
          <Field label="Reason for the contributor" name="reason" hint="Required to request changes or reject. The contributor sees it.">
            <textarea id="reason" name="reason" rows={3} maxLength={1000} className={fieldCls} />
          </Field>
          <div className="flex flex-wrap gap-2">
            {step("returned", "Request clarification")}
            {step("rejected", "Reject", true)}
          </div>
        </>
      )}
      <div className="flex flex-wrap gap-2">
        {st === "published" && step("unpublished", "Unpublish temporarily")}
        {st === "unpublished" && step("published", "Restore")}
        {["submitted", "returned", "published", "unpublished"].includes(st) && step("withdrawn", "Withdraw & purge", true)}
      </div>
    </form>
  );
}
