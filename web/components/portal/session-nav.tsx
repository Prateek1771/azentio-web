import Link from "next/link";
import { activeWorkspace, clientOrgs, getSession, isEmployee, isStaff } from "@/lib/authz";
import { createInsForgeServerClient } from "@/lib/insforge/server";
import { type MenuData, UserMenu } from "./user-menu";
import { type BellItem, NotificationBell } from "./notification-bell";

export function SignInLink() {
  return (
    <Link href="/login" className="text-sm font-bold text-white/90 transition-colors hover:text-green">
      Sign in
    </Link>
  );
}

// Server-side session lookup for the header; links reflect real memberships and grants.
export async function SessionNav() {
  const s = await getSession();
  if (!s) return <SignInLink />;
  const active = await activeWorkspace(s);
  const links: MenuData["links"] = [
    ...(isStaff(s) ? [{ href: "/s", label: "Staff console", kind: "staff" as const }] : []),
    ...(isEmployee(s) ? [{ href: "/e", label: "Employee portal", kind: "employee" as const }] : []),
    ...clientOrgs(s).map((o) => ({ href: `/c/${o.slug}`, label: o.name, kind: "client" as const })),
  ];
  const insforge = await createInsForgeServerClient();
  const [{ data }, { count }] = await Promise.all([
    insforge.database.from("notifications").select("id, kind, payload, read_at").order("at", { ascending: false }).limit(8),
    insforge.database.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null),
  ]);
  const slugOf = new Map(s.memberships.map((m) => [m.org_id, m.slug]));
  const items: BellItem[] = ((data ?? []) as { id: string; kind: string; payload: { contribution_id?: string; org_id?: string; title?: string }; read_at: string | null }[]).map((n) => {
    const slug = n.payload.org_id && slugOf.get(n.payload.org_id);
    return {
      id: n.id,
      kind: n.kind,
      title: n.payload.title,
      unread: !n.read_at,
      href: slug && n.payload.contribution_id ? `/c/${slug}/observations/${n.payload.contribution_id}` : isStaff(s) ? "/s" : "/account",
    };
  });
  return (
    <div className="flex items-center gap-1">
      <NotificationBell userId={s.user.id} items={items} unread={count ?? 0} />
      <UserMenu data={{ email: s.user.email, active: active?.name, links }} />
    </div>
  );
}
