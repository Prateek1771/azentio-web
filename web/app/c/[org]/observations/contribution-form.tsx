"use client";

import { useActionState, useState } from "react";
import { Loader2, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { Field, FormAlert, errProps, fieldCls } from "@/components/site/form-bits";
import { type FormState, saveContribution } from "@/lib/contributions/actions";
import { CONFIDENCE, CONSENTS, type Consents, type Contribution, EVIDENCE, TYPES, VISIBILITY, type Visibility } from "@/lib/contributions/model";
import { piiLabel, scanPii } from "@/lib/contributions/pii";

type Props = {
  slug: string;
  offerings: { id: string; name: string }[];
  initial?: Contribution;
  consents?: Consents;
};

const btn = "inline-flex items-center justify-center gap-2 rounded-[5px] px-5 py-3 text-sm font-bold disabled:opacity-60";

export function ContributionForm({ slug, offerings, initial, consents }: Props) {
  const [state, action, pending] = useActionState(saveContribution.bind(null, slug, initial?.id ?? null), {} as FormState);
  const v = (k: keyof Contribution) => state.values?.[k] ?? String(initial?.[k] ?? "");
  const [visibility, setVisibility] = useState<Visibility>((initial?.visibility_choice ?? "private") as Visibility);
  const [flags, setFlags] = useState<string[]>(() => scanPii(`${v("title")} ${v("body")}`));
  const fe = state.fieldErrors ?? {};
  const st = initial?.state ?? "draft";
  const locked = st !== "draft"; // the audience never widens silently
  const consentLocked = !["draft", "returned"].includes(st);
  const rescan = (e: React.FormEvent<HTMLFormElement>) => {
    const f = new FormData(e.currentTarget);
    setFlags(scanPii(`${f.get("title") ?? ""} ${f.get("body") ?? ""}`));
  };

  return (
    <form action={action} onInput={rescan} className="grid gap-6" noValidate>
      <FormAlert error={state.error} />

      <div className="rounded-[10px] border border-line bg-light p-5 text-sm leading-[1.65] text-slate">
        <p className="font-bold text-ink">Before you write</p>
        Describe patterns, not people. Leave out customer names, account or card numbers, ID numbers, contact details and anything
        your organisation treats as confidential. Saving keeps this a private draft; nothing is shared until you choose to.
      </div>

      <div className="grid grid-cols-3 gap-5 max-md:grid-cols-1">
        <Field label="Type" name="type" error={fe.type}>
          <select id="type" name="type" defaultValue={v("type") || "observation"} className={fieldCls}>
            {Object.entries(TYPES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </Field>
        <Field label="Offering (optional)" name="offering_id" error={fe.offering_id}>
          <select id="offering_id" name="offering_id" defaultValue={v("offering_id")} className={fieldCls}>
            <option value="">Not specific to an offering</option>
            {offerings.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </Field>
        <Field label="Evidence" name="evidence_type" error={fe.evidence_type}>
          <select id="evidence_type" name="evidence_type" defaultValue={v("evidence_type") || "anecdotal"} className={fieldCls}>
            {Object.entries(EVIDENCE).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </Field>
      </div>

      <Field label="Title" name="title" error={fe.title}>
        <input id="title" name="title" defaultValue={v("title")} maxLength={140} required className={fieldCls} {...errProps("title", fe.title)} />
      </Field>
      <Field label="What did you observe?" name="body" error={fe.body} hint="20–5,000 characters. Include what changed, where and roughly how much.">
        <textarea id="body" name="body" defaultValue={v("body")} rows={7} maxLength={5000} required className={fieldCls} {...errProps("body", fe.body)} />
      </Field>

      {flags.length > 0 && (
        <p role="status" className="flex gap-3 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            This looks like it contains {flags.map((f) => piiLabel[f]).join(", ")}. Remove it unless it is essential: moderators will
            see this warning.
          </span>
        </p>
      )}

      <div className="grid grid-cols-5 gap-5 max-[959px]:grid-cols-2 max-sm:grid-cols-1">
        <Field label="Industry" name="industry" error={fe.industry}>
          <input id="industry" name="industry" defaultValue={v("industry")} maxLength={80} className={fieldCls} />
        </Field>
        <Field label="Region" name="region" error={fe.region}>
          <input id="region" name="region" defaultValue={v("region")} maxLength={80} className={fieldCls} />
        </Field>
        <Field label="Period from" name="period_start" error={fe.period_start}>
          <input id="period_start" name="period_start" type="date" defaultValue={v("period_start")} className={fieldCls} />
        </Field>
        <Field label="Period to" name="period_end" error={fe.period_end}>
          <input id="period_end" name="period_end" type="date" defaultValue={v("period_end")} className={fieldCls} {...errProps("period_end", fe.period_end)} />
        </Field>
        <Field label="Confidence" name="confidence" error={fe.confidence}>
          <select id="confidence" name="confidence" defaultValue={v("confidence") || "med"} className={fieldCls}>
            {Object.entries(CONFIDENCE).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </Field>
      </div>

      <fieldset className="grid gap-3">
        <legend className="mb-3 text-[13px] font-bold text-ink">Who should eventually see it?</legend>
        {locked && <input type="hidden" name="visibility_choice" value={visibility} />}
        <div className="grid grid-cols-3 gap-3 max-md:grid-cols-1">
          {(Object.keys(VISIBILITY) as Visibility[]).map((k) => (
            <label
              key={k}
              className={cn(
                "grid cursor-pointer gap-1 rounded-[10px] border p-4 text-sm",
                visibility === k ? "border-green-700 bg-green-050" : "border-line bg-white",
                locked && "cursor-not-allowed opacity-70",
              )}
            >
              <span className="flex items-center gap-2 font-bold">
                <input type="radio" name={locked ? undefined : "visibility_choice"} value={k} checked={visibility === k} disabled={locked} onChange={() => setVisibility(k)} className="accent-green-700" />
                {VISIBILITY[k].label}
              </span>
              <span className="text-xs leading-[1.6] text-slate">{VISIBILITY[k].hint}</span>
            </label>
          ))}
        </div>
        {locked && <p className="text-xs text-slate">The audience is fixed once an item has been shared. Withdraw it to change who can see it.</p>}
      </fieldset>

      <fieldset className="grid gap-2.5" disabled={consentLocked}>
        <legend className="mb-2 text-[13px] font-bold text-ink">Your consents (each is separate; history is kept)</legend>
        {(Object.keys(CONSENTS) as (keyof Consents)[]).map((k) => (
          <label key={k} className="flex items-start gap-3 text-sm">
            <input type="checkbox" name={k} defaultChecked={state.values ? state.values[k] === "on" : consents?.[k]} className="mt-1 accent-green-700" />
            <span>{CONSENTS[k]}</span>
          </label>
        ))}
        {consentLocked && <p className="text-xs text-slate">Consents are locked while an item is in review or shared. Withdraw it to revoke them.</p>}
      </fieldset>
      {/* disabled fieldsets don't submit, so locked consents ride along as hidden fields */}
      {consentLocked && (Object.keys(CONSENTS) as (keyof Consents)[]).map((k) => consents?.[k] && <input key={k} type="hidden" name={k} value="on" />)}

      <div className="flex flex-wrap gap-3 border-t border-line pt-6">
        <button name="intent" value="save" disabled={pending} className={cn(btn, "border border-line-strong bg-white hover:border-green-700")}>
          {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
          {st === "draft" ? "Save draft" : "Save changes"}
        </button>
        {visibility === "org" && st === "draft" && (
          <button name="intent" value="share" disabled={pending} className={cn(btn, "bg-green text-on-green")}>
            Save &amp; share with my organisation
          </button>
        )}
        {visibility === "propose_shared" && ["draft", "returned"].includes(st) && (
          <button name="intent" value="submit" disabled={pending} className={cn(btn, "bg-green text-on-green")}>
            {st === "draft" ? "Save & submit for review" : "Save & resubmit for review"}
          </button>
        )}
      </div>
      {st !== "draft" && visibility === "propose_shared" && (
        <p className="-mt-3 text-xs text-slate">Changing the content of a reviewed or published item creates a new version and sends it back to review.</p>
      )}
    </form>
  );
}
