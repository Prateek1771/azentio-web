"use client";

import { useState } from "react";
import { X } from "lucide-react";

export function Dismiss({ id, children }: { id: string; children: React.ReactNode }) {
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;
  return (
    <div role="region" aria-label="Announcement" className="bg-green text-on-green" data-banner-id={id}>
      <div className="container-x flex items-center justify-between gap-4 py-2.5">
        {children}
        <button type="button" aria-label="Dismiss announcement" onClick={() => setHidden(true)} className="rounded p-1 hover:bg-black/10">
          <X className="size-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}
