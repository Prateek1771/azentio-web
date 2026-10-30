"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { Field, FormAlert, fieldCls } from "@/components/site/form-bits";
import { type FormState, addTeamMember, createTeam, saveExperiment, saveLibraryItem } from "@/lib/workspace/actions";

const save = "inline-flex items-center justify-center gap-2 justify-self-start rounded-[5px] bg-green px-5 py-3 text-sm font-bold text-on-green disabled:opacity-60";
const Spin = ({ on }: { on: boolean }) => (on ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null);
type Opt = { id: string; name: string };

export function TeamForm() {
  const [state, action, pending] = useActionState(createTeam, {} as FormState);
  const v = (k: string) => state.values?.[k] ?? "";
  return (
    <form action={action} className="grid gap-4">
      <FormAlert error={state.error} />
      <div className="grid grid-cols-[2fr_1fr] gap-4 max-sm:grid-cols-1">
        <Field label="Team name" name="name"><input id="name" name="name" defaultValue={v("name")} maxLength={80} required className={fieldCls} /></Field>
        <Field label="Type" name="kind">
          <select id="kind" name="kind" defaultValue={v("kind") || "hackathon"} className={fieldCls}>
            <option value="hackathon">Hackathon team</option>
            <option value="squad">Working group</option>
          </select>
        </Field>
      </div>
      <Field label="What are you working on?" name="description">
        <textarea id="description" name="description" defaultValue={v("description")} rows={3} maxLength={1000} className={fieldCls} />
      </Field>
      <button disabled={pending} className={save}><Spin on={pending} /> Create team</button>
    </form>
  );
}

export function AddMemberForm({ teamId, directory }: { teamId: string; directory: string[] }) {
  const [state, action, pending] = useActionState(addTeamMember.bind(null, teamId), {} as FormState);
  return (
    <form action={action} className="grid gap-2">
      <div className="flex gap-2 max-sm:flex-col">
        <input name="email" list="employee-directory" aria-label="Colleague's email" placeholder="colleague@azentio.example" required className={fieldCls} />
        <datalist id="employee-directory">{directory.map((e) => <option key={e} value={e} />)}</datalist>
        <button disabled={pending} className="shrink-0 rounded-[5px] bg-navy px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60">Add to team</button>
      </div>
      {state.error && <p role="alert" className="text-sm font-bold text-orange-700">{state.error}</p>}
    </form>
  );
}

export type ExperimentInit = { title: string; hypothesis: string; method: string; result: string; status: string; offering_id: string; team_id: string };

export function ExperimentForm({ id, init, offerings, teams }: { id: string | null; init: ExperimentInit; offerings: Opt[]; teams: Opt[] }) {
  const [state, action, pending] = useActionState(saveExperiment.bind(null, id), {} as FormState);
  const v = (k: keyof ExperimentInit) => state.values?.[k] ?? init[k];
  return (
    <form action={action} className="grid gap-4">
      <FormAlert error={state.error} />
      <Field label="Experiment title" name="title"><input id="title" name="title" defaultValue={v("title")} maxLength={140} required className={fieldCls} /></Field>
      <Field label="Hypothesis" name="hypothesis" hint="What do you expect to happen, and why?">
        <textarea id="hypothesis" name="hypothesis" defaultValue={v("hypothesis")} rows={3} maxLength={2000} required className={fieldCls} />
      </Field>
      <Field label="Method" name="method"><textarea id="method" name="method" defaultValue={v("method")} rows={3} maxLength={4000} className={fieldCls} /></Field>
      <Field label="Result" name="result" hint="Fill in when it's done, including what didn't work.">
        <textarea id="result" name="result" defaultValue={v("result")} rows={3} maxLength={4000} className={fieldCls} />
      </Field>
      <div className="grid grid-cols-3 gap-4 max-md:grid-cols-1">
        <Field label="Status" name="status">
          <select id="status" name="status" defaultValue={v("status")} className={fieldCls}>
            <option value="draft">Draft (only you and your team)</option>
            <option value="running">Running</option>
            <option value="completed">Completed</option>
            <option value="stopped">Stopped</option>
          </select>
        </Field>
        <Field label="Offering" name="offering_id">
          <select id="offering_id" name="offering_id" defaultValue={v("offering_id")} className={fieldCls}>
            <option value="">Not offering-specific</option>
            {offerings.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </Field>
        <Field label="Team" name="team_id">
          <select id="team_id" name="team_id" defaultValue={v("team_id")} className={fieldCls}>
            <option value="">Just me</option>
            {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </Field>
      </div>
      <button disabled={pending} className={save}><Spin on={pending} /> Save experiment</button>
    </form>
  );
}

export type LibraryInit = { title: string; body: string; review_date: string; published: boolean };

export function LibraryForm({ id, init }: { id: string | null; init: LibraryInit }) {
  const [state, action, pending] = useActionState(saveLibraryItem.bind(null, id), {} as FormState);
  const v = (k: "title" | "body" | "review_date") => state.values?.[k] ?? init[k];
  return (
    <form action={action} className="grid gap-4">
      <FormAlert error={state.error} />
      <Field label="Entry title" name="title"><input id="title" name="title" defaultValue={v("title")} maxLength={200} required className={fieldCls} /></Field>
      <Field label="Content" name="body"><textarea id="body" name="body" defaultValue={v("body")} rows={10} maxLength={20000} required className={fieldCls} /></Field>
      <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
        <Field label="Review by" name="review_date" hint="You own this entry; it's flagged when the date passes.">
          <input id="review_date" name="review_date" type="date" defaultValue={v("review_date")} required className={fieldCls} />
        </Field>
        <label className="flex items-center gap-2 self-center text-sm font-bold">
          <input type="checkbox" name="published" defaultChecked={state.values ? state.values.published === "on" : init.published} className="accent-green-700" />
          Published to all employees
        </label>
      </div>
      <button disabled={pending} className={save}><Spin on={pending} /> Save entry</button>
    </form>
  );
}
