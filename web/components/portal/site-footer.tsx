import Link from "next/link";
import { footerColumns } from "@/lib/content";
import { Logo } from "./primitives";

export function SiteFooter() {
  return (
    <footer className="on-dark bg-navy-900 pt-[65px] pb-[25px] text-white">
      <div className="container-x">
        <div className="grid grid-cols-[1.4fr_repeat(4,1fr)] gap-10 max-[959px]:grid-cols-2">
          <div className="max-[959px]:col-span-2">
            <Logo />
            <p className="mt-4 max-w-[260px] text-sm leading-[1.6] text-on-dark-subtle">Build Intelligence. Create Impact.</p>
          </div>
          {footerColumns.map((c) => (
            <div key={c.title}>
              <p className="eyebrow">{c.title}</p>
              <ul>
                {c.links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="mt-[15px] block text-[13px] text-on-dark-subtle hover:text-green">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-14 flex flex-wrap justify-between gap-4 border-t border-white/10 pt-6 text-xs text-on-dark-subtle">
          <p>© 2026 azentio.ai · Product information is indicative and subject to validation.</p>
          <p className="flex gap-4">
            <Link href="/about#privacy" className="hover:text-green">Privacy</Link>
            <Link href="/about#terms" className="hover:text-green">Terms</Link>
            <Link href="/about#accessibility" className="hover:text-green">Accessibility</Link>
          </p>
        </div>
      </div>
    </footer>
  );
}
