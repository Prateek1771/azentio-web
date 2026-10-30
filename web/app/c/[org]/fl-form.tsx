"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { type FlState, setEnrolment } from "./fl-actions";

export function FlForm({ slug, programId, enrolled }: { slug: string; programId: string; enrolled: boolean }) {
  const [state, action, pending] = useActionState<FlState, FormData>(setEnrolment.bind(null, slug, programId, !enrolled), {});
  return (
    <form action={action} className="mt-5 grid gap-3">
      {!enrolled && (
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" name="consent" required className="mt-1 size-4 accent-green-700" />
          <span>
            I consent, on behalf of my organisation, to model training in this programme. This is separate from any consent to
            publish or attribute observations.
          </span>
        </label>
      )}
      {state.error && <p role="alert" className="rounded-md border border-orange-200 bg-orange-50 px-3 py-2 text-sm text-orange-800">{state.error}</p>}
      {state.ok && <p role="status" className="rounded-md bg-green-050 px-3 py-2 text-sm font-bold text-green-700">{state.ok}</p>}
      <button
        disabled={pending}
        className={`inline-flex items-center gap-2 justify-self-start rounded-[5px] px-5 py-3 text-sm font-bold disabled:opacity-60 ${enrolled ? "border border-line hover:border-orange-800" : "bg-green text-on-green"}`}
      >
        {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
        {enrolled ? "Withdraw from programme" : "Join programme"}
      </button>
    </form>
  );
}
