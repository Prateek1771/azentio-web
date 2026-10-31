"use client";

import { Fragment, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Loader2, Send, ThumbsDown, ThumbsUp, TriangleAlert, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Source = { n: number; id: string; kind: "shared" | "theme" | "mine" | "guide"; title: string; href?: string };
type Reply = { interactionId: string | null; verdict: "answered" | "general" | "refused" | "blocked" | "no_evidence"; answer?: string; message?: string; sources: Source[] };
type Turn = { q: string; r?: Reply; error?: boolean; feedback?: string };

const EXAMPLES = ["What is this portal about?", "How do seasonal cash-flow cycles affect SME assessments?", "What are my recent projects?"];
const DISCLAIMER = "Synthesised from approved, de-identified contributions. Not advice.";
const disclaimer = (r: Reply) =>
  r.verdict === "general"
    ? "General answer from AIRA's own knowledge, not from approved evidence. Not advice."
    : r.sources.every((s) => s.kind === "shared" || s.kind === "theme") ? DISCLAIMER : "Based on the cited sources. Not advice.";
const href = (s: Source) => s.href ?? (s.kind === "shared" ? `/learning/${s.id}` : "/learning/themes");

// [S1] markers become links to the cited source; the text itself is rendered as plain text.
function Cited({ text, sources }: { text: string; sources: Source[] }) {
  return (
    <>
      {text.split(/\n\s*\n/).map((p, i) => (
        <p key={i} className="mt-2 first:mt-0">
          {p.split(/(\[S\d+\])/g).map((part, j) => {
            const n = /^\[S(\d+)\]$/.exec(part)?.[1];
            const s = n ? sources.find((x) => x.n === Number(n)) : undefined;
            return s ? (
              <Link key={j} href={href(s)} className="mx-0.5 rounded bg-green-050 px-1 text-[11px] font-bold text-green-700 hover:underline" title={s.title}>
                S{s.n}
              </Link>
            ) : (
              <Fragment key={j}>{part}</Fragment>
            );
          })}
        </p>
      ))}
    </>
  );
}

export function AiraLauncher() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const [signedOut, setSignedOut] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  // The launcher sits in the root layout and survives sign-in (a client-side redirect), so a 401 seen
  // before login must not stick: any navigation clears it, and the next question re-checks the session.
  const pathname = usePathname();
  const [seenPath, setSeenPath] = useState(pathname);
  if (pathname !== seenPath) {
    setSeenPath(pathname);
    if (signedOut) {
      setSignedOut(false);
      setTurns([]);
    }
  }

  async function ask(question: string) {
    if (!question.trim() || busy) return;
    setBusy(true);
    setQ("");
    setTurns((t) => [...t, { q: question }]);
    try {
      const res = await fetch("/api/aira", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question }) });
      if (res.status === 401) setSignedOut(true);
      const r = (await res.json()) as Reply;
      setTurns((t) => t.map((x, i) => (i === t.length - 1 ? { ...x, r } : x)));
    } catch {
      setTurns((t) => t.map((x, i) => (i === t.length - 1 ? { ...x, error: true } : x)));
    } finally {
      setBusy(false);
      requestAnimationFrame(() => end.current?.scrollIntoView({ block: "end" }));
    }
  }

  async function rate(i: number, feedback: "up" | "down" | "correction") {
    const id = turns[i].r?.interactionId;
    if (!id) return;
    setTurns((t) => t.map((x, j) => (j === i ? { ...x, feedback } : x)));
    await fetch("/api/aira", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, feedback }) }).catch(() => {});
  }

  return (
    <>
      {open && (
        <div
          role="dialog"
          aria-label="AIRA assistant"
          className="fixed right-6 bottom-24 z-[60] flex h-[min(560px,calc(100dvh-140px))] w-[min(400px,calc(100vw-32px))] flex-col overflow-hidden rounded-2xl border border-[#e1e5ee] bg-white shadow-panel max-sm:right-4"
        >
          <div className="on-dark flex items-center justify-between bg-navy px-5 py-4 text-white">
            <div>
              <p className="text-[13px] font-extrabold tracking-[.6px]">AIRA</p>
              <p className="text-xs text-on-dark-muted">Answers cite their sources. Never shares other organisations&rsquo; data.</p>
            </div>
            <button type="button" aria-label="Close AIRA" onClick={() => setOpen(false)} className="rounded p-1 hover:text-green">
              <X className="size-5" aria-hidden />
            </button>
          </div>

          {signedOut ? (
            <div className="flex flex-1 flex-col justify-center gap-3 p-6 text-center">
              <p className="text-[19px] font-bold text-ink">Sign in to ask AIRA</p>
              <p className="text-sm leading-[1.65] text-slate">AIRA answers questions about approved market observations and themes, and links every answer to its evidence.</p>
              <Link href={`/login?next=${encodeURIComponent(pathname)}`} className="mx-auto rounded-[5px] bg-green px-5 py-3 text-sm font-bold text-on-green">Sign in</Link>
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto px-4 py-4 text-sm" aria-live="polite">
                {!turns.length && (
                  <div className="grid gap-2">
                    <p className="text-slate">Ask about the portal, your own work, or patterns in approved shared learning. Try:</p>
                    {EXAMPLES.map((e) => (
                      <button key={e} type="button" onClick={() => ask(e)} className="rounded-lg border border-line px-3 py-2 text-left hover:border-green-700">{e}</button>
                    ))}
                  </div>
                )}
                {turns.map((t, i) => (
                  <div key={i} className="mb-4 grid gap-2">
                    <p className="ml-8 rounded-xl rounded-br-sm bg-navy px-3 py-2 text-white">{t.q}</p>
                    {!t.r && !t.error && <p className="inline-flex items-center gap-2 text-slate"><Loader2 className="size-4 animate-spin" aria-hidden /> Checking the sources…</p>}
                    {t.error && <p className="text-orange-800">Something went wrong. Please try again.</p>}
                    {t.r && (
                      <div data-verdict={t.r.verdict} className={cn("mr-4 rounded-xl rounded-bl-sm border px-3 py-2.5 leading-[1.6]", t.r.verdict === "answered" || t.r.verdict === "general" ? "border-line bg-light" : "border-amber-200 bg-amber-50")}>
                        {t.r.verdict === "answered" || t.r.verdict === "general" ? (
                          <Cited text={t.r.answer ?? ""} sources={t.r.sources} />
                        ) : (
                          <p className="flex gap-2"><TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-700" aria-hidden />{t.r.message}</p>
                        )}
                        {t.r.verdict === "no_evidence" && <Link href="/learning" className="mt-2 inline-block text-xs font-bold text-green-700 hover:underline">Browse the shared feed</Link>}
                        {t.r.sources.length > 0 && t.r.verdict !== "refused" && (
                          <ul className="mt-3 grid gap-1 border-t border-line pt-2 text-xs" aria-label="Sources">
                            {t.r.sources.map((s) => (
                              <li key={s.n}><Link href={href(s)} className="hover:underline"><strong>S{s.n}</strong> {s.title}</Link></li>
                            ))}
                          </ul>
                        )}
                        {(t.r.verdict === "answered" || t.r.verdict === "general") && (
                          <>
                            <p className="mt-2 text-[11px] text-slate">{disclaimer(t.r)}</p>
                            <div className="mt-2 flex items-center gap-1 text-slate">
                              {t.feedback ? (
                                <span role="status" className="text-xs font-bold text-green-700">Thanks for the feedback.</span>
                              ) : (
                                <>
                                  <button type="button" aria-label="Helpful" onClick={() => rate(i, "up")} className="rounded p-1 hover:text-green-700"><ThumbsUp className="size-4" aria-hidden /></button>
                                  <button type="button" aria-label="Not helpful" onClick={() => rate(i, "down")} className="rounded p-1 hover:text-orange-700"><ThumbsDown className="size-4" aria-hidden /></button>
                                  <button type="button" onClick={() => rate(i, "correction")} className="ml-1 text-xs font-bold hover:text-orange-700">That&rsquo;s wrong</button>
                                </>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                <div ref={end} />
              </div>
              <form onSubmit={(e) => { e.preventDefault(); ask(q); }} className="flex items-end gap-2 border-t border-line p-3">
                <label className="sr-only" htmlFor="aira-q">Ask AIRA</label>
                <textarea
                  id="aira-q"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(q); } }}
                  rows={2}
                  maxLength={1000}
                  placeholder="Ask about the portal, your work or shared learning…"
                  className="min-h-[44px] flex-1 resize-none rounded-md border border-line-strong px-3 py-2 text-sm outline-none focus:border-green-700"
                />
                <button type="submit" disabled={busy || !q.trim()} aria-label="Send question" className="grid size-11 place-items-center rounded-md bg-green text-navy disabled:opacity-50">
                  {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Send className="size-4" aria-hidden />}
                </button>
              </form>
              <p className="px-3 pb-2 text-right text-[10px] text-slate">{q.length}/1000 · Don&rsquo;t include personal or client-identifying details.</p>
            </>
          )}
        </div>
      )}
      <button
        type="button"
        aria-label={open ? "Close AIRA" : "Open AIRA"}
        aria-expanded={open}
        onClick={() => {
          // reopening re-checks too (e.g. signed in from another tab)
          if (!open && signedOut) {
            setSignedOut(false);
            setTurns([]);
          }
          setOpen(!open);
        }}
        className="fixed right-6 bottom-6 z-[60] grid size-[58px] place-items-center rounded-full border-2 border-navy/10 bg-green text-navy shadow-float transition-transform hover:-translate-y-0.5 max-sm:right-4 max-sm:bottom-4"
      >
        <span className="text-[13px] leading-none font-extrabold tracking-[.6px]">AIRA</span>
      </button>
    </>
  );
}
