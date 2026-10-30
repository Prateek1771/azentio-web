import Link from "next/link";
import { activeWorkspace, clientOrgs, getSession, isEmployee, isStaff } from "@/lib/authz";
import { type MenuData, UserMenu } from "./user-menu";

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
  return <UserMenu data={{ email: s.user.email, active: active?.name, links }} />;
}
