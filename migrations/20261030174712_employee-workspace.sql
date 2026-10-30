-- Phase 7b · Employee workspace: hackathon/team spaces, experiments, knowledge library.
-- Employees only (clients never see any of it). Free-tier features only: Postgres + RLS.

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(name) between 3 and 80),
  kind text not null default 'squad' check (kind in ('hackathon', 'squad')),
  description text check (char_length(description) <= 1000),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index teams_created_by_idx on public.teams (created_by);

create table public.team_members (
  team_id uuid not null references public.teams (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member' check (role in ('lead', 'member')),
  added_at timestamptz not null default now(),
  primary key (team_id, user_id)
);
create index team_members_user_idx on public.team_members (user_id);

create table public.experiments (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 5 and 140),
  hypothesis text not null check (char_length(hypothesis) between 10 and 2000),
  method text check (char_length(method) <= 4000),
  result text check (char_length(result) <= 4000),
  status text not null default 'draft' check (status in ('draft', 'running', 'completed', 'stopped')),
  offering_id uuid references public.offerings (id) on delete set null,
  team_id uuid references public.teams (id) on delete set null,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index experiments_owner_idx on public.experiments (owner_id);
create index experiments_team_idx on public.experiments (team_id);
create index experiments_offering_idx on public.experiments (offering_id);
create trigger experiments_touch before update on public.experiments for each row execute function public.touch_updated_at();

-- Membership/lead checks without RLS recursion.
create or replace function public.is_team_member(p_team uuid)
returns boolean language sql stable security definer
set search_path = pg_catalog, public, pg_temp as $$
  select exists (select 1 from public.team_members where team_id = p_team and user_id = auth.uid());
$$;
create or replace function public.is_team_lead(p_team uuid)
returns boolean language sql stable security definer
set search_path = pg_catalog, public, pg_temp as $$
  select exists (select 1 from public.team_members where team_id = p_team and user_id = auth.uid() and role = 'lead');
$$;
revoke all on function public.is_team_member(uuid), public.is_team_lead(uuid) from public, anon;
grant execute on function public.is_team_member(uuid), public.is_team_lead(uuid) to authenticated;

-- The creator becomes the lead; only active employees can ever be added; a team keeps one lead.
create or replace function public.team_bootstrap()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
begin
  insert into public.team_members (team_id, user_id, role) values (new.id, new.created_by, 'lead');
  return null;
end $$;
create trigger teams_bootstrap after insert on public.teams for each row execute function public.team_bootstrap();

create or replace function public.team_member_guard()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
begin
  if tg_op in ('INSERT', 'UPDATE') and not exists (
    select 1 from public.memberships m join public.orgs o on o.id = m.org_id
    where m.user_id = new.user_id and m.status = 'active' and m.role = 'employee' and o.kind = 'azentio'
  ) then
    raise exception 'Only Azentio employees can join a team' using errcode = 'P0001';
  end if;
  if tg_op in ('UPDATE', 'DELETE') and old.role = 'lead' and auth.uid() is not null
     and (tg_op = 'DELETE' or new.role <> 'lead')
     and not exists (select 1 from public.team_members where team_id = old.team_id and role = 'lead' and user_id <> old.user_id)
     and exists (select 1 from public.teams where id = old.team_id) then
    raise exception 'A team needs at least one lead' using errcode = 'P0001';
  end if;
  return coalesce(new, old);
end $$;
revoke all on function public.team_bootstrap(), public.team_member_guard() from public;
create trigger team_members_guard before insert or update or delete on public.team_members
  for each row execute function public.team_member_guard();

-- Employees pick teammates by email; clients and anonymous callers get nothing.
create or replace function public.employee_directory()
returns table (user_id uuid, email text)
language sql stable security definer
set search_path = pg_catalog, public, pg_temp as $$
  select p.user_id, p.email from public.profiles p
  join public.memberships m on m.user_id = p.user_id and m.status = 'active' and m.role = 'employee'
  join public.orgs o on o.id = m.org_id and o.kind = 'azentio'
  where public.is_employee()
  order by p.email;
$$;
revoke all on function public.employee_directory() from public, anon;
grant execute on function public.employee_directory() to authenticated;

-- ── RLS ──────────────────────────────────────────────────────────────────
alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.experiments enable row level security;
revoke all on public.teams, public.team_members, public.experiments from anon, authenticated;

grant select, insert (name, kind, description), update (name, description), delete on public.teams to authenticated;
create policy teams_select on public.teams for select to authenticated using (public.is_employee());
create policy teams_insert on public.teams for insert to authenticated
  with check (public.is_employee() and created_by = (select auth.uid()));
create policy teams_update on public.teams for update to authenticated
  using (public.is_team_lead(id)) with check (public.is_team_lead(id));
create policy teams_delete on public.teams for delete to authenticated using (public.is_team_lead(id));

grant select, insert (team_id, user_id, role), update (role), delete on public.team_members to authenticated;
create policy team_members_select on public.team_members for select to authenticated using (public.is_employee());
create policy team_members_insert on public.team_members for insert to authenticated with check (public.is_team_lead(team_id));
create policy team_members_update on public.team_members for update to authenticated
  using (public.is_team_lead(team_id)) with check (public.is_team_lead(team_id));
-- leads manage the roster; anyone may leave
create policy team_members_delete on public.team_members for delete to authenticated
  using (public.is_team_lead(team_id) or user_id = (select auth.uid()));

grant select, insert (title, hypothesis, method, result, status, offering_id, team_id), update (title, hypothesis, method, result, status, offering_id, team_id), delete on public.experiments to authenticated;
-- drafts are private to the owner; everything else is visible to all employees
create policy experiments_select on public.experiments for select to authenticated using (
  public.is_employee() and (status <> 'draft' or owner_id = (select auth.uid()) or (team_id is not null and public.is_team_member(team_id)))
);
create policy experiments_insert on public.experiments for insert to authenticated with check (
  public.is_employee() and owner_id = (select auth.uid()) and (team_id is null or public.is_team_member(team_id))
);
create policy experiments_update on public.experiments for update to authenticated
  using (owner_id = (select auth.uid()) or (team_id is not null and public.is_team_member(team_id)))
  with check (public.is_employee() and (team_id is null or public.is_team_member(team_id)));
create policy experiments_delete on public.experiments for delete to authenticated
  using (owner_id = (select auth.uid()) and status = 'draft');

-- ── knowledge library: employees own their entries (owner + review date), not just publishers ──
create policy content_select_own_library on public.content for select to authenticated
  using (kind = 'library' and owner_id = (select auth.uid()));
create policy content_insert_library on public.content for insert to authenticated with check (
  public.is_employee() and kind = 'library' and audience = 'employee' and owner_id = (select auth.uid())
);
create policy content_update_library on public.content for update to authenticated
  using (kind = 'library' and audience = 'employee' and owner_id = (select auth.uid()))
  with check (public.is_employee() and kind = 'library' and audience = 'employee' and owner_id = (select auth.uid()));
create policy content_delete_library on public.content for delete to authenticated
  using (kind = 'library' and audience = 'employee' and owner_id = (select auth.uid()));

-- ── comments on experiments (employees only) ─────────────────────────────
alter table public.comments drop constraint comments_parent_type_check;
alter table public.comments add constraint comments_parent_type_check check (parent_type in ('shared', 'content', 'experiment'));

drop policy comments_insert on public.comments;
create policy comments_insert on public.comments for insert to authenticated with check (
  author_id = (select auth.uid()) and case parent_type
    when 'shared' then exists (select 1 from public.shared_contributions s where s.id = comments.parent_id)
    when 'content' then exists (select 1 from public.content t where t.id = comments.parent_id and t.published)
    when 'experiment' then exists (select 1 from public.experiments e where e.id = comments.parent_id)
    else false end
);

create or replace function public.comment_thread(p_type text, p_id uuid)
returns table (id uuid, body text, at timestamptz, mine boolean, author_label text, hidden boolean)
language sql stable security definer
set search_path = pg_catalog, public, pg_temp as $$
  select c.id, c.body, c.at, c.author_id = auth.uid(),
         case
           when c.author_id = auth.uid() then 'You'
           when p_type = 'experiment' then coalesce((select split_part(p.email, '@', 1) from public.profiles p where p.user_id = c.author_id), 'Colleague')
           when exists (select 1 from public.memberships m join public.orgs o on o.id = m.org_id
                        where m.user_id = c.author_id and m.status = 'active' and o.kind = 'azentio') then 'Azentio team'
           when exists (select 1 from public.memberships a join public.memberships b on b.org_id = a.org_id
                        join public.orgs o on o.id = a.org_id
                        where a.user_id = c.author_id and b.user_id = auth.uid() and o.kind = 'client'
                          and a.status = 'active' and b.status = 'active') then 'Your organisation'
           else 'Community member'
         end,
         c.hidden
  from public.comments c
  where c.parent_type = p_type and c.parent_id = p_id
    and (not c.hidden or public.has_grant('moderate'))
    and case p_type
      when 'shared' then (public.is_employee() or public.is_client_user()) and exists (
        select 1 from public.shared_contributions s where s.id = p_id and (s.status = 'live' or public.has_grant('moderate')))
      when 'content' then exists (
        select 1 from public.content t where t.id = p_id and t.published and public.audience_allows(t.audience, t.offering_id, t.org_id))
      -- internal workspace: colleagues are named (employees only, and only experiments they can see)
      when 'experiment' then public.is_employee() and exists (
        select 1 from public.experiments e where e.id = p_id
          and (e.status <> 'draft' or e.owner_id = auth.uid() or (e.team_id is not null and public.is_team_member(e.team_id))))
      else false
    end
  order by c.at;
$$;

do $$
declare t text;
begin
  foreach t in array array['teams', 'team_members', 'experiments'] loop
    execute format(
      'create trigger %I after insert or update or delete on public.%I for each row execute function public.audit_row()',
      t || '_audit', t);
  end loop;
end $$;
