"use client";

import Link from "next/link";
import { Section } from "@/components/portal/primitives";

// Route-level error boundary: a calm message and a retry, never a stack trace. The digest lets admins
// find the server log entry without exposing details.
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <Section>
      <div className="mx-auto max-w-[560px] text-center">
        <p className="eyebrow">Something went wrong</p>
        <h1 className="h-section mt-4">This page couldn&rsquo;t load.</h1>
        <p className="lead mt-4">Please try again. If it keeps happening, let your Azentio contact know{error.digest ? ` and quote reference ${error.digest}` : ""}.</p>
        <div className="mt-8 flex justify-center gap-3">
          <button onClick={reset} className="rounded-[5px] bg-green px-[23px] py-[15px] text-sm font-bold text-on-green">Try again</button>
          <Link href="/" className="rounded-[5px] border border-line-strong px-[23px] py-[15px] text-sm font-bold">Back to home</Link>
        </div>
      </div>
    </Section>
  );
}
