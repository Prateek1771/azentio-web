-- Phase 6 · Moderated shared copies, reports, themes with k-anonymous counts, improvement ideas.
-- The shared copy carries reviewed fields only: no org, author, notes or attachments.

create table public.shared_contributions (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null unique references public.contributions (id) on delete cascade,
  title text not null check (char_length(title) between 5 and 140),
  body text not null check (char_length(body) between 20 and 5000),
  type public.contrib_type not null,
  offering_id uuid references public.offerings (id) on delete set null,
  industry text,
  region text,
  period_start date,
  period_end date,
  attributed_org_name text, -- only when the contributor consented to attribution
  status text not null default 'live' check (status in ('pending', 'live', 'hidden')),
  published_at timestamptz not null default now(),
  tsv tsvector generated always as (
    to_tsvector('english', title || ' ' || body || ' ' || coalesce(industry, '') || ' ' || coalesce(region, ''))
  ) stored
);
create index shared_contributions_tsv_idx on public.shared_contributions using gin (tsv);
create index shared_contributions_feed_idx on public.shared_contributions (status, published_at desc);
create index shared_contributions_offering_idx on public.shared_contributions (offering_id);

-- Service-only: lets definer functions count distinct orgs without exposing who said what.
create table public.shared_org_link (
  shared_id uuid primary key references public.shared_contributions (id) on delete cascade,
  org_id uuid not null references public.orgs (id) on delete cascade
);
create index shared_org_link_org_idx on public.shared_org_link (org_id);

create or replace function public.k_min()
returns int language sql immutable as $$ select 3 $$; -- mirrors K_MIN_ORGS

-- ── publishing: only through the moderator RPC, which writes the reviewed copy first ──
create or replace function public.contrib_publish_gate()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
begin
  if old.state = 'submitted' and new.state = 'published' and not exists (
    select 1 from public.shared_contributions s where s.source_id = new.id and s.status = 'pending'
  ) then
    raise exception 'Publish through the moderation queue so a reviewed shared copy is created' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger contributions_b_publish_gate before update on public.contributions
  for each row execute function public.contrib_publish_gate();

create or replace function public.moderate_publish(p_id uuid, p_title text, p_body text, p_industry text, p_region text)
returns uuid language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
declare
  c public.contributions;
  v_attr boolean;
  v_shared uuid;
begin
  if not public.has_grant('moderate') then
    raise exception 'Only moderators can publish' using errcode = '42501';
  end if;
  if char_length(trim(coalesce(p_title, ''))) not between 5 and 140 or char_length(trim(coalesce(p_body, ''))) not between 20 and 5000 then
    raise exception 'The shared copy needs a title (5-140 characters) and a body (20-5,000)' using errcode = 'P0001';
  end if;
  select * into c from public.contributions where id = p_id and state = 'submitted';
  if c.id is null then
    raise exception 'This contribution is not awaiting review' using errcode = 'P0001';
  end if;
  select k.attribute into v_attr from public.consents k where k.contribution_id = p_id order by k.id desc limit 1;
  -- reviewed copy first (pending = invisible), then the guarded transition, then go live
  insert into public.shared_contributions
    (source_id, title, body, type, offering_id, industry, region, period_start, period_end, attributed_org_name, status)
  values (p_id, trim(p_title), trim(p_body), c.type, c.offering_id, nullif(trim(p_industry), ''), nullif(trim(p_region), ''),
          c.period_start, c.period_end,
          case when coalesce(v_attr, false) then (select o.name from public.orgs o where o.id = c.org_id) end, 'pending')
  returning id into v_shared;
  insert into public.shared_org_link (shared_id, org_id) values (v_shared, c.org_id);
  update public.contributions set state = 'published' where id = p_id;
  update public.shared_contributions set status = 'live' where id = v_shared;
  return v_shared;
end $$;
revoke all on function public.moderate_publish(uuid, text, text, text, text) from public, anon;
grant execute on function public.moderate_publish(uuid, text, text, text, text) to authenticated;

