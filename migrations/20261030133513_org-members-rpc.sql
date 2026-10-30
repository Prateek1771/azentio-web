-- Phase 2 · member directory for client admins (emails are otherwise own-row only).
create or replace function public.org_members(p_org uuid)
returns table (user_id uuid, email text, role public.member_role, status public.member_status, joined_at timestamptz)
language sql stable security definer
set search_path = pg_catalog, public, pg_temp as $$
  select m.user_id, lower(u.email), m.role, m.status, m.created_at
  from public.memberships m join auth.users u on u.id = m.user_id
  where m.org_id = p_org and (public.is_org_admin(p_org) or public.has_grant('portal_admin'))
  order by m.created_at;
$$;
revoke all on function public.org_members(uuid) from public;
grant execute on function public.org_members(uuid) to authenticated;
