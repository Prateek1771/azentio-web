"use client";

import { useState } from "react";
import { X } from "lucide-react";

// ponytail: shell only — the RAG endpoint and chat UI land in Phase 8 (/api/aira).
export function AiraLauncher() {
  const [open, setOpen] = useState(false);
  return (
    <>
      {open && (
        <div
          role="dialog"
          aria-label="AIRA assistant"
          className="fixed right-6 bottom-24 z-[60] flex h-[min(510px,calc(100dvh-140px))] w-[min(380px,calc(100vw-32px))] flex-col overflow-hidden rounded-2xl border border-[#e1e5ee] bg-white shadow-panel max-sm:right-4"
        >
          <div className="on-dark flex items-center justify-between bg-navy px-5 py-4 text-white">
            <div>
              <p className="text-[13px] font-extrabold tracking-[.6px]">AIRA</p>
              <p className="text-xs text-on-dark-muted">Answers cite approved, shared learning only.</p>
            </div>
            <button type="button" aria-label="Close AIRA" onClick={() => setOpen(false)} className="rounded p-1 hover:text-green">
              <X className="size-5" aria-hidden />
            </button>
          </div>
          <div className="flex flex-1 flex-col justify-center gap-3 p-6 text-center">
            <p className="text-[19px] font-bold text-ink">AIRA is getting ready.</p>
            <p className="text-sm leading-[1.65] text-slate">
              Sign in to ask questions about approved market observations and themes. Every answer will link to its evidence.
            </p>
          </div>
        </div>
      )}
      <button
        type="button"
        aria-label={open ? "Close AIRA" : "Open AIRA"}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="fixed right-6 bottom-6 z-[60] grid size-[58px] place-items-center rounded-full border-2 border-navy/10 bg-green text-navy shadow-float transition-transform hover:-translate-y-0.5 max-sm:right-4 max-sm:bottom-4"
      >
        <span className="text-[13px] leading-none font-extrabold tracking-[.6px]">AIRA</span>
      </button>
    </>
  );
}