-- Unpublish hides, restore shows, anything else that leaves "published" purges (synchronously).
create or replace function public.contrib_shared_sync()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
begin
  if new.state = 'unpublished' then
    update public.shared_contributions set status = 'hidden' where source_id = new.id;
  elsif new.state = 'published' and old.state = 'unpublished' then
    update public.shared_contributions set status = 'live' where source_id = new.id;
  elsif new.state <> 'published' then
    delete from public.shared_contributions where source_id = new.id;
  end if;
  return null;
end $$;
revoke all on function public.contrib_shared_sync(), public.contrib_publish_gate() from public;
create trigger contributions_shared_sync after update of state on public.contributions
  for each row when (old.state is distinct from new.state) execute function public.contrib_shared_sync();

-- ── reports ──────────────────────────────────────────────────────────────
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  shared_id uuid references public.shared_contributions (id) on delete set null,
  contribution_id uuid references public.contributions (id) on delete cascade,
  reporter_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  reason text not null check (char_length(reason) between 5 and 1000),
  status text not null default 'open' check (status in ('open', 'upheld', 'dismissed')),
  decision_note text check (char_length(decision_note) <= 1000),
  decided_by uuid references auth.users (id) on delete set null,
  decided_at timestamptz,
  at timestamptz not null default now()
);
create unique index reports_one_open on public.reports (shared_id, reporter_id) where status = 'open';
create index reports_status_idx on public.reports (status, at desc);
create index reports_contribution_idx on public.reports (contribution_id);
create index reports_reporter_idx on public.reports (reporter_id);
create index reports_decided_by_idx on public.reports (decided_by);

create or replace function public.report_guard()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
begin
  if tg_op = 'INSERT' then
    new.contribution_id := (select s.source_id from public.shared_contributions s where s.id = new.shared_id);
    new.status := 'open';
    insert into public.notifications (user_id, kind, payload)
    select distinct g.user_id, 'report.open', jsonb_build_object('report_id', new.id, 'contribution_id', new.contribution_id)
    from public.grants g
    join public.memberships m on m.user_id = g.user_id and m.status = 'active' and m.role = 'employee'
    where g.kind = 'moderate';
  else
    if old.status <> 'open' then
      raise exception 'This report has already been decided' using errcode = 'P0001';
    end if;
    if new.reason is distinct from old.reason or new.shared_id is distinct from old.shared_id then
      raise exception 'A report cannot be edited' using errcode = 'P0001';
    end if;
    if new.status <> 'open' then
      new.decided_by := auth.uid();
      new.decided_at := now();
      insert into public.notifications (user_id, kind, payload)
      values (new.reporter_id, 'report.decided', jsonb_build_object('report_id', new.id, 'status', new.status));
    end if;
  end if;
  return new;
end $$;
revoke all on function public.report_guard() from public;
create trigger reports_guard before insert or update on public.reports
  for each row execute function public.report_guard();

-- ── themes ───────────────────────────────────────────────────────────────
create table public.themes (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(name) between 3 and 120),
  summary text not null check (char_length(summary) between 10 and 2000),
  limitations text check (char_length(limitations) <= 1000),
  confidence text not null default 'low' check (confidence in ('low', 'med', 'high')),
  offering_ids uuid[] not null default '{}',
  status text not null default 'draft' check (status in ('draft', 'confirmed')),
  updated_by uuid default auth.uid() references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);
create index themes_updated_by_idx on public.themes (updated_by);

create table public.theme_links (
  theme_id uuid not null references public.themes (id) on delete cascade,
  shared_id uuid not null references public.shared_contributions (id) on delete cascade,
  primary key (theme_id, shared_id)
);
create index theme_links_shared_idx on public.theme_links (shared_id);

