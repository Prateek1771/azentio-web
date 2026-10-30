"use client";

import { useState } from "react";
import { ArrowUpRight, Check } from "lucide-react";
import { cn } from "@/lib/utils";

type Capability = { title: string; subtitle: string; back: string; points: string[] };

// Flip card from the prototype. A real toggle button (keyboard + tap); hover also previews on
// pointer devices. Reduced motion swaps the 3D rotation for a cross-fade.
export function CapabilityCard({ c }: { c: Capability }) {
  const [flipped, setFlipped] = useState(false);
  const face = "absolute inset-0 flex flex-col gap-4 rounded-xl border p-7 [backface-visibility:hidden] motion-reduce:[backface-visibility:visible] motion-reduce:transition-opacity";

  return (
    <button
      type="button"
      aria-pressed={flipped}
      aria-label={`${c.title}: ${c.subtitle} ${flipped ? "Showing details" : "Activate to preview"}`}
      onClick={() => setFlipped((f) => !f)}
      className="group h-[280px] w-full text-left [perspective:1200px]"
    >
      <span
        className={cn(
          "relative block h-full transition-transform duration-[550ms] [transform-style:preserve-3d] motion-reduce:transform-none",
          flipped ? "[transform:rotateY(180deg)]" : "[@media(hover:hover)]:group-hover:[transform:rotateY(180deg)]",
        )}
      >
        <span className={cn(face, "justify-center border-[#dfe4ea] bg-white", flipped && "motion-reduce:opacity-0")}>
          <strong className="text-xl">{c.title}</strong>
          <span className="text-sm leading-[1.6] text-slate">{c.subtitle}</span>
          <small className="inline-flex items-center gap-1.5 text-xs font-bold text-green-700">
            Hover or tap to explore <ArrowUpRight className="size-3.5" aria-hidden />
          </small>
        </span>
        <span
          className={cn(
            face,
            "on-dark border-green bg-navy text-white [transform:rotateY(180deg)] motion-reduce:transform-none",
            !flipped && "motion-reduce:opacity-0",
          )}
        >
          <span className="eyebrow">{c.title}</span>
          <strong className="text-lg leading-tight">{c.back}</strong>
          <ul className="grid gap-2 text-[13px] text-on-dark-muted">
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
