"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

export const fieldCls =
  "w-full rounded-md border border-[#d7e1e8] bg-white px-3.5 py-3 text-[15px] text-[#152536] outline-none transition focus:border-green-700 focus:ring-3 focus:ring-green/30 aria-invalid:border-orange-500";

// Wraps a form action so every submit carries the time the form became interactive (set on the
// client after hydration, so prerendering never bakes in a build-time stamp, and React's
// post-action form reset can't wipe it).
export function useTimedAction(action: (fd: FormData) => void) {
  const startedAt = useRef(0);
  useEffect(() => {
    startedAt.current = Date.now();
  }, []);
  return (fd: FormData) => {
    fd.set("t", String(startedAt.current));
    action(fd);
  };
}

// Honeypot: humans never see or fill it.
export function BotTraps() {
  return (
    <>
      <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label>
          Website
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
    </>
  );
}

export function Field({
  label,
  name,
  error,
  children,
  hint,
}: {
  label: string;
  name: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-2">
      <label htmlFor={name} className="text-[13px] font-bold text-ink">
        {label}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-slate">{hint}</p>}
      {error && (
        <p id={`${name}-error`} className="text-xs font-bold text-orange-700">
          {error}
        </p>
      )}
    </div>
  );
}

export const errProps = (name: string, error?: string) =>
  error ? { "aria-invalid": true as const, "aria-describedby": `${name}-error` } : {};

export function FormAlert({ error, className }: { error?: string; className?: string }) {
  if (!error) return null;
  return (
    <p role="alert" className={cn("rounded-md border border-orange-200 bg-orange-50 px-3 py-2 text-sm text-orange-800", className)}>
      {error}
    </p>
  );
}
