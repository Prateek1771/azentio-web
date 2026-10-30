"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { insforge } from "@/lib/insforge/client";
import { markNotificationsRead } from "@/lib/contributions/actions";
import { NOTIFY } from "@/lib/contributions/model";

export type BellItem = { id: string; kind: string; title?: string; href: string; unread: boolean };

export function NotificationBell({ userId, items, unread }: { userId: string; items: BellItem[]; unread: number }) {
  const router = useRouter();

  // Server-pushed events re-render the server list; RLS on realtime.channels allows only our own channel.
  useEffect(() => {
    const rt = insforge.realtime;
    const channel = `notify:${userId}`;
    const refresh = () => router.refresh();
    rt.connect()
      .then(() => rt.subscribe(channel))
      .then(() => rt.on("notification", refresh))
      .catch(() => {}); // the list still loads on navigation without realtime
    return () => {
      rt.off("notification", refresh);
      rt.unsubscribe(channel);
    };
  }, [userId, router]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
        className="relative grid size-9 place-items-center rounded-full text-white transition-colors hover:bg-white/10"
      >
        <Bell className="size-[18px]" aria-hidden />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 grid min-w-[18px] place-items-center rounded-full bg-green px-1 text-[10px] font-extrabold text-navy">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-2">
        <div className="flex items-center justify-between px-2 py-2">
          <p className="text-[11px] font-extrabold tracking-[2px] text-green-700 uppercase">Notifications</p>
          {unread > 0 && (
            <form action={markNotificationsRead}>
              <button className="text-xs font-bold text-slate hover:text-ink">Mark all read</button>
            </form>
          )}
        </div>
        <DropdownMenuSeparator />
        {items.length ? (
          items.map((n) => (
            <DropdownMenuItem key={n.id} render={<Link href={n.href} />} className="grid gap-0.5 px-2 py-2">
              <span className="flex items-center gap-2 text-sm font-bold">
                {n.unread && <span className="size-2 rounded-full bg-green-700" aria-label="Unread" />}
                {NOTIFY[n.kind] ?? n.kind}
              </span>
              {n.title && <span className="truncate text-xs text-slate">{n.title}</span>}
            </DropdownMenuItem>
          ))
        ) : (
          <p className="px-2 py-6 text-center text-sm text-slate">You&rsquo;re all caught up.</p>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
