"use client";

import Image from "next/image";
import { useEffect, useState, useSyncExternalStore } from "react";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { CtaLink, Eyebrow } from "@/components/portal/primitives";

type Slide = { eyebrow: string; title: string; accent: string; lead: string; cta: { label: string; href: string }; image: string };

const INTERVAL_MS = 7000;
const REDUCED = "(prefers-reduced-motion: reduce)";
const subscribe = (cb: () => void) => {
  const mq = window.matchMedia(REDUCED);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};

export function HeroCarousel({ slides }: { slides: Slide[] }) {
  const [index, setIndex] = useState(0);
  const [userPaused, setPaused] = useState<boolean | null>(null);
  // Respect reduced motion: never auto-advance unless the user explicitly presses play.
  const reduced = useSyncExternalStore(subscribe, () => window.matchMedia(REDUCED).matches, () => false);
  const paused = userPaused ?? reduced;
  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % slides.length), INTERVAL_MS);
    return () => clearInterval(t);
  }, [paused, slides.length]);

  const go = (i: number) => setIndex((i + slides.length) % slides.length);
  const ctrl = "grid size-10 place-items-center rounded-full border border-white/30 text-white transition hover:border-green hover:text-green";

  return (
    <section aria-roledescription="carousel" aria-label="azentio.ai highlights" className="on-dark relative flex min-h-[680px] items-center overflow-hidden bg-navy text-white max-md:min-h-[600px]">
      {slides.map((s, i) => (
        <div
          key={s.title}
          role="group"
          aria-roledescription="slide"
          aria-label={`${i + 1} of ${slides.length}`}
          aria-hidden={i !== index}
          className={cn("absolute inset-0 transition-opacity duration-700", i === index ? "opacity-100" : "pointer-events-none opacity-0")}
        >
          <Image src={s.image} alt="" fill priority={i === 0} className="object-cover" />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,#171b3af2,#171b3abb_35%,#171b3a30_75%)] max-md:bg-[linear-gradient(90deg,#171b3ae6,#171b3a99)]" aria-hidden />
          <div className="container-x relative flex h-full items-center py-24">
            <div className="max-w-[900px]">
              <Eyebrow>{s.eyebrow}</Eyebrow>
              {i === 0 ? (
                <h1 className="h-hero my-6">
                  {s.title} <em>{s.accent}</em>
                </h1>
              ) : (
                <p className="h-hero my-6">
                  {s.title} <em>{s.accent}</em>
                </p>
              )}
              <p className="lead max-w-[580px]">{s.lead}</p>
              <div className="mt-10">
                <CtaLink href={s.cta.href}>{s.cta.label}</CtaLink>
              </div>
            </div>
          </div>
        </div>
      ))}

      <div className="container-x absolute inset-x-0 bottom-8 flex items-center gap-3">
        <button type="button" className={ctrl} aria-label="Previous banner" onClick={() => go(index - 1)}>
          <ChevronLeft className="size-5" aria-hidden />
        </button>
        <div className="mx-2 flex gap-2.5">
          {slides.map((s, i) => (
            <button
              key={s.title}
              type="button"
              aria-label={`Show banner ${i + 1}: ${s.title} ${s.accent}`}
              aria-current={i === index ? "true" : undefined}
              onClick={() => go(i)}
              className={cn("h-2.5 rounded-full transition-all", i === index ? "w-7 bg-green" : "w-2.5 bg-white/40 hover:bg-white/70")}
            />
          ))}
        </div>
        <button type="button" className={ctrl} aria-label="Next banner" onClick={() => go(index + 1)}>
          <ChevronRight className="size-5" aria-hidden />
        </button>
        <button type="button" className={ctrl} aria-label={paused ? "Play carousel" : "Pause carousel"} aria-pressed={paused} onClick={() => setPaused(!paused)}>
          {paused ? <Play className="size-4" aria-hidden /> : <Pause className="size-4" aria-hidden />}
        </button>
      </div>
    </section>
  );
}
