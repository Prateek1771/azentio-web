"use client";

import { useState, useTransition } from "react";
import { Bot, CheckCircle2, CircleAlert, CircleX, Info, Loader2, Play, ThumbsDown, ThumbsUp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Scenario } from "@/lib/playground/scenarios";
import type { Evidence } from "@/lib/playground/engines";
import { type RunResult, runScenario, saveFeedback } from "@/lib/playground/actions";

const STATUS = {
  pass: { icon: CheckCircle2, cls: "border-green/50 bg-green-050 text-green-700", label: "Pass" },
  warn: { icon: CircleAlert, cls: "border-amber-300 bg-amber-50 text-amber-800", label: "Caution" },
  fail: { icon: CircleX, cls: "border-orange-300 bg-orange-50 text-orange-800", label: "Fail" },
  info: { icon: Info, cls: "border-line bg-light text-slate", label: "Info" },
} as const;

const TONE = {
  positive: "border-green bg-green-050",
  caution: "border-amber-400 bg-amber-50",
  negative: "border-orange-400 bg-orange-50",
  neutral: "border-line-strong bg-white",
} as const;

const input =
  "w-full rounded-md border border-[#d7e1e8] bg-white px-3 py-2 text-sm text-ink outline-none focus:border-green-700 focus:ring-3 focus:ring-green/30";

