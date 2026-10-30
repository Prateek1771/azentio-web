"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { Field, FormAlert, fieldCls } from "@/components/site/form-bits";
import { type ActionState, saveIdea, saveTheme } from "@/lib/learning/actions";
import { IDEA_STATUS } from "@/lib/learning/model";

const save = "inline-flex items-center justify-center gap-2 justify-self-start rounded-[5px] bg-green px-5 py-3 text-sm font-bold text-on-green disabled:opacity-60";
type Opt = { id: string; name: string };

export type ThemeInit = { name: string; summary: string; limitations: string; confidence: string; status: string; offering_ids: string[] };

export function ThemeForm({ id, init, offerings }: { id: string | null; init: ThemeInit; offerings: Opt[] }) {
  const [state, action, pending] = useActionState(saveTheme.bind(null, id), {} as ActionState);
  const v = (k: keyof ThemeInit) => state.values?.[k] ?? (init[k] as string);
  return (
    <form action={action} className="grid gap-4">
      <FormAlert error={state.error} />
      <Field label="Theme name" name="name"><input id="name" name="name" defaultValue={v("name")} maxLength={120} className={fieldCls} /></Field>
      <Field label="Summary" name="summary"><textarea id="summary" name="summary" defaultValue={v("summary")} rows={4} maxLength={2000} className={fieldCls} /></Field>
      <Field label="Limitations" name="limitations" hint="Say what this theme can't tell you (sample size, self-selection, period).">
        <textarea id="limitations" name="limitations" defaultValue={v("limitations")} rows={2} maxLength={1000} className={fieldCls} />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Confidence" name="confidence">
          <select id="confidence" name="confidence" defaultValue={v("confidence")} className={fieldCls}>
            <option value="low">Low</option><option value="med">Medium</option><option value="high">High</option>
          </select>
        </Field>
        <Field label="Status" name="status" hint="Clients see confirmed themes only.">
          <select id="status" name="status" defaultValue={v("status")} className={fieldCls}>
            <option value="draft">Draft (staff only)</option><option value="confirmed">Confirmed</option>
          </select>
        </Field>
      </div>
      <fieldset className="grid gap-2">
        <legend className="mb-1 text-[13px] font-bold">Offerings</legend>
        <div className="grid grid-cols-2 gap-2 max-sm:grid-cols-1">
          {offerings.map((o) => (
            <label key={o.id} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="offering_ids" value={o.id} defaultChecked={init.offering_ids.includes(o.id)} className="accent-green-700" /> {o.name}
            </label>
          ))}
        </div>
      </fieldset>
      <button disabled={pending} className={save}>{pending && <Loader2 className="size-4 animate-spin" aria-hidden />} Save theme</button>
    </form>
  );
}

export type IdeaInit = {
  title: string; problem: string; offering_id: string; theme_id: string; proposed_outcome: string;
  owner_team: string; priority: string; status: string; public_update: string; client_visible: boolean;
};

export function IdeaForm({ id, init, offerings, themes }: { id: string | null; init: IdeaInit; offerings: Opt[]; themes: Opt[] }) {
  const [state, action, pending] = useActionState(saveIdea.bind(null, id), {} as ActionState);
  const v = (k: Exclude<keyof IdeaInit, "client_visible">) => state.values?.[k] ?? init[k];
  return (
    <form action={action} className="grid gap-4">
      <FormAlert error={state.error} />
      <Field label="Idea title" name="title"><input id="title" name="title" defaultValue={v("title")} maxLength={140} className={fieldCls} /></Field>
      <Field label="Problem (internal)" name="problem"><textarea id="problem" name="problem" defaultValue={v("problem")} rows={3} maxLength={2000} className={fieldCls} /></Field>
      <Field label="Proposed outcome (internal)" name="proposed_outcome">
        <textarea id="proposed_outcome" name="proposed_outcome" defaultValue={v("proposed_outcome")} rows={2} maxLength={2000} className={fieldCls} />
      </Field>
      <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
        <Field label="Offering" name="offering_id">
          <select id="offering_id" name="offering_id" defaultValue={v("offering_id")} className={fieldCls}>
            <option value="">Cross-offering</option>
            {offerings.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </Field>
        <Field label="Theme" name="theme_id">
          <select id="theme_id" name="theme_id" defaultValue={v("theme_id")} className={fieldCls}>
            <option value="">None</option>
            {themes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </Field>
        <Field label="Owner / team" name="owner_team"><input id="owner_team" name="owner_team" defaultValue={v("owner_team")} maxLength={80} className={fieldCls} /></Field>
        <Field label="Priority (internal)" name="priority">
          <select id="priority" name="priority" defaultValue={v("priority")} className={fieldCls}>
            <option value="low">Low</option><option value="med">Medium</option><option value="high">High</option>
          </select>
        </Field>
        <Field label="Status" name="status" hint="Every change is recorded.">
          <select id="status" name="status" defaultValue={v("status")} className={fieldCls}>
            {Object.entries(IDEA_STATUS).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Update for contributors" name="public_update" hint="Shown to clients and sent to contributors whose evidence is linked. No dates, commitments or other clients' details.">
        <textarea id="public_update" name="public_update" defaultValue={v("public_update")} rows={2} maxLength={600} className={fieldCls} />
      </Field>
      <label className="flex items-center gap-2 text-sm font-bold">
        <input type="checkbox" name="client_visible" defaultChecked={state.values ? state.values.client_visible === "on" : init.client_visible} className="accent-green-700" />
        Visible to clients (title, status, owner and the update only)
      </label>
      <button disabled={pending} className={save}>{pending && <Loader2 className="size-4 animate-spin" aria-hidden />} Save idea</button>
    </form>
  );
}