-- Distinct organisations, never below k; repeated posts from one org count once.
create or replace function public.theme_stats()
returns table (theme_id uuid, evidence_count int, org_count int, small_sample boolean, period_start date, period_end date)
language sql stable security definer
set search_path = pg_catalog, public, pg_temp as $$
  select t.id,
         count(distinct s.id)::int,
         case when count(distinct l.org_id) >= public.k_min() then count(distinct l.org_id)::int end,
         count(distinct l.org_id) < public.k_min(),
         min(s.period_start),
         max(s.period_end)
  from public.themes t
  left join public.theme_links tl on tl.theme_id = t.id
  left join public.shared_contributions s on s.id = tl.shared_id and s.status = 'live'
  left join public.shared_org_link l on l.shared_id = s.id
  where public.is_employee() or (public.is_client_user() and t.status = 'confirmed')
  group by t.id;
$$;
revoke all on function public.theme_stats() from public, anon;
grant execute on function public.theme_stats() to authenticated;

-- ── improvement ideas ────────────────────────────────────────────────────
create table public.ideas (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 5 and 140),
  problem text not null check (char_length(problem) between 10 and 2000),
  offering_id uuid references public.offerings (id) on delete set null,
  theme_id uuid references public.themes (id) on delete set null,
  proposed_outcome text check (char_length(proposed_outcome) <= 2000),
  owner_team text check (char_length(owner_team) <= 80),
  priority text not null default 'med' check (priority in ('low', 'med', 'high')),
  status public.idea_status not null default 'proposed',
  public_update text check (char_length(public_update) <= 600),
  client_visible boolean not null default false,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);
create index ideas_offering_idx on public.ideas (offering_id);
create index ideas_theme_idx on public.ideas (theme_id);
create index ideas_created_by_idx on public.ideas (created_by);

create table public.idea_evidence (
  idea_id uuid not null references public.ideas (id) on delete cascade,
  shared_id uuid not null references public.shared_contributions (id) on delete cascade,
  primary key (idea_id, shared_id)
);
create index idea_evidence_shared_idx on public.idea_evidence (shared_id);

create table public.idea_status_history (
  id bigint generated always as identity primary key,
  idea_id uuid not null references public.ideas (id) on delete cascade,
  from_status public.idea_status,
  to_status public.idea_status not null,
  actor_id uuid references auth.users (id) on delete set null,
  at timestamptz not null default now()
);
create index idea_status_history_idea_idx on public.idea_status_history (idea_id, id);
create index idea_status_history_actor_idx on public.idea_status_history (actor_id);

create or replace function public.idea_events()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into public.idea_status_history (idea_id, from_status, to_status, actor_id)
    values (new.id, case when tg_op = 'UPDATE' then old.status end, new.status, auth.uid());
  end if;
  -- close the loop: contributors behind the evidence hear the audience-safe update only
  if tg_op = 'UPDATE' and new.client_visible
     and (new.status is distinct from old.status or new.public_update is distinct from old.public_update
          or not old.client_visible) then
    insert into public.notifications (user_id, kind, payload)
    select distinct c.author_id, 'idea.update',
           jsonb_build_object('idea_id', new.id, 'title', new.title, 'status', new.status, 'public_update', new.public_update)
    from public.idea_evidence ie
    join public.shared_contributions s on s.id = ie.shared_id
    join public.contributions c on c.id = s.source_id
    where ie.idea_id = new.id;
  end if;
  return null;
end $$;
revoke all on function public.idea_events() from public;
create trigger ideas_events after insert or update on public.ideas
  for each row execute function public.idea_events();

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;
create trigger ideas_touch before update on public.ideas for each row execute function public.touch_updated_at();
create trigger themes_touch before update on public.themes for each row execute function public.touch_updated_at();

