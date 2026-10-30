"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Loader2, Send } from "lucide-react";
import { products } from "@/lib/content";
import { type FormState, submitConnect } from "@/lib/forms/actions";
import { BotTraps, Field, FormAlert, errProps, fieldCls, useTimedAction } from "@/components/site/form-bits";

const INTERESTS = [
  ["demo", "Requesting a product demo"],
  ["collaboration", "Exploring a collaboration"],
  ["challenge", "Submitting an AI challenge"],
  ["general", "General enquiry"],
] as const;

export function ConnectForm() {
  const [state, action, pending] = useActionState(submitConnect, {} as FormState);
  const params = useSearchParams();
  const interest = INTERESTS.some(([v]) => v === params.get("interest")) ? params.get("interest")! : "demo";
  const product = products.find((p) => p.slug === params.get("product"));
  const fe = state.fieldErrors ?? {};
  const v = state.values ?? {};
  const timedAction = useTimedAction(action);

  if (state.ok) {
    return (
      <div role="status" className="grid gap-3 rounded-xl bg-green-050 p-8">
        <CheckCircle2 className="size-8 text-green-700" aria-hidden />
        <h3 className="text-2xl font-bold">Thanks, we&rsquo;ve received your enquiry.</h3>
        <p className="text-slate">
          It&rsquo;s stored securely and our team will reply to your work email. We don&rsquo;t send automatic confirmation emails.
        </p>
      </div>
    );
  }

  return (
    <form action={timedAction} noValidate className="relative grid gap-5 rounded-xl bg-light p-8 max-sm:p-5">
      <BotTraps />
      <Field label="I'm interested in" name="interest" error={fe.interest}>
        <select id="interest" name="interest" defaultValue={v.interest || interest} className={fieldCls} {...errProps("interest", fe.interest)}>
          {INTERESTS.map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-5 max-sm:grid-cols-1">
        <Field label="Name" name="name" error={fe.name}>
          <input id="name" name="name" defaultValue={v.name} autoComplete="name" required maxLength={120} className={fieldCls} {...errProps("name", fe.name)} />
        </Field>
        <Field label="Work email" name="email" error={fe.email}>
          <input id="email" name="email" defaultValue={v.email} type="email" autoComplete="email" required maxLength={254} className={fieldCls} {...errProps("email", fe.email)} />
        </Field>
      </div>
      <Field label="Organization" name="organisation" error={fe.organisation}>
        <input id="organisation" name="organisation" defaultValue={v.organisation} autoComplete="organization" maxLength={160} className={fieldCls} {...errProps("organisation", fe.organisation)} />
      </Field>
      <Field label="Tell us more" name="message" error={fe.message} hint="Please don't include customer data, account numbers or confidential terms.">
        <textarea
          id="message"
          name="message"
          rows={5}
          maxLength={4000}
          defaultValue={v.message ?? (product ? `I'd like a demo of ${product.name}.` : undefined)}
          className={fieldCls}
          {...errProps("message", fe.message)}
        />
      </Field>
      <FormAlert error={state.error} />
      <button disabled={pending} className="inline-flex items-center justify-center gap-2 justify-self-start rounded-[5px] bg-green px-6 py-3.5 text-sm font-bold text-on-green transition hover:-translate-y-0.5 disabled:opacity-60">
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Send className="size-4" aria-hidden />}
        Submit Enquiry
      </button>
      <p className="text-xs text-slate">We use your details only to respond to this enquiry. See our <a href="/about#privacy" className="underline">privacy notes</a>.</p>
    </form>
  );
}
