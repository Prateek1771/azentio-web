"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Loader2, Sparkles } from "lucide-react";
import { type ThemeSuggestion, createSuggestedTheme, suggestThemes, trendDigest } from "@/lib/ai/assist-actions";

const btn = "inline-flex items-center gap-2 rounded-[5px] bg-navy px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60";
const field = "w-full rounded-md border border-line-strong bg-white px-3 py-2 text-sm";

export function ThemeSuggester() {
  const [pending, start] = useTransition();
  const [res, setRes] = useState<{ error?: string; suggestions?: ThemeSuggestion[] } | null>(null);
  return (
    <div className="grid gap-4">
      <button type="button" disabled={pending} onClick={() => start(async () => setRes(await suggestThemes()))} className={btn + " justify-self-start"}>
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Sparkles className="size-4" aria-hidden />} Suggest themes
      </button>
      {res?.error && <p role="alert" className="text-sm text-orange-800">{res.error}</p>}
      {res?.suggestions?.length === 0 && <p role="status" className="text-sm text-slate">No groups of similar approved contributions yet.</p>}
      {res?.suggestions?.map((s, i) => (
        <form key={i} action={createSuggestedTheme} className="grid gap-3 rounded-[10px] border border-line bg-white p-5">
          {s.ids.map((id) => <input key={id} type="hidden" name="ids" value={id} />)}
          <label className="grid gap-1 text-xs font-bold">Name<input name="name" defaultValue={s.name} maxLength={120} className={field} /></label>
          <label className="grid gap-1 text-xs font-bold">Summary<textarea name="summary" defaultValue={s.summary} rows={2} className={field} /></label>
          <label className="grid gap-1 text-xs font-bold">Limitations<textarea name="limitations" defaultValue={s.limitations} rows={2} className={field} /></label>
          <div className="text-xs text-slate">
            <p className="font-bold text-ink">Grouped evidence ({s.ids.length})</p>
            <ul className="mt-1 grid gap-0.5">{s.titles.map((t) => <li key={t}>· {t}</li>)}</ul>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button className="rounded-[5px] bg-green px-4 py-2 text-sm font-bold text-on-green">Create as draft theme</button>
            <p className="text-xs text-slate">AI-suggested name. Grouping is by text similarity. Nothing is shared until you confirm the theme.</p>
          </div>
        </form>
      ))}
    </div>
  );
}

// [S#] markers link to the cited approved contribution.
function Cited({ text, sources }: { text: string; sources: { n: number; id: string; title: string }[] }) {
  return (
    <div className="grid gap-3 text-sm leading-[1.7]">
      {text.split(/\n\s*\n/).map((p, i) => (
        <p key={i}>
          {p.split(/(\[S\d+\])/g).map((part, j) => {
            const s = sources.find((x) => `[S${x.n}]` === part);
            return s ? <Link key={j} href={`/learning/${s.id}`} title={s.title} className="mx-0.5 rounded bg-green-050 px-1 text-[11px] font-bold text-green-700">S{s.n}</Link> : <span key={j}>{part}</span>;
          })}
        </p>
      ))}
    </div>
  );
}

export function DigestGenerator() {
  const [pending, start] = useTransition();
  const [res, setRes] = useState<Awaited<ReturnType<typeof trendDigest>> | null>(null);
  return (
    <div className="grid gap-4">
      <button type="button" disabled={pending} onClick={() => start(async () => setRes(await trendDigest()))} className={btn + " justify-self-start"}>
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Sparkles className="size-4" aria-hidden />} Generate last-30-days digest
      </button>
      {res?.error && <p role="alert" className="text-sm text-orange-800">{res.error}</p>}
      {res?.blocked && <p role="alert" className="text-sm text-orange-800">The draft failed a safety check ({res.blocked}) and wasn&rsquo;t shown. Try again or write the digest by hand.</p>}
      {res?.text && (
        <div role="status" className="grid gap-3 rounded-[10px] border border-line bg-white p-5">
          <Cited text={res.text} sources={res.sources ?? []} />
          <p className="text-xs text-slate">AI-generated from approved, de-identified contributions; every claim is cited and checked. Internal use. Not advice.</p>
        </div>
      )}
    </div>
  );
}
