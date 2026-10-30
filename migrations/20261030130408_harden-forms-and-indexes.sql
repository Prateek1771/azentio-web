-- Phase 1 · advisor follow-ups.

-- Public forms: no direct API writes. The Next.js server action validates, rate-limits and checks the
-- honeypot, then inserts with the admin client — so spam can't bypass those controls via PostgREST.
drop policy demo_insert on public.demo_requests;
drop policy events_insert on public.event_registrations;
revoke insert on public.demo_requests, public.event_registrations from anon, authenticated;

-- Foreign-key indexes
create index if not exists invitations_used_by_idx on public.invitations (used_by);
create index if not exists invitations_invited_by_idx on public.invitations (invited_by);
create index if not exists invitations_expires_idx on public.invitations (expires_at);
create index if not exists aira_interactions_org_idx on public.aira_interactions (org_id);
create index if not exists grants_granted_by_idx on public.grants (granted_by);
create index if not exists live_sessions_org_idx on public.live_sessions (org_id);
create index if not exists live_sessions_offering_idx on public.live_sessions (offering_id);
create index if not exists live_sessions_recording_idx on public.live_sessions (recording_media_id);
create index if not exists provisioned_access_claimed_by_idx on public.provisioned_access (claimed_by);
create index if not exists provisioned_access_org_idx on public.provisioned_access (org_id);
create index if not exists content_owner_idx on public.content (owner_id);
create index if not exists guardrail_events_user_idx on public.guardrail_events (user_id);
create index if not exists guardrail_events_interaction_idx on public.guardrail_events (interaction_id);
create index if not exists employee_allowlist_approved_by_idx on public.employee_allowlist (approved_by);
create index if not exists media_offering_idx on public.media (offering_id);
create index if not exists media_org_idx on public.media (org_id);
create index if not exists terms_acceptance_org_idx on public.terms_acceptance (org_id);
create index if not exists memberships_user_role_idx on public.memberships (user_id, role, status);
create index if not exists offerings_public_idx on public.offerings (is_public);
