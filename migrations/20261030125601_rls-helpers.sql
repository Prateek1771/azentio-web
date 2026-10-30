-- Phase 1 · RLS helper functions + trusted RPCs.
-- All helpers are SECURITY DEFINER (prevents RLS recursion), STABLE, with a pinned search_path.

create or replace function public.is_member(p_org uuid)
returns boolean language sql stable security definer
set search_path = pg_catalog, public, pg_temp as $$
  select exists (
    select 1 from public.memberships
    where user_id = auth.uid() and org_id = p_org and status = 'active'
  );
$$;

create or replace function public.is_org_admin(p_org uuid)
returns boolean language sql stable security definer
set search_path = pg_catalog, public, pg_temp as $$
  select exists (
    select 1 from public.memberships
    where user_id = auth.uid() and org_id = p_org and status = 'active' and role = 'client_admin'
  );
$$;

create or replace function public.is_employee()
returns boolean language sql stable security definer
set search_path = pg_catalog, public, pg_temp as $$
  select exists (
    select 1 from public.memberships m join public.orgs o on o.id = m.org_id
    where m.user_id = auth.uid() and m.status = 'active' and m.role = 'employee' and o.kind = 'azentio'
  );
$$;

create or replace function public.is_client_user()
returns boolean language sql stable security definer
set search_path = pg_catalog, public, pg_temp as $$
  select exists (
    select 1 from public.memberships m join public.orgs o on o.id = m.org_id
    where m.user_id = auth.uid() and m.status = 'active' and o.kind = 'client'
  );
$$;

-- Grants only count for active employees: a stray grant row can never empower a client.
create or replace function public.has_grant(p_kind public.grant_kind)
returns boolean language sql stable security definer
set search_path = pg_catalog, public, pg_temp as $$
  select public.is_employee() and exists (
    select 1 from public.grants where user_id = auth.uid() and kind = p_kind
  );
$$;

create or replace function public.entitled(p_offering uuid)
returns boolean language sql stable security definer
set search_path = pg_catalog, public, pg_temp as $$
  select exists (
    select 1 from public.entitlements e
    join public.memberships m on m.org_id = e.org_id
    where m.user_id = auth.uid() and m.status = 'active' and e.offering_id = p_offering
  );
$$;

-- Verified email of the caller, read from the auth store (never from a client claim).
create or replace function public.current_email()
returns text language sql stable security definer
set search_path = pg_catalog, public, pg_temp as $$
  select lower(email) from auth.users where id = auth.uid() and email_verified;
$$;

-- Binds email-keyed provisioning to the signed-in, *verified* user. Idempotent.
create or replace function public.claim_provisioned_access()
returns jsonb language plpgsql volatile security definer
set search_path = pg_catalog, public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  v_email text := public.current_email();
  v_azentio uuid;
  v_orgs int := 0;
  r record;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if v_email is null then
    return jsonb_build_object('claimed', false, 'reason', 'email_not_verified');
  end if;

  insert into public.profiles (user_id, email) values (v_uid, v_email)
  on conflict (user_id) do update set email = excluded.email;

  -- employee allow-list → membership in the single Azentio org
  if exists (select 1 from public.employee_allowlist where email = v_email) then
    select id into v_azentio from public.orgs where kind = 'azentio';
    if v_azentio is not null then
      insert into public.memberships (user_id, org_id, role)
      values (v_uid, v_azentio, 'employee')
      on conflict (user_id, org_id) do nothing;
      v_orgs := v_orgs + 1;
    end if;
  end if;

  for r in
    select pa.*, o.kind as org_kind from public.provisioned_access pa
    join public.orgs o on o.id = pa.org_id
    where pa.email = v_email
  loop
    insert into public.memberships (user_id, org_id, role)
    values (v_uid, r.org_id, r.role)
    on conflict (user_id, org_id) do nothing;
    -- platform grants only ever attach to Azentio memberships
    if r.org_kind = 'azentio' and cardinality(r.grants) > 0 then
      insert into public.grants (user_id, kind)
      select v_uid, g from unnest(r.grants) as g
      on conflict (user_id, kind) do nothing;
    end if;
    update public.provisioned_access
      set claimed_by = v_uid, claimed_at = coalesce(claimed_at, now())
      where id = r.id;
    v_orgs := v_orgs + 1;
  end loop;

  return jsonb_build_object('claimed', v_orgs > 0, 'memberships', v_orgs);
end;
$$;

revoke all on function public.is_member(uuid), public.is_org_admin(uuid), public.is_employee(),
  public.is_client_user(), public.has_grant(public.grant_kind), public.entitled(uuid),
  public.current_email(), public.claim_provisioned_access() from public;
grant execute on function public.is_member(uuid), public.is_org_admin(uuid), public.is_employee(),
  public.is_client_user(), public.has_grant(public.grant_kind), public.entitled(uuid)
  to anon, authenticated;
grant execute on function public.current_email(), public.claim_provisioned_access() to authenticated;
