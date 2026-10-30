"use client";

import { useState } from "react";
import { ArrowUpRight, Check } from "lucide-react";
import { cn } from "@/lib/utils";

type Capability = { title: string; subtitle: string; back: string; points: string[] };

// Flip card from the prototype. A real toggle button (keyboard + tap); hover also previews on
// pointer devices. Reduced motion swaps the 3D rotation for a cross-fade.
// Touch devices (no hover) skip the flip and stack both faces: mobile browsers render 3D inside a
// button unreliably (iOS showed only the front), and details shouldn't hide behind a tap anyway.
export function CapabilityCard({ c }: { c: Capability }) {
  const [flipped, setFlipped] = useState(false);
  const face =
    "absolute inset-0 flex flex-col gap-4 rounded-xl border p-7 [backface-visibility:hidden] motion-reduce:[backface-visibility:visible] motion-reduce:transition-opacity [@media(hover:none)]:static [@media(hover:none)]:![transform:none] [@media(hover:none)]:!opacity-100";

  return (
    <button
      type="button"
      aria-pressed={flipped}
      aria-label={`${c.title}: ${c.subtitle} ${flipped ? "Showing details" : "Activate to preview"}`}
      onClick={() => setFlipped((f) => !f)}
      className="group h-[280px] w-full text-left [perspective:1200px] [@media(hover:none)]:h-auto"
    >
      <span
        className={cn(
          "relative block h-full transition-transform duration-[550ms] [transform-style:preserve-3d] motion-reduce:transform-none [@media(hover:none)]:![transform:none] [@media(hover:none)]:[transform-style:flat]",
          flipped ? "[transform:rotateY(180deg)]" : "[@media(hover:hover)]:group-hover:[transform:rotateY(180deg)]",
        )}
      >
        <span className={cn(face, "justify-center border-[#dfe4ea] bg-white [@media(hover:none)]:rounded-b-none [@media(hover:none)]:border-b-0", flipped && "motion-reduce:opacity-0")}>
          <strong className="text-xl">{c.title}</strong>
          <span className="text-sm leading-[1.6] text-slate">{c.subtitle}</span>
          <small className="inline-flex items-center gap-1.5 text-xs font-bold text-green-700 [@media(hover:none)]:hidden">
            Hover or tap to explore <ArrowUpRight className="size-3.5" aria-hidden />
          </small>
        </span>
        <span
          className={cn(
            face,
            "on-dark border-green bg-navy text-white [transform:rotateY(180deg)] motion-reduce:transform-none [@media(hover:none)]:rounded-t-none",
            !flipped && "motion-reduce:opacity-0",
          )}
        >
          <span className="eyebrow [@media(hover:none)]:hidden">{c.title}</span>
          <strong className="text-lg leading-tight">{c.back}</strong>
          <ul className="grid grid-cols-1 gap-2 text-[13px] text-on-dark-muted">
            {c.points.map((p) => (
              <li key={p} className="flex gap-2">
                <Check className="mt-0.5 size-3.5 shrink-0 text-green" aria-hidden />
                {p}
              </li>
            ))}
          </ul>
        </span>
      </span>
    </button>
  );
}
