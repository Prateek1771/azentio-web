"use client";

import { useActionState } from "react";
import { Flag } from "lucide-react";
import { type ActionState, reportShared } from "@/lib/learning/actions";
import { fieldCls } from "@/components/site/form-bits";

export function ReportButton({ id }: { id: string }) {
  const [state, action, pending] = useActionState(reportShared.bind(null, id), {} as ActionState);
  if (state.ok) return <p role="status" className="text-xs text-green-700">{state.ok}</p>;
  return (
    <details className="text-sm">
      <summary className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-bold text-slate hover:text-orange-700">
        <Flag className="size-3.5" aria-hidden /> Report
      </summary>
      <form action={action} className="mt-3 grid gap-2">
        <label className="grid gap-1.5 text-xs font-bold">
          What&rsquo;s the problem?
          <textarea name="reason" rows={2} maxLength={1000} required className={fieldCls} />
        </label>
        {state.error && <p role="alert" className="text-xs font-bold text-orange-700">{state.error}</p>}
        <button disabled={pending} className="justify-self-start rounded-[5px] border border-orange-300 px-3 py-1.5 text-xs font-bold text-orange-800 hover:bg-orange-50">
          Send report
        </button>
      </form>
    </details>
  );
}