export function Runner({ offering, flow, scenarios, org }: { offering: string; flow: string[]; scenarios: Scenario[]; org?: string }) {
  const [active, setActive] = useState(0);
  const s = scenarios[active];
  const [values, setValues] = useState<Record<string, number | string>>({});
  const [ai, setAi] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);
  const [pending, start] = useTransition();

  const pick = (i: number) => {
    setActive(i);
    setValues({});
    setResult(null);
  };
  const run = () =>
    start(async () => setResult(await runScenario({ offering, scenario: s.key, mode: ai ? "ai_assisted" : "deterministic", values, org })));

  const out = result?.output;
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] gap-6 max-[1100px]:grid-cols-1">
      {/* 1 · scenario + inputs */}
      <div className="grid content-start gap-5 rounded-[10px] border border-line bg-white p-6">
        <div role="tablist" aria-label="Scenarios" className="flex flex-wrap gap-2">
          {scenarios.map((sc, i) => (
            <button
              key={sc.key}
              role="tab"
              aria-selected={i === active}
              onClick={() => pick(i)}
              className={cn("rounded-full border px-3.5 py-1.5 text-xs font-bold", i === active ? "border-green bg-green text-on-green" : "border-line-strong hover:border-green-700")}
            >
              Scenario {i + 1}
            </button>
          ))}
        </div>
        <div>
          <p className="eyebrow">Synthetic scenario</p>
          <h2 className="mt-2 text-xl font-bold">{s.title}</h2>
          <p className="mt-1 text-sm text-slate">
            <strong className="text-ink">{s.entity}</strong> · {s.summary}
          </p>
        </div>

        {s.document && (
          <pre aria-label="Synthetic document" className="overflow-x-auto rounded-lg bg-navy-900 p-4 font-mono text-xs leading-relaxed text-on-dark-muted">{s.document}</pre>
        )}
        {s.fields.length > 0 && (
          <table className="w-full text-sm">
            <caption className="sr-only">Scenario inputs</caption>
            <tbody>
              {s.fields.map((f) => (
                <tr key={f.key} className="border-b border-line last:border-0">
                  <th scope="row" className="py-2.5 pr-3 text-left font-normal text-slate">{f.label}</th>
                  <td className="w-[45%] py-2">
                    {f.editable && f.options ? (
                      <select aria-label={f.label} className={input} value={String(values[f.key] ?? f.value)} onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}>
                        {f.options.map((o) => <option key={o}>{o}</option>)}
                      </select>
                    ) : f.editable ? (
                      <div className="flex items-center gap-2">
                        <input aria-label={f.label} type="number" step="any" min={f.min} max={f.max} className={input} value={values[f.key] ?? f.value} onChange={(e) => setValues({ ...values, [f.key]: e.target.value === "" ? "" : Number(e.target.value) })} />
                        {f.unit && <span className="text-xs text-slate">{f.unit}</span>}
                      </div>
                    ) : (
                      <span className="font-mono text-xs font-bold">{String(f.value) || "—"}{f.unit ? ` ${f.unit}` : ""}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <fieldset className="grid gap-2">
          <legend className="mb-2 text-[13px] font-bold">Mode</legend>
          <div className="grid grid-cols-2 gap-2">
            {([false, true] as const).map((m) => (
              <label key={String(m)} className={cn("flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2.5 text-sm", ai === m ? "border-green bg-green-050 font-bold" : "border-line")}>
                <input type="radio" name="mode" className="accent-[#247447]" checked={ai === m} onChange={() => setAi(m)} />
                {m ? "AI-assisted" : "Deterministic"}
              </label>
            ))}
          </div>
          <p className="text-xs text-slate">AI-assisted adds a plain-English explanation of the same deterministic result. It only ever sees synthetic data.</p>
        </fieldset>

        <button onClick={run} disabled={pending} className="inline-flex items-center justify-center gap-2 rounded-[5px] bg-green px-5 py-3.5 text-sm font-bold text-on-green transition hover:-translate-y-0.5 disabled:opacity-60">
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Play className="size-4" aria-hidden />}
          {pending ? "Running…" : "Run simulation"}
        </button>
      </div>

      {/* 2 · results */}
      <div className="grid content-start gap-5" aria-live="polite">
        <ol aria-label="Workflow progress" className="flex flex-wrap gap-2">
          {flow.map((step, i) => {
            const done = out ? i < out.stepsCompleted : false;
            return (
              <li key={step} className={cn("rounded-full border px-3 py-1.5 text-xs font-bold", done ? "border-green bg-green-050 text-green-700" : "border-line text-slate")}>
                {String(i + 1).padStart(2, "0")} {step}
              </li>
            );
          })}
        </ol>

        {result?.error && <p role="alert" className="rounded-md border border-orange-200 bg-orange-50 px-3 py-2 text-sm text-orange-800">{result.error}</p>}

        {out ? (
          <>
            <div className={cn("rounded-[10px] border-l-4 p-6", TONE[out.tone])} data-testid="run-headline">
              <p className="eyebrow">Result · simulated</p>
              <p className="mt-2 text-2xl leading-tight font-bold">{out.headline}</p>
              {out.metrics && (
                <dl className="mt-4 grid grid-cols-2 gap-3">
                  {out.metrics.map((m) => (
                    <div key={m.label} className="rounded-lg bg-white/70 p-3">
                      <dt className="text-xs text-slate">{m.label}</dt>
                      <dd className="font-bold">{m.value}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>

            {(out.narrative || out.aiNotice) && (
              <div className="rounded-[10px] border border-line bg-white p-5">
                <p className="flex items-center gap-2 text-xs font-extrabold tracking-[1.5px] text-green-700 uppercase">
                  <Bot className="size-4" aria-hidden /> AI-generated · simulated
                </p>
                {out.narrative ? <p className="mt-2 text-sm leading-[1.7] whitespace-pre-line">{out.narrative}</p> : <p className="mt-2 text-sm text-slate">{out.aiNotice}</p>}
              </div>
            )}

            <section aria-label="Evidence">
              <h3 className="mb-3 text-sm font-bold">Evidence</h3>
              <ul className="grid grid-cols-1 gap-2">
                {out.evidence.map((e: Evidence, i) => {
                  const st = STATUS[e.status];
                  return (
                    <li key={`${e.label}-${i}`} className={cn("flex items-start gap-3 rounded-lg border px-4 py-3 text-sm", st.cls)}>
                      <st.icon className="mt-0.5 size-4 shrink-0" aria-label={st.label} />
                      <span className="min-w-0 flex-1">
                        <span className="font-bold text-ink">{e.label}</span>
                        {e.note && <span className="block text-xs">{e.note}</span>}
                      </span>
                      <span className="shrink-0 text-right font-mono text-xs text-ink">{e.value}</span>
                    </li>
                  );
                })}
              </ul>
            </section>

            {result?.runId && <Feedback runId={result.runId} key={result.runId} />}
          </>
        ) : (
          !result?.error && (
            <div className="grid place-items-center rounded-[10px] border border-dashed border-line-strong bg-light p-12 text-center text-sm text-slate">
              Run the simulation to see the result, evidence and workflow progress.
            </div>
          )
        )}
      </div>
    </div>
  );
}

function Feedback({ runId }: { runId: string }) {
  const [useful, setUseful] = useState<boolean | null>(null);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [state, setState] = useState<{ ok?: boolean; error?: string }>({});
  const [pending, start] = useTransition();

  if (state.ok) return <p role="status" className="rounded-[10px] bg-green-050 p-4 text-sm font-bold text-green-700">Thanks. Your feedback is saved with this run.</p>;

  return (
    <form
      className="grid gap-4 rounded-[10px] border border-line bg-white p-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (useful === null || !rating) return setState({ error: "Please choose useful / not useful and a rating." });
        start(async () => setState(await saveFeedback({ runId, useful, rating, comment: comment || undefined })));
      }}
    >
      <h3 className="text-sm font-bold">Was this workflow useful?</h3>
      <div className="flex flex-wrap items-center gap-2">
        {([true, false] as const).map((u) => (
          <button key={String(u)} type="button" aria-pressed={useful === u} onClick={() => setUseful(u)} className={cn("inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-bold", useful === u ? "border-green bg-green-050 text-green-700" : "border-line")}>
            {u ? <ThumbsUp className="size-4" aria-hidden /> : <ThumbsDown className="size-4" aria-hidden />}
            {u ? "Useful" : "Not useful"}
          </button>
        ))}
        <span className="mx-2 h-6 w-px bg-line" aria-hidden />
        <div role="radiogroup" aria-label="Rating" className="flex gap-1">
          {[1, 2, 3, 4, 5].map((r) => (
            <button key={r} type="button" role="radio" aria-checked={rating === r} aria-label={`${r} of 5`} onClick={() => setRating(r)} className={cn("size-8 rounded-full border text-sm font-bold", rating >= r ? "border-green bg-green text-on-green" : "border-line")}>
              {r}
            </button>
          ))}
        </div>
      </div>
      <label className="grid gap-1.5 text-[13px] font-bold">
        Comment (optional)
        <textarea value={comment} onChange={(e) => setComment(e.target.value)} maxLength={1000} rows={2} className={input} placeholder="What would make this workflow more useful?" />
      </label>
      {state.error && <p role="alert" className="text-xs font-bold text-orange-700">{state.error}</p>}
      <button disabled={pending} className="justify-self-start rounded-[5px] border border-line-strong px-4 py-2.5 text-sm font-bold hover:border-green-700 disabled:opacity-60">
        {pending ? "Saving…" : "Save feedback"}
      </button>
    </form>
  );
}
