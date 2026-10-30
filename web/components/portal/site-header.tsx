"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, Menu } from "lucide-react";
import { navGroups } from "@/lib/content";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { CtaLink, Logo } from "./primitives";

const linkCls = "text-sm font-bold text-white/90 transition-colors hover:text-green";

// `account` is a server-rendered slot (SessionNav) so the header knows who is signed in.
export function SiteHeader({ account }: { account?: React.ReactNode }) {
  const [open, setOpen] = useState<string | null>(null);
  const [drawer, setDrawer] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  // close menus when a link inside them is followed
  const closeOnLink = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("a")) {
      setOpen(null);
      setDrawer(false);
    }
  };

  // close the mega menu on outside click and Escape
  useEffect(() => {
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(null);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <header className="on-dark sticky top-0 z-30 border-b border-white/10 bg-navy text-white">
      <div ref={ref} onClick={closeOnLink} className="container-x relative flex h-[84px] items-center gap-10 max-[1250px]:h-[76px] max-[950px]:h-[66px]">
        <Logo />

        <nav aria-label="Main navigation" className="hidden flex-1 min-[960px]:block">
          <ul className="flex items-center gap-8 max-[1100px]:gap-5">
            <li>
              <Link href="/products" className={linkCls}>
                Products
              </Link>
            </li>
            {navGroups.map((g) => {
              const id = `mega-${g.label.toLowerCase()}`;
              const expanded = open === g.label;
              return (
                <li key={g.label}>
                  <button
                    type="button"
                    className={cn(linkCls, "inline-flex items-center gap-1.5")}
                    aria-expanded={expanded}
                    aria-controls={id}
                    onClick={() => setOpen(expanded ? null : g.label)}
                  >
                    {g.label}
                    <ChevronDown aria-hidden className={cn("size-4 transition-transform", expanded && "rotate-180")} />
                  </button>
                  <div
                    id={id}
                    hidden={!expanded}
                    className="absolute inset-x-0 top-full grid grid-cols-[240px_1fr] gap-8 rounded-b-[14px] border border-t-[3px] border-[#dde3ed] border-t-green bg-white p-8 text-navy shadow-menu"
                  >
                    <div>
                      <p className="eyebrow">{g.label}</p>
                      <p className="mt-3 text-sm leading-[1.6] text-slate">{g.intro}</p>
                    </div>
                    <ul className="grid grid-cols-2 gap-2">
                      {g.links.map((l) => (
                        <li key={l.href}>
                          <Link href={l.href} className="block rounded-lg p-3 transition-colors hover:bg-light">
                            <span className="text-[15px] font-bold">{l.label}</span>
                            <span className="mt-1 block text-[13px] leading-snug text-slate">{l.description}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="ml-auto flex items-center gap-4">
          <div className="max-[959px]:hidden">{account}</div>
          <CtaLink href="/connect?interest=demo" icon={false} className="py-3 max-[1250px]:hidden">
            Request Demo
          </CtaLink>

          <Sheet open={drawer} onOpenChange={setDrawer}>
            <SheetTrigger
              aria-label="Open navigation"
              className="grid size-10 place-items-center rounded-md text-white min-[960px]:hidden"
            >
              <Menu aria-hidden className="size-6" />
            </SheetTrigger>
            <SheetContent side="right" onClick={closeOnLink} className="on-dark w-[88vw] border-white/10 bg-navy p-6 text-white">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <Logo className="text-[23px]" />
              <nav aria-label="Mobile navigation" className="mt-6 flex flex-col gap-6 overflow-y-auto">
                <Link href="/products" className="text-lg font-bold">
                  Products
                </Link>
                {navGroups.map((g) => (
                  <div key={g.label}>
                    <p className="eyebrow">{g.label}</p>
                    <ul className="mt-3 flex flex-col gap-3">
                      {g.links.map((l) => (
                        <li key={l.href}>
                          <Link href={l.href} className="text-[15px] text-on-dark-muted hover:text-green">
                            {l.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
                <Link href="/account" className="text-lg font-bold">
                  My account
                </Link>
                <CtaLink href="/connect?interest=demo" icon={false}>
                  Request Demo
                </CtaLink>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
