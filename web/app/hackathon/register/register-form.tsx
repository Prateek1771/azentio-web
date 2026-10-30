"use client";

import { useActionState } from "react";
import { ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import { type FormState, submitHackathon } from "@/lib/forms/actions";
import { BotTraps, Field, FormAlert, errProps, fieldCls, useTimedAction } from "@/components/site/form-bits";

export function RegisterForm() {
  const [state, action, pending] = useActionState(submitHackathon, {} as FormState);
  const fe = state.fieldErrors ?? {};
  const v = state.values ?? {};
  const timedAction = useTimedAction(action);

  if (state.ok) {
    return (
      <div role="status" className="grid gap-3 rounded-xl bg-green-050 p-8 text-ink">
        <CheckCircle2 className="size-8 text-green-700" aria-hidden />
        <h2 className="text-2xl font-bold">{state.duplicate ? "You're already registered." : "You're on the list."}</h2>
        <p className="text-slate">
          Your details are stored privately for this event. No dates or places are confirmed yet. We&rsquo;ll share
          participation details when they&rsquo;re announced.
        </p>
      </div>
    );
  }

  return (
    <form action={timedAction} noValidate className="relative grid gap-5 rounded-xl bg-white p-8 text-ink shadow-panel max-sm:p-5">
      <BotTraps />
      <Field label="Your name" name="name" error={fe.name}>
        <input id="name" name="name" defaultValue={v.name} autoComplete="name" required maxLength={120} className={fieldCls} {...errProps("name", fe.name)} />
      </Field>
      <Field label="Email address" name="email" error={fe.email}>
        <input id="email" name="email" defaultValue={v.email} type="email" autoComplete="email" required maxLength={254} className={fieldCls} {...errProps("email", fe.email)} />
      </Field>
      <div className="grid gap-2">
        <label className="flex items-start gap-3 text-sm leading-[1.5]">
          <input type="checkbox" name="consent" defaultChecked={v.consent === "on"} className="mt-1 size-4 accent-[#247447]" {...errProps("consent", fe.consent)} />
          I agree that my name and email may be stored and shared with the event organizer for hackathon participation updates.
        </label>
        {fe.consent && <p id="consent-error" className="text-xs font-bold text-orange-700">{fe.consent}</p>}
      </div>
      <FormAlert error={state.error} />
      <button disabled={pending} className="inline-flex items-center justify-center gap-2 rounded-[5px] bg-green px-6 py-3.5 text-sm font-bold text-on-green transition hover:-translate-y-0.5 disabled:opacity-60">
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
        Register interest
        {!pending && <ArrowRight className="size-4" aria-hidden />}
      </button>
      <p className="text-xs leading-[1.6] text-slate">
        Your details are stored privately for this event. No dates or places are confirmed yet. No confirmation email is sent to you.
      </p>
    </form>
  );
}
