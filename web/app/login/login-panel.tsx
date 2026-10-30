"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { ArrowRight, KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DemoPersona } from "@/lib/auth/demo";
import { type AuthState, demoSignIn, requestCode, verifyCode } from "./actions";

type Demo = DemoPersona & { email: string };

const field =
  "w-full rounded-md border border-input bg-white px-3.5 py-3 text-[15px] text-ink outline-none transition focus:border-green-700 focus:ring-3 focus:ring-green/30 read-only:bg-light";
const label = "text-[13px] font-bold text-ink";
const submit =
  "inline-flex w-full items-center justify-center gap-2 rounded-[5px] bg-green px-5 py-3.5 text-sm font-bold text-on-green transition hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-60";

function Alert({ state }: { state: AuthState }) {
  if (state.error) return <p role="alert" className="rounded-md border border-orange-200 bg-orange-50 px-3 py-2 text-sm text-orange-800">{state.error}</p>;
  if (state.info) return <p role="status" className="rounded-md bg-green-050 px-3 py-2 text-sm text-green-700">{state.info}</p>;
  return null;
}

export function LoginPanel({ demos }: { demos: Demo[] }) {
  const [otp, otpAction, otpPending] = useActionState(requestCode, { step: "email" } as AuthState);
  const [code, codeAction, codePending] = useActionState(verifyCode, { step: "code" } as AuthState);
  const [demoState, demoAction, demoPending] = useActionState(demoSignIn, { step: "email" } as AuthState);
  const [demo, setDemo] = useState<Demo | null>(null);
  const demoForm = useRef<HTMLFormElement>(null);

  // Visible autofill, then submit: the masked value is cosmetic — the server holds the real password.
  useEffect(() => {
    if (!demo) return;
    const t = setTimeout(() => demoForm.current?.requestSubmit(), 650);
    return () => clearTimeout(t);
  }, [demo]);

  const onCodeStep = otp.step === "code" || code.error;
  const email = code.email ?? otp.email ?? "";

  return (
    <div className="grid gap-8">
      <div className="rounded-[14px] border border-line bg-white p-8 shadow-card max-sm:p-6">
        {demo ? (
          <form ref={demoForm} action={demoAction} className="grid gap-5">
            <div>
              <p className="eyebrow">Demo sign-in</p>
              <h2 className="mt-2 text-2xl font-bold tracking-tight">{demo.label}</h2>
              <p className="text-sm text-slate">{demo.org} · {demo.role}</p>
            </div>
            <input type="hidden" name="alias" value={demo.alias} />
            <label className="grid gap-2">
              <span className={label}>Email</span>
              <input className={field} value={demo.email} readOnly />
            </label>
            <label className="grid gap-2">
              <span className={label}>Password</span>
              <input className={field} type="password" value="demo-password" readOnly aria-describedby="demo-note" />
            </label>
            <Alert state={demoState} />
            <button className={submit} disabled={demoPending}>
              {demoPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <KeyRound className="size-4" aria-hidden />}
              {demoPending ? "Signing in…" : "Sign in"}
            </button>
            <p id="demo-note" className="text-xs text-slate">
              Demo accounts use synthetic data. The password is held on the server, not in your browser.
            </p>
            <button type="button" onClick={() => setDemo(null)} className="text-sm font-bold text-green-700 hover:underline">
              Use your email instead
            </button>
          </form>
        ) : onCodeStep ? (
          <form action={codeAction} className="grid gap-5">
            <div>
              <p className="eyebrow">Check your inbox</p>
              <h2 className="mt-2 text-2xl font-bold tracking-tight">Enter your code</h2>
            </div>
            <input type="hidden" name="email" value={email} />
            <p className="text-sm text-slate">
              We sent a 6-digit code to <strong className="text-ink">{email}</strong>. It expires in 5 minutes.
            </p>
            <label className="grid gap-2">
              <span className={label}>Verification code</span>
              <input
                className={cn(field, "text-center font-mono text-2xl tracking-[0.5em]")}
                name="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="\d{6}"
                maxLength={6}
                required
                autoFocus
              />
            </label>
            <Alert state={code.error ? code : otp} />
            <button className={submit} disabled={codePending}>
              {codePending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <ShieldCheck className="size-4" aria-hidden />}
              Verify and sign in
            </button>
          </form>
        ) : (
          <form action={otpAction} className="grid gap-5">
            <div>
              <p className="eyebrow">Sign in</p>
              <h2 className="mt-2 text-2xl font-bold tracking-tight">Welcome to azentio.ai</h2>
              <p className="mt-1 text-sm text-slate">Employees and invited client teams. We&rsquo;ll email you a one-time code.</p>
            </div>
            <label className="grid gap-2">
              <span className={label}>Work email</span>
              <input className={field} name="email" type="email" autoComplete="email" defaultValue={otp.email} required />
            </label>
            <Alert state={otp.error ? otp : demoState} />
            <button className={submit} disabled={otpPending}>
              {otpPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <ArrowRight className="size-4" aria-hidden />}
              Email me a code
            </button>
          </form>
        )}
      </div>

      {demos.length > 0 && (
        <section aria-labelledby="demo-heading">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 id="demo-heading" className="eyebrow">Demo accounts</h2>
            <span className="text-xs text-slate">Admin roles · synthetic data</span>
          </div>
          <ul className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
            {demos.map((d) => (
              <li key={d.alias}>
                <button
                  type="button"
                  onClick={() => setDemo(d)}
                  disabled={demoPending}
                  aria-pressed={demo?.alias === d.alias}
                  className="group flex w-full items-start gap-3 rounded-[10px] border border-line bg-white p-4 text-left transition hover:-translate-y-0.5 hover:border-green hover:shadow-card aria-pressed:border-green aria-pressed:bg-green-050"
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-navy text-[13px] font-extrabold text-green">
                    {d.label.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-bold text-ink">{d.label}</span>
                    <span className="block truncate text-xs text-slate">{d.org} · {d.role}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
