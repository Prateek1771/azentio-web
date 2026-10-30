import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      aria-label="azentio.ai home"
      className={cn("text-[25px] font-extrabold tracking-[-1.5px] whitespace-nowrap max-[1250px]:text-[23px]", className)}
    >
      <span className="text-green">a</span>zent<span className="text-green">i</span>o<span className="text-green">.ai</span>
    </Link>
  );
}

const ctaVariants = {
  primary: "border-green bg-green text-on-green hover:bg-green",
  outline: "border-white/40 bg-transparent text-white hover:border-green hover:text-green",
  ink: "border-navy bg-navy text-white hover:bg-navy-800",
} as const;

export function CtaLink({
  href,
  children,
  variant = "primary",
  icon = true,
  className,
}: {
  href: string;
  children: React.ReactNode;
  variant?: keyof typeof ctaVariants;
  icon?: boolean;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center justify-center gap-3 rounded-[5px] border px-[23px] py-[15px] text-sm font-bold transition-transform duration-200 hover:-translate-y-0.5",
        ctaVariants[variant],
        className,
      )}
    >
      {children}
      {icon && <ArrowUpRight aria-hidden className="size-4" />}
    </Link>
  );
}

export function TextLink({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) {
  return (
    <Link href={href} className={cn("inline-flex items-center gap-2 text-[13px] font-extrabold text-green-700 hover:underline", className)}>
      {children}
      <ArrowUpRight aria-hidden className="size-3.5" />
    </Link>
  );
}

export function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn("eyebrow", className)}>{children}</p>;
}

export function Section({
  children,
  muted,
  className,
  id,
}: {
  children: React.ReactNode;
  muted?: boolean;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={cn("py-[100px] max-md:py-[70px]", muted && "bg-light", className)}>
      <div className="container-x">{children}</div>
    </section>
  );
}

export function SectionHead({
  eyebrow,
  title,
  intro,
  action,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  intro?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-9 flex items-end justify-between gap-8 max-[959px]:flex-col max-[959px]:items-start">
      <div className="max-w-[720px]">
        {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
        <h2 className="h-section mt-3.5 mb-4">{title}</h2>
        {intro && <p className="lead">{intro}</p>}
      </div>
      {action}
    </div>
  );
}

export function PageHero({
  eyebrow,
  title,
  lead,
  children,
}: {
  eyebrow: string;
  title: React.ReactNode;
  lead?: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="on-dark bg-page-hero relative overflow-hidden pt-[110px] pb-[115px] text-white">
      <div className="glow-blob" aria-hidden />
      <div className="container-x relative">
        <Eyebrow>{eyebrow}</Eyebrow>
        <h1 className="h-page my-6 max-w-[850px]">{title}</h1>
        {lead && <p className="lead max-w-[620px]">{lead}</p>}
        {children && <div className="mt-8 flex flex-wrap gap-3">{children}</div>}
      </div>
    </section>
  );
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="rounded-[10px] border border-dashed border-line-strong bg-light px-8 py-12 text-center">
      <p className="text-[19px] font-bold">{title}</p>
      <p className="mx-auto mt-2 max-w-[460px] text-sm leading-[1.65] text-slate">{body}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
