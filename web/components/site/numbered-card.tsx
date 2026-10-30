import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

export const pad = (n: number) => String(n).padStart(2, "0");

export function NumberedCard({ n, title, body, href, dark }: { n: number; title: string; body?: string; href?: string; dark?: boolean }) {
  const cls = cn(
    "flex min-h-[200px] flex-col rounded-[10px] border p-[31px]",
    dark ? "on-dark border-white/10 bg-white/5 text-white" : "border-[#e2e8ed] bg-white",
    href && "lift",
  );
  const inner = (
    <>
      <span className={cn("text-xs font-extrabold tracking-[2px]", dark ? "text-green" : "text-green-700")}>{pad(n)}</span>
      <h3 className="mt-4 text-[19px] leading-snug font-bold">{title}</h3>
      {body && <p className={cn("mt-3 flex-1 text-sm leading-[1.65]", dark ? "text-on-dark-muted" : "text-slate")}>{body}</p>}
      {href && (
        <span className="mt-5 inline-flex items-center gap-1.5 text-[13px] font-extrabold text-green-700">
          Explore <ArrowUpRight className="size-3.5" aria-hidden />
        </span>
      )}
    </>
  );
  return href ? (
    <Link href={href} className={cls}>
      {inner}
    </Link>
  ) : (
    <div className={cls}>{inner}</div>
  );
}
