import { createInsForgeServerClient } from "@/lib/insforge/server";
import type { Consents, Contribution } from "@/lib/contributions/model";

export async function entitledOfferings(orgId: string) {
  const insforge = await createInsForgeServerClient();
  const { data } = await insforge.database.from("entitlements").select("offerings(id, name)").eq("org_id", orgId);
  return ((data ?? []) as unknown as { offerings: { id: string; name: string } }[]).map((r) => r.offerings);
}

// Read through RLS: a row you can't see is simply not found.
export async function loadContribution(id: string, orgId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const insforge = await createInsForgeServerClient();
  const db = insforge.database;
  const [{ data: c }, { data: consents }, { data: versions }, { data: events }, { data: attachments }] = await Promise.all([
    db.from("contributions").select("*, offerings(name)").eq("id", id).eq("org_id", orgId).maybeSingle(),
    db.from("consents").select("store, publish, attribute, train, at").eq("contribution_id", id).order("id", { ascending: false }),
    db.from("contribution_versions").select("version, snapshot, created_at").eq("contribution_id", id).order("version", { ascending: false }),
    db.from("moderation_events").select("action, from_state, to_state, version, reason, at").eq("contribution_id", id).order("id", { ascending: false }),
    db.from("contribution_attachments").select("id, name, size").eq("contribution_id", id).order("at"),
  ]);
  if (!c) return null;
  return {
    c: c as Contribution & { offerings: { name: string } | null },
    consents: (consents ?? []) as (Consents & { at: string })[],
    versions: (versions ?? []) as { version: number; snapshot: Contribution; created_at: string }[],
    attachments: (attachments ?? []) as { id: string; name: string; size: number }[],
    events: (events ?? []) as { action: string; from_state: string; to_state: string; version: number; reason: string | null; at: string }[],
  };
}