-- Clients see only safe columns of ideas marked visible, for offerings they're entitled to.
create or replace function public.client_ideas()
returns table (id uuid, title text, offering text, theme text, status public.idea_status, public_update text, owner_team text, updated_at timestamptz)
language sql stable security definer
set search_path = pg_catalog, public, pg_temp as $$
  select i.id, i.title, o.name, t.name, i.status, i.public_update, i.owner_team, i.updated_at
  from public.ideas i
  left join public.offerings o on o.id = i.offering_id
  left join public.themes t on t.id = i.theme_id and t.status = 'confirmed'
  where i.client_visible
    and (public.is_employee() or (public.is_client_user() and (i.offering_id is null or public.entitled(i.offering_id))))
  order by i.updated_at desc;
$$;
revoke all on function public.client_ideas() from public, anon;
grant execute on function public.client_ideas() to authenticated;

-- ── privileges + RLS ─────────────────────────────────────────────────────
alter table public.shared_contributions enable row level security;
alter table public.shared_org_link enable row level security;
alter table public.reports enable row level security;
alter table public.themes enable row level security;
alter table public.theme_links enable row level security;
alter table public.ideas enable row level security;
alter table public.idea_evidence enable row level security;
alter table public.idea_status_history enable row level security;

revoke all on public.shared_contributions, public.shared_org_link, public.reports, public.themes, public.theme_links,
  public.ideas, public.idea_evidence, public.idea_status_history from anon, authenticated;

-- source_id deliberately not granted: the shared copy can't be traced back to its tenant.
grant select (id, title, body, type, offering_id, industry, region, period_start, period_end,
              attributed_org_name, status, published_at, tsv) on public.shared_contributions to authenticated;
create policy shared_select on public.shared_contributions for select to authenticated
  using (status = 'live' and (public.is_employee() or public.is_client_user()));

grant select, insert (shared_id, reason) on public.reports to authenticated;
grant update (status, decision_note) on public.reports to authenticated;
create policy reports_select on public.reports for select to authenticated
  using (reporter_id = (select auth.uid()) or public.has_grant('moderate'));
create policy reports_insert on public.reports for insert to authenticated with check (
  reporter_id = (select auth.uid())
  and exists (select 1 from public.shared_contributions s where s.id = reports.shared_id)
);
create policy reports_decide on public.reports for update to authenticated
  using (public.has_grant('moderate')) with check (public.has_grant('moderate'));

grant select, insert, update, delete on public.themes, public.theme_links to authenticated;
create policy themes_select on public.themes for select to authenticated
  using (public.is_employee() or (public.is_client_user() and status = 'confirmed'));
create policy themes_write on public.themes for all to authenticated
  using (public.has_grant('product_owner') or public.has_grant('moderate'))
  with check (public.has_grant('product_owner') or public.has_grant('moderate'));
create policy theme_links_select on public.theme_links for select to authenticated
  using (exists (select 1 from public.themes t where t.id = theme_links.theme_id));
create policy theme_links_write on public.theme_links for all to authenticated
  using (public.has_grant('product_owner') or public.has_grant('moderate'))
  with check (public.has_grant('product_owner') or public.has_grant('moderate'));

grant select, insert, update on public.ideas to authenticated;
grant select, insert, delete on public.idea_evidence to authenticated;
grant select on public.idea_status_history to authenticated;
create policy ideas_select on public.ideas for select to authenticated using (public.is_employee());
create policy ideas_insert on public.ideas for insert to authenticated with check (public.has_grant('product_owner'));
create policy ideas_update on public.ideas for update to authenticated
  using (public.has_grant('product_owner')) with check (public.has_grant('product_owner'));
create policy idea_evidence_select on public.idea_evidence for select to authenticated using (public.is_employee());
create policy idea_evidence_write on public.idea_evidence for all to authenticated
  using (public.has_grant('product_owner')) with check (public.has_grant('product_owner'));
create policy idea_history_select on public.idea_status_history for select to authenticated using (public.is_employee());

do $$
declare t text;
begin
  foreach t in array array['shared_contributions', 'reports', 'themes', 'theme_links', 'ideas', 'idea_evidence'] loop
    execute format(
      'create trigger %I after insert or update or delete on public.%I for each row execute function public.audit_row()',
      t || '_audit', t);
  end loop;
end $$;
