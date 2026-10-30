"use client";

import Link from "next/link";
import { Building2, ChevronDown, LayoutDashboard, LogOut, ShieldCheck, User } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOut } from "@/app/login/actions";

export type MenuData = {
  email: string;
  active?: string;
  links: { href: string; label: string; kind: "employee" | "staff" | "client" }[];
};

const ICON = { employee: LayoutDashboard, staff: ShieldCheck, client: Building2 };

export function UserMenu({ data }: { data: MenuData }) {
  const initial = data.email.replace(/\+.*@/, "@")[0]?.toUpperCase() ?? "U";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Account menu"
        className="flex items-center gap-2 rounded-full py-1 pr-2 pl-1 text-sm font-bold text-white transition-colors hover:bg-white/10"
      >
        <span className="grid size-8 place-items-center rounded-full bg-green text-[13px] font-extrabold text-navy">{initial}</span>
        <span className="max-w-[160px] truncate max-[1100px]:hidden">{data.active ?? "Account"}</span>
        <ChevronDown className="size-4" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72 p-2">
        <div className="px-2 py-2">
          <p className="text-[11px] font-extrabold tracking-[2px] text-green-700 uppercase">Signed in</p>
          <p className="truncate text-sm font-bold text-ink">{data.email}</p>
        </div>
        <DropdownMenuSeparator />
        {data.links.map((l) => {
          const Icon = ICON[l.kind];
          return (
            <DropdownMenuItem key={l.href} render={<Link href={l.href} />} className="gap-2.5 px-2 py-2">
              <Icon className="size-4 text-green-700" aria-hidden />
              <span className="truncate">{l.label}</span>
              {l.label === data.active && <span className="ml-auto text-[10px] font-bold text-green-700 uppercase">Active</span>}
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuItem render={<Link href="/account" />} className="gap-2.5 px-2 py-2">
          <User className="size-4 text-slate" aria-hidden />
          Account
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <form action={signOut}>
          <button className="flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-sm hover:bg-light">
            <LogOut className="size-4 text-slate" aria-hidden />
            Sign out
          </button>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
