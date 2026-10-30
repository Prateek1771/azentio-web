import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { forbidden, notFound, redirect } from "next/navigation";
import { createInsForgeServerClient } from "@/lib/insforge/server";

// UI guards mirror RLS for nice redirects/403s. RLS remains the enforcement layer.

export const TERMS_VERSION = "2026-10";
export const WORKSPACE_COOKIE = "az_ws";

export type GrantKind = "publish_media" | "moderate" | "invite" | "manage_roles" | "product_owner" | "portal_admin";
export type Membership = {
  org_id: string;
  slug: string;
  name: string;
  kind: "azentio" | "client";
  role: "employee" | "client_member" | "client_admin";
};
export type Session = { user: { id: string; email: string }; memberships: Membership[]; grants: GrantKind[] };

export const getSession = cache(async (): Promise<Session | null> => {
  const insforge = await createInsForgeServerClient();
  const { data } = await insforge.auth.getCurrentUser();
  if (!data?.user) return null;
  const [m, g] = await Promise.all([
    insforge.database
      .from("memberships")
      .select("org_id, role, orgs(slug, name, kind)")
      .eq("user_id", data.user.id)
      .eq("status", "active"),
    insforge.database.from("grants").select("kind").eq("user_id", data.user.id),
  ]);
  type Row = { org_id: string; role: Membership["role"]; orgs: { slug: string; name: string; kind: Membership["kind"] } };
  return {
    user: { id: data.user.id, email: data.user.email },
    memberships: ((m.data ?? []) as unknown as Row[])
      .map((r) => ({ org_id: r.org_id, role: r.role, ...r.orgs }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    grants: ((g.data ?? []) as { kind: GrantKind }[]).map((r) => r.kind),
  };
});

export const isEmployee = (s: Session) => s.memberships.some((m) => m.kind === "azentio" && m.role === "employee");
export const clientOrgs = (s: Session) => s.memberships.filter((m) => m.kind === "client");
export const isStaff = (s: Session) =>
  isEmployee(s) && s.grants.some((g) => ["portal_admin", "moderate", "publish_media", "product_owner"].includes(g));

export async function requireUser(next?: string): Promise<Session> {
  const s = await getSession();
  if (!s) redirect(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
  return s;
}

export async function requireEmployee(): Promise<Session> {
  const s = await requireUser("/e");
  if (!isEmployee(s)) forbidden();
  return s;
}

export async function requireGrant(...kinds: GrantKind[]): Promise<Session> {
  const s = await requireUser("/s");
  if (!isEmployee(s) || !kinds.some((k) => s.grants.includes(k))) forbidden();
  return s;
}

// 404 (not 403) for orgs you don't belong to: never confirm another tenant exists.
export async function requireOrg(slug: string): Promise<{ session: Session; org: Membership }> {
  const session = await requireUser(`/c/${slug}`);
  const org = clientOrgs(session).find((m) => m.slug === slug);
  if (!org) notFound();
  const insforge = await createInsForgeServerClient();
  const { data } = await insforge.database
    .from("terms_acceptance")
    .select("version")
    .eq("org_id", org.org_id)
    .eq("version", TERMS_VERSION)
    .limit(1);
  if (!data?.length) redirect(`/onboarding/terms?org=${encodeURIComponent(slug)}`);
  return { session, org };
}

// The cookie is a preference only; it is re-validated against live memberships every time.
export async function activeWorkspace(s: Session): Promise<Membership | null> {
  const slug = (await cookies()).get(WORKSPACE_COOKIE)?.value;
  const orgs = clientOrgs(s);
  return orgs.find((m) => m.slug === slug) ?? (orgs.length === 1 ? orgs[0] : null);
}

export function landingFor(s: Session): string {
  if (isStaff(s) && s.grants.some((g) => g !== "product_owner")) return "/s";
  if (isEmployee(s)) return "/e";
  const orgs = clientOrgs(s);
  if (orgs.length === 1) return `/c/${orgs[0].slug}`;
  if (orgs.length > 1) return "/workspace";
  return "/account";
}

// Only same-site relative paths; blocks "//evil.com" and "/\\evil.com".
export function safeNext(next: unknown): string | null {
  return typeof next === "string" && /^\/(?![/\\])/.test(next) ? next : null;
}
