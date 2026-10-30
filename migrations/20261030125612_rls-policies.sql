-- Phase 1 · RLS policies. Deny by default: revoke InsForge's broad runtime DML, grant back exact
-- operations, then express each operation as a positive capability. Policies OR together, so each
-- table gets one policy per operation.

do $$
declare t text;
begin
  foreach t in array array[
    'orgs','profiles','memberships','grants','employee_allowlist','provisioned_access','invitations',
    'terms_acceptance','offerings','entitlements','content','media','live_sessions','demo_requests',
    'event_registrations','audit_log','guardrail_rules','aira_interactions','guardrail_events'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;

grant usage on schema public to anon, authenticated;

-- ── orgs: members see their own org; portal admins see/manage all ───────
grant select, insert, update, delete on public.orgs to authenticated;
create policy orgs_select on public.orgs for select to authenticated
  using (public.is_member(id) or public.has_grant('portal_admin'));
create policy orgs_insert on public.orgs for insert to authenticated
  with check (public.has_grant('portal_admin'));
create policy orgs_update on public.orgs for update to authenticated
  using (public.has_grant('portal_admin')) with check (public.has_grant('portal_admin'));
create policy orgs_delete on public.orgs for delete to authenticated
  using (public.has_grant('portal_admin'));

-- ── profiles: own row only ──────────────────────────────────────────────
grant select on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;
create policy profiles_select on public.profiles for select to authenticated
  using (user_id = (select auth.uid()) or public.has_grant('portal_admin'));
create policy profiles_update on public.profiles for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ── memberships: own rows; client admins manage their org's client roles ─
grant select, insert, delete on public.memberships to authenticated;
grant update (role, status) on public.memberships to authenticated;
create policy memberships_select on public.memberships for select to authenticated
  using (user_id = (select auth.uid()) or public.is_org_admin(org_id) or public.has_grant('portal_admin'));
create policy memberships_insert on public.memberships for insert to authenticated
  with check (public.has_grant('portal_admin'));   -- clients join via invitation RPC (Phase 2)
create policy memberships_update on public.memberships for update to authenticated
  using (public.has_grant('portal_admin') or public.is_org_admin(org_id))
  with check (
    public.has_grant('portal_admin')
    or (public.is_org_admin(org_id) and role in ('client_member', 'client_admin'))
  );
create policy memberships_delete on public.memberships for delete to authenticated
  using (public.has_grant('portal_admin') or (public.is_org_admin(org_id) and role <> 'employee'));

-- Structural guard (independent of who writes): roles must match the org kind; tenancy is immutable.
create or replace function public.guard_membership()
returns trigger language plpgsql
set search_path = pg_catalog, public, pg_temp as $$
declare v_kind public.org_kind;
begin
  if tg_op = 'UPDATE' and (new.user_id is distinct from old.user_id or new.org_id is distinct from old.org_id) then
    raise exception 'membership user_id/org_id are immutable';
  end if;
  select kind into v_kind from public.orgs where id = new.org_id;
  if v_kind = 'azentio' and new.role <> 'employee' then
    raise exception 'Azentio memberships must have role employee';
  end if;
  if v_kind = 'client' and new.role = 'employee' then
    raise exception 'client organisations cannot hold the employee role';
  end if;
  return new;
end $$;
create trigger memberships_guard before insert or update on public.memberships
  for each row execute function public.guard_membership();

-- ── grants: read own; only portal admins with manage_roles write ────────
grant select, insert, delete on public.grants to authenticated;
create policy grants_select on public.grants for select to authenticated
  using (user_id = (select auth.uid()) or public.has_grant('portal_admin'));
create policy grants_insert on public.grants for insert to authenticated
  with check (public.has_grant('portal_admin') and public.has_grant('manage_roles'));
create policy grants_delete on public.grants for delete to authenticated
  using (public.has_grant('portal_admin') and public.has_grant('manage_roles'));

-- Platform grants may only be held by Azentio employees.
create or replace function public.guard_grant()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
begin
  if not exists (
    select 1 from public.memberships m join public.orgs o on o.id = m.org_id
    where m.user_id = new.user_id and m.status = 'active' and m.role = 'employee' and o.kind = 'azentio'
  ) then
    raise exception 'grants can only be given to active Azentio employees';
  end if;
  new.granted_by := coalesce(new.granted_by, auth.uid());
  return new;
end $$;
create trigger grants_guard before insert on public.grants
  for each row execute function public.guard_grant();

-- ── provisioning tables: portal admins only ─────────────────────────────
grant select, insert, update, delete on public.employee_allowlist, public.provisioned_access to authenticated;
create policy allowlist_admin on public.employee_allowlist for all to authenticated
  using (public.has_grant('portal_admin')) with check (public.has_grant('portal_admin'));
create policy provisioned_admin on public.provisioned_access for all to authenticated
  using (public.has_grant('portal_admin')) with check (public.has_grant('portal_admin'));

-- ── invitations: client admins for their own org, client roles only ─────
grant select, insert on public.invitations to authenticated;
grant update (revoked_at) on public.invitations to authenticated;
create policy invitations_select on public.invitations for select to authenticated
  using (public.is_org_admin(org_id) or public.has_grant('portal_admin'));
create policy invitations_insert on public.invitations for insert to authenticated
  with check (
    (public.is_org_admin(org_id) or public.has_grant('portal_admin'))
    and invited_by = (select auth.uid())
    and expires_at <= now() + interval '14 days'
  );
create policy invitations_update on public.invitations for update to authenticated
  using (public.is_org_admin(org_id) or public.has_grant('portal_admin'))
  with check (public.is_org_admin(org_id) or public.has_grant('portal_admin'));

-- ── terms acceptance: own rows, own orgs ────────────────────────────────
grant select, insert on public.terms_acceptance to authenticated;
create policy terms_select on public.terms_acceptance for select to authenticated
  using (user_id = (select auth.uid()));
create policy terms_insert on public.terms_acceptance for insert to authenticated
  with check (user_id = (select auth.uid()) and public.is_member(org_id));

-- ── offerings & entitlements ────────────────────────────────────────────
grant select on public.offerings to anon, authenticated;
grant insert, update, delete on public.offerings to authenticated;
create policy offerings_select_public on public.offerings for select to anon
  using (is_public);
create policy offerings_select on public.offerings for select to authenticated
  using (is_public or public.is_employee() or public.entitled(id));
create policy offerings_write on public.offerings for insert to authenticated
  with check (public.has_grant('portal_admin'));
create policy offerings_update on public.offerings for update to authenticated
  using (public.has_grant('portal_admin')) with check (public.has_grant('portal_admin'));
create policy offerings_delete on public.offerings for delete to authenticated
  using (public.has_grant('portal_admin'));

grant select, insert, delete on public.entitlements to authenticated;
create policy entitlements_select on public.entitlements for select to authenticated
  using (public.is_member(org_id) or public.has_grant('portal_admin'));
create policy entitlements_insert on public.entitlements for insert to authenticated
  with check (public.has_grant('portal_admin'));     -- clients can never self-enable products
create policy entitlements_delete on public.entitlements for delete to authenticated
  using (public.has_grant('portal_admin'));

-- ── audience-scoped content, media, live sessions ──────────────────────
-- Public is explicit, never a fallback for missing metadata.
create or replace function public.audience_allows(p_audience public.audience, p_offering uuid, p_org uuid)
returns boolean language sql stable security definer
set search_path = pg_catalog, public, pg_temp as $$
  select case p_audience
    when 'public' then true
    when 'employee' then public.is_employee()
    when 'client_entitled' then public.is_employee() or public.entitled(p_offering)
    when 'org_private' then public.is_member(p_org)
  end;
$$;
revoke all on function public.audience_allows(public.audience, uuid, uuid) from public;
grant execute on function public.audience_allows(public.audience, uuid, uuid) to anon, authenticated;

grant select on public.content, public.media, public.live_sessions to anon, authenticated;
grant insert, update, delete on public.content, public.media, public.live_sessions to authenticated;

create policy content_select_anon on public.content for select to anon
  using (published and audience = 'public');
create policy content_select on public.content for select to authenticated
  using (
    (published and public.audience_allows(audience, offering_id, org_id))
    or (public.has_grant('publish_media') and audience <> 'org_private')
  );
create policy content_insert on public.content for insert to authenticated
  with check (public.has_grant('publish_media') and audience <> 'org_private');
create policy content_update on public.content for update to authenticated
  using (public.has_grant('publish_media') and audience <> 'org_private')
  with check (public.has_grant('publish_media') and audience <> 'org_private');
create policy content_delete on public.content for delete to authenticated
  using (public.has_grant('publish_media') and audience <> 'org_private');

create policy media_select_anon on public.media for select to anon
  using (published and audience = 'public');
create policy media_select on public.media for select to authenticated
  using (
    (published and public.audience_allows(audience, offering_id, org_id))
    or (public.has_grant('publish_media') and audience <> 'org_private')
  );
create policy media_insert on public.media for insert to authenticated
  with check (public.has_grant('publish_media') and audience <> 'org_private');
create policy media_update on public.media for update to authenticated
  using (public.has_grant('publish_media') and audience <> 'org_private')
  with check (public.has_grant('publish_media') and audience <> 'org_private');
create policy media_delete on public.media for delete to authenticated
  using (public.has_grant('publish_media') and audience <> 'org_private');

create policy live_select_anon on public.live_sessions for select to anon
  using (audience = 'public');
create policy live_select on public.live_sessions for select to authenticated
  using (public.audience_allows(audience, offering_id, org_id)
         or (public.has_grant('publish_media') and audience <> 'org_private'));
create policy live_insert on public.live_sessions for insert to authenticated
  with check (public.has_grant('publish_media') and audience <> 'org_private');
create policy live_update on public.live_sessions for update to authenticated
  using (public.has_grant('publish_media') and audience <> 'org_private')
  with check (public.has_grant('publish_media') and audience <> 'org_private');
create policy live_delete on public.live_sessions for delete to authenticated
  using (public.has_grant('publish_media') and audience <> 'org_private');

-- ── public forms: anyone may submit, only portal admins read ───────────
grant insert on public.demo_requests, public.event_registrations to anon, authenticated;
grant select on public.demo_requests, public.event_registrations to authenticated;
create policy demo_insert on public.demo_requests for insert to anon, authenticated with check (true);
create policy demo_select on public.demo_requests for select to authenticated
  using (public.has_grant('portal_admin'));
create policy events_insert on public.event_registrations for insert to anon, authenticated with check (true);
create policy events_select on public.event_registrations for select to authenticated
  using (public.has_grant('portal_admin'));

-- ── audit log: read by portal admins; written only by the audit trigger ─
grant select on public.audit_log to authenticated;
create policy audit_select on public.audit_log for select to authenticated
  using (public.has_grant('portal_admin'));

-- ── AIRA guardrails ─────────────────────────────────────────────────────
-- Rules include client org names for leak detection, so only portal admins read them;
-- the AIRA server reads them with the admin client.
grant select, insert, update, delete on public.guardrail_rules to authenticated;
create policy guardrail_rules_admin on public.guardrail_rules for all to authenticated
  using (public.has_grant('portal_admin')) with check (public.has_grant('portal_admin'));

grant select, insert on public.aira_interactions to authenticated;
grant update (feedback) on public.aira_interactions to authenticated;
create policy aira_select on public.aira_interactions for select to authenticated
  using (user_id = (select auth.uid()) or public.has_grant('portal_admin'));
create policy aira_insert on public.aira_interactions for insert to authenticated
  with check (user_id = (select auth.uid()) and (public.is_employee() or public.is_client_user()));
create policy aira_feedback on public.aira_interactions for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

grant select, insert on public.guardrail_events to authenticated;
create policy guardrail_events_select on public.guardrail_events for select to authenticated
  using (public.has_grant('portal_admin'));
create policy guardrail_events_insert on public.guardrail_events for insert to authenticated
  with check (user_id = (select auth.uid()));
