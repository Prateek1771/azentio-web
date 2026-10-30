"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const LINKS = [
  ["/learning", "Shared feed"],
  ["/learning/themes", "Themes"],
  ["/learning/ideas", "Improvement ideas"],
  ["/learning/saved", "Saved"],
] as const;

export function LearningNav() {
  const path = usePathname();
  return (
    <nav aria-label="Community learning" className="flex flex-wrap gap-2">
      {LINKS.map(([href, label]) => (
        <Link
          key={href}
          href={href}
          aria-current={path === href ? "page" : undefined}
          className={cn("rounded-full border px-3.5 py-1.5 text-xs font-bold", path === href ? "border-navy bg-navy text-white" : "border-line-strong hover:border-green-700")}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
