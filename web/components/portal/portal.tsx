import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Eyebrow } from "./primitives";

// Compact dark band at the top of every signed-in page.
export function PortalBand({
  eyebrow,
  title,
  lead,
  children,
}: {
  eyebrow: string;
  title: React.ReactNode;
  lead?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <section className="on-dark bg-page-hero relative overflow-hidden py-14 text-white">
      <div className="glow-blob" aria-hidden />
      <div className="container-x relative flex flex-wrap items-end justify-between gap-6">
        <div className="max-w-[760px]">
          <Eyebrow>{eyebrow}</Eyebrow>
          <h1 className="mt-3 text-[clamp(32px,4vw,48px)] leading-[1.1] font-bold tracking-[-1.5px]">{title}</h1>
          {lead && <p className="lead mt-3">{lead}</p>}
        </div>
        {children && <div className="flex flex-wrap gap-3">{children}</div>}
      </div>
    </section>
  );
}

export function Tile({
  title,
  body,
  href,
  badge,
  className,
}: {
  title: string;
  body: string;
  href?: string;
  badge?: string;
  className?: string;
}) {
  const inner = (
    <>
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-[17px] font-bold">{title}</h3>
        {href ? (
          <ArrowUpRight className="size-4 text-green-700" aria-hidden />
        ) : (
          badge && <span className="rounded-full bg-light px-2.5 py-1 text-[11px] font-bold text-slate">{badge}</span>
        )}
      </div>
      <p className="mt-2 text-sm leading-[1.65] text-slate">{body}</p>
    </>
  );
  const cls = cn("block rounded-[10px] border border-line bg-white p-6", href && "lift", className);
  return href ? (
    <Link href={href} className={cls}>
      {inner}
    </Link>
  ) : (
    <div className={cls}>{inner}</div>
  );
}

export function Panel({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  // min-w-0: panels sit in grid tracks; without it a truncated (nowrap) child widens the track.
  return (
    <div className="min-w-0 rounded-[10px] border border-line bg-white p-7">
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="text-[19px] font-bold">{title}</h2>
        {action}
      </div>
      {children}
    </div>
  );
}

export const roleLabel = (r: string) => r.replace(/_/g, " ").replace(/^client /, "");
