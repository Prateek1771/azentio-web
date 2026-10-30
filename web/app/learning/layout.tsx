import Link from "next/link";
import { Suspense } from "react";
import { LearningNav } from "./nav";

export default function LearningLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="border-b border-line bg-white">
        <div className="container-x flex flex-wrap items-center gap-2 py-3">
          <Link href="/learning" className="mr-3 text-sm font-extrabold text-ink">Community learning</Link>
          {/* usePathname is request-time; keep it out of the static shell */}
          <Suspense fallback={null}>
            <LearningNav />
          </Suspense>
        </div>
      </div>
      {children}
    </>
  );
}
