-- Phase 2 · invitations (single-use, expiring, bound to the invited verified email) and terms acceptance.

-- Returns the raw token exactly once; only its sha256 hash is stored.
create or replace function public.create_invitation(p_org uuid, p_email text, p_role public.member_role)
returns text language plpgsql volatile security definer
set search_path = pg_catalog, public, pg_temp as $$
declare
  v_token text := encode(public.gen_random_bytes(32), 'hex');
  v_email text := lower(trim(p_email));
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if not (public.is_org_admin(p_org) or public.has_grant('portal_admin')) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_role not in ('client_member', 'client_admin') then
    raise exception 'invitations can only grant client roles' using errcode = '22023';
  end if;
  if (select kind from public.orgs where id = p_org) <> 'client' then
    raise exception 'invitations are for client organisations' using errcode = '22023';
  end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(v_email) > 254 then
    raise exception 'invalid email' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.memberships m join auth.users u on u.id = m.user_id
    where m.org_id = p_org and lower(u.email) = v_email and m.status = 'active'
  ) then
    raise exception 'already a member' using errcode = '23505';
  end if;

  insert into public.invitations (org_id, email, role, token_hash, expires_at, invited_by)
  values (p_org, v_email, p_role, encode(public.digest(v_token, 'sha256'), 'hex'), now() + interval '7 days', auth.uid());
  return v_token;
end $$;

create or replace function public.accept_invitation(p_token text)
returns jsonb language plpgsql volatile security definer
set search_path = pg_catalog, public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  v_email text := public.current_email();
  v_inv public.invitations;
  v_slug text;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  select * into v_inv from public.invitations
    where token_hash = encode(public.digest(coalesce(p_token, ''), 'sha256'), 'hex')
    for update;
  if not found or v_inv.used_at is not null or v_inv.revoked_at is not null or v_inv.expires_at <= now() then
    return jsonb_build_object('ok', false, 'reason', 'invalid_or_expired');
  end if;
  if v_email is null or v_email <> v_inv.email then
    return jsonb_build_object('ok', false, 'reason', 'wrong_account');
  end if;

  insert into public.profiles (user_id, email) values (v_uid, v_email)
  on conflict (user_id) do nothing;
  insert into public.memberships (user_id, org_id, role)
  values (v_uid, v_inv.org_id, v_inv.role)
  on conflict (user_id, org_id) do update set status = 'active';
  update public.invitations set used_at = now(), used_by = v_uid where id = v_inv.id;

  select slug into v_slug from public.orgs where id = v_inv.org_id;
  return jsonb_build_object('ok', true, 'org_slug', v_slug);
end $$;

create or replace function public.accept_terms(p_org uuid, p_version text)
returns void language plpgsql volatile security definer
set search_path = pg_catalog, public, pg_temp as $$
begin
  if not public.is_member(p_org) then
    raise exception 'not a member' using errcode = '42501';
  end if;
  insert into public.terms_acceptance (user_id, org_id, version)
  values (auth.uid(), p_org, p_version)
  on conflict do nothing;
end $$;

revoke all on function public.create_invitation(uuid, text, public.member_role),
  public.accept_invitation(text), public.accept_terms(uuid, text) from public;
grant execute on function public.create_invitation(uuid, text, public.member_role),
  public.accept_invitation(text), public.accept_terms(uuid, text) to authenticated;

-- Invitations are created only through create_invitation(); remove direct inserts.
drop policy invitations_insert on public.invitations;
revoke insert on public.invitations from authenticated;
