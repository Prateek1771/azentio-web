-- Phase 5 · Contributions lifecycle, consents, versions, notifications (+ realtime) and client sandboxes.
-- The state machine lives in the database: the app can only ask, the trigger decides.

create table public.contributions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs (id) on delete cascade,
  author_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  type public.contrib_type not null,
  title text not null check (char_length(title) between 5 and 140),
  body text not null check (char_length(body) between 20 and 5000),
  offering_id uuid references public.offerings (id) on delete set null,
  industry text check (char_length(industry) <= 80),
  region text check (char_length(region) <= 80),
  period_start date,
  period_end date,
  evidence_type text not null default 'anecdotal'
    check (evidence_type in ('internal_data', 'client_feedback', 'market_report', 'regulatory', 'anecdotal')),
  confidence text not null default 'med' check (confidence in ('low', 'med', 'high')),
  visibility_choice public.visibility_choice not null default 'private',
  state public.contrib_state not null default 'draft',
  version int not null default 1,
  pii_flags jsonb not null default '[]',
  moderator_reason text check (char_length(moderator_reason) <= 1000),
  last_action text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (period_end is null or period_start is null or period_end >= period_start)
);
create index contributions_org_idx on public.contributions (org_id, updated_at desc);
create index contributions_author_idx on public.contributions (author_id, updated_at desc);
create index contributions_review_idx on public.contributions (state) where visibility_choice = 'propose_shared';
create index contributions_offering_idx on public.contributions (offering_id);

create table public.contribution_versions (
  contribution_id uuid not null references public.contributions (id) on delete cascade,
  version int not null,
  snapshot jsonb not null,
  created_at timestamptz not null default now(),
  primary key (contribution_id, version)
);

-- Append-only consent history; the latest row is the current consent.
create table public.consents (
  id bigint generated always as identity primary key,
  contribution_id uuid not null references public.contributions (id) on delete cascade,
  store boolean not null,
  publish boolean not null,
  attribute boolean not null,
  train boolean not null,
  actor uuid not null default auth.uid() references auth.users (id) on delete cascade,
  at timestamptz not null default now()
);
create index consents_contribution_idx on public.consents (contribution_id, id desc);
create index consents_actor_idx on public.consents (actor);

create table public.moderation_events (
  id bigint generated always as identity primary key,
  contribution_id uuid not null references public.contributions (id) on delete cascade,
  actor_id uuid references auth.users (id) on delete set null,
  action text not null,
  from_state public.contrib_state not null,
  to_state public.contrib_state not null,
  version int not null,
  reason text,
  at timestamptz not null default now()
);
create index moderation_events_contribution_idx on public.moderation_events (contribution_id, id);
create index moderation_events_actor_idx on public.moderation_events (actor_id);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null,
  payload jsonb not null default '{}',
  read_at timestamptz,
  at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, at desc);

-- ── sensitive-data scan (server truth; the UI mirrors it in lib/contributions/pii.ts) ──
create or replace function public.pii_scan(p text)
returns jsonb language sql immutable
set search_path = pg_catalog as $$
  select coalesce(jsonb_agg(k order by k), '[]'::jsonb) from (
              select 'email' k   where p ~* '[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}'
    union all select 'phone'     where p ~ '(\+\d{1,3}[ -]?)?\m(\d[ -]?){9,11}\d\M'
    union all select 'card_or_account' where p ~ '\m(\d[ -]?){12,18}\d\M'
    union all select 'iban'      where p ~ '\m[A-Z]{2}\d{2}[A-Z0-9]{11,30}\M'
    union all select 'pan'       where p ~ '\m[A-Z]{5}\d{4}[A-Z]\M'
    union all select 'aadhaar'   where p ~ '\m\d{4} \d{4} \d{4}\M'
  ) s;
$$;

-- ── lifecycle state machine ──────────────────────────────────────────────
create or replace function public.contrib_guard()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  v_author boolean;
  v_mod boolean;
  v_edit boolean;
  v_step text;
  v_action text;
  v_store boolean;
  v_publish boolean;
begin
  new.pii_flags := public.pii_scan(new.title || ' ' || new.body);
  if tg_op = 'INSERT' then
    new.last_action := 'create';
    return new;
  end if;

  v_author := v_uid is not null and v_uid = old.author_id;
  v_mod := public.has_grant('moderate');
  v_edit := (new.type, new.title, new.body, new.offering_id, new.industry, new.region,
             new.period_start, new.period_end, new.evidence_type, new.confidence)
            is distinct from
            (old.type, old.title, old.body, old.offering_id, old.industry, old.region,
             old.period_start, old.period_end, old.evidence_type, old.confidence);

  if old.state in ('rejected', 'withdrawn') then
    raise exception 'This contribution is closed (%)', old.state using errcode = 'P0001';
  end if;
  if (v_edit or new.visibility_choice is distinct from old.visibility_choice) and not v_author then
    raise exception 'Only the author can edit a contribution' using errcode = 'P0001';
  end if;
  -- the audience never widens silently
  if new.visibility_choice is distinct from old.visibility_choice and old.state <> 'draft' then
    raise exception 'Visibility can only change while the contribution is a draft' using errcode = 'P0001';
  end if;
  if new.moderator_reason is distinct from old.moderator_reason and not v_mod then
    raise exception 'Only a moderator can set a review reason' using errcode = 'P0001';
  end if;
  if v_edit and old.state not in ('draft', 'submitted', 'returned', 'published') then
    raise exception 'A % contribution cannot be edited', old.state using errcode = 'P0001';
  end if;

  -- a material edit to a proposed item goes back to review
  if v_edit and old.state in ('returned', 'published') and new.state = old.state
     and old.visibility_choice = 'propose_shared' then
    new.state := 'submitted';
  end if;
  if new.state in ('submitted', 'returned', 'rejected', 'unpublished') and new.visibility_choice <> 'propose_shared' then
    raise exception 'Only items proposed to the community go through review' using errcode = 'P0001';
  end if;

  v_step := old.state || '>' || new.state;
  v_action := case
    when v_step = 'draft>draft' and v_author then 'save'
    when v_step = 'draft>published' and v_author and new.visibility_choice = 'org' then 'share_org'
    when v_step = 'draft>submitted' and v_author then 'submit'
    when v_step = 'returned>submitted' and v_author and not v_edit then 'resubmit'
    when v_step in ('returned>submitted', 'submitted>submitted', 'published>submitted', 'published>published')
         and v_author and v_edit then 'amend'
    when v_step in ('submitted>returned', 'submitted>rejected') and v_mod
         and char_length(trim(coalesce(new.moderator_reason, ''))) >= 5
      then case new.state when 'returned' then 'return' else 'reject' end
    when v_step = 'submitted>published' and v_mod then 'publish'
    when v_step = 'published>unpublished' and v_mod then 'unpublish'
    when v_step = 'unpublished>published' and v_mod then 'restore'
    when new.state = 'withdrawn' and old.state in ('submitted', 'returned', 'published', 'unpublished')
         and (v_author or v_mod) then 'withdraw'
  end;
  if v_action is null then
    raise exception 'Illegal transition % for this user', v_step using errcode = 'P0001';
  end if;

  if new.state = 'submitted' and v_action in ('submit', 'resubmit', 'amend') then
    select c.store, c.publish into v_store, v_publish
    from public.consents c where c.contribution_id = new.id order by c.id desc limit 1;
    if not coalesce(v_store and v_publish, false) then
      raise exception 'Consent to store and publish is required before review' using errcode = 'P0001';
    end if;
    new.moderator_reason := null;
  end if;

  if v_edit and old.state <> 'draft' then
    insert into public.contribution_versions (contribution_id, version, snapshot)
    values (old.id, old.version, to_jsonb(old));
    new.version := old.version + 1;
  end if;

  new.last_action := v_action;
  new.updated_at := now();
  return new;
end $$;

create or replace function public.contrib_events()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
declare
  v_payload jsonb;
begin
  if new.last_action in ('create', 'save') then
    return null;
  end if;
  insert into public.moderation_events (contribution_id, actor_id, action, from_state, to_state, version, reason)
  values (new.id, auth.uid(), new.last_action, old.state, new.state, new.version,
          case when new.last_action in ('return', 'reject') then new.moderator_reason end);

  v_payload := jsonb_build_object('contribution_id', new.id, 'org_id', new.org_id, 'title', new.title,
                                  'action', new.last_action, 'state', new.state, 'version', new.version);
  insert into public.notifications (user_id, kind, payload)
  values (new.author_id, 'contribution.' || new.last_action, v_payload);

  -- moderators hear about anything entering review (never drafts or org-only items)
  if new.state = 'submitted' then
    insert into public.notifications (user_id, kind, payload)
    select distinct g.user_id, 'review.pending', v_payload - 'org_id'
    from public.grants g
    join public.memberships m on m.user_id = g.user_id and m.status = 'active' and m.role = 'employee'
    where g.kind = 'moderate' and g.user_id <> new.author_id;
  end if;
  return null;
end $$;
revoke all on function public.contrib_guard(), public.contrib_events() from public;

create trigger contributions_guard before insert or update on public.contributions
  for each row execute function public.contrib_guard();
create trigger contributions_events after update on public.contributions
  for each row execute function public.contrib_events();
create trigger contributions_audit after insert or update or delete on public.contributions
  for each row execute function public.audit_row();
create trigger consents_audit after insert on public.consents
  for each row execute function public.audit_row();

-- ── privileges + RLS ─────────────────────────────────────────────────────
alter table public.contributions enable row level security;
alter table public.contribution_versions enable row level security;
alter table public.consents enable row level security;
alter table public.moderation_events enable row level security;
alter table public.notifications enable row level security;

revoke all on public.contributions, public.contribution_versions, public.consents,
  public.moderation_events, public.notifications from anon, authenticated;

grant select, delete on public.contributions to authenticated;
grant insert (org_id, type, title, body, offering_id, industry, region, period_start, period_end,
              evidence_type, confidence, visibility_choice) on public.contributions to authenticated;
grant update (type, title, body, offering_id, industry, region, period_start, period_end,
              evidence_type, confidence, visibility_choice, state, moderator_reason) on public.contributions to authenticated;
grant select on public.contribution_versions, public.moderation_events to authenticated;
grant select, insert (contribution_id, store, publish, attribute, train) on public.consents to authenticated;
grant select, update (read_at) on public.notifications to authenticated;

-- Moderators never see drafts, private notes, org-only items or withdrawn items.
create policy contributions_select on public.contributions for select to authenticated using (
  author_id = (select auth.uid())
  or (visibility_choice <> 'private' and state not in ('draft', 'withdrawn') and public.is_member(org_id))
  or (visibility_choice = 'propose_shared' and state not in ('draft', 'withdrawn') and public.has_grant('moderate'))
);
create policy contributions_insert on public.contributions for insert to authenticated
  with check (author_id = (select auth.uid()) and public.is_member(org_id) and state = 'draft' and version = 1);
create policy contributions_update on public.contributions for update to authenticated
  using (
    author_id = (select auth.uid())
    or (visibility_choice = 'propose_shared' and state not in ('draft', 'withdrawn') and public.has_grant('moderate'))
  )
  with check (author_id = (select auth.uid()) or public.has_grant('moderate'));
-- Unshared drafts can be discarded; anything that was ever visible is withdrawn instead.
create policy contributions_delete on public.contributions for delete to authenticated
  using (author_id = (select auth.uid()) and state = 'draft');

create policy versions_select on public.contribution_versions for select to authenticated
  using (exists (select 1 from public.contributions c where c.id = contribution_versions.contribution_id));

create policy consents_select on public.consents for select to authenticated using (
  exists (select 1 from public.contributions c where c.id = consents.contribution_id
          and (c.author_id = (select auth.uid()) or public.has_grant('moderate')))
);
-- Consent can change only before review; after that the author withdraws.
create policy consents_insert on public.consents for insert to authenticated with check (
  actor = (select auth.uid())
  and exists (select 1 from public.contributions c where c.id = consents.contribution_id
              and c.author_id = (select auth.uid()) and c.state in ('draft', 'returned'))
);

create policy moderation_events_select on public.moderation_events for select to authenticated using (
  exists (select 1 from public.contributions c where c.id = moderation_events.contribution_id
          and (c.author_id = (select auth.uid()) or public.has_grant('moderate')))
);

create policy notifications_select on public.notifications for select to authenticated
  using (user_id = (select auth.uid()));
create policy notifications_update on public.notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ── client sandboxes: runs isolated per tenant + user, only for the org's entitled offerings ──
drop policy playground_insert on public.playground_runs;
create policy playground_insert on public.playground_runs for insert to authenticated with check (
  user_id = (select auth.uid()) and (
    (org_id is null and public.is_employee())
    or (org_id is not null and public.is_member(org_id) and exists (
      select 1 from public.entitlements e
      where e.org_id = playground_runs.org_id and e.offering_id = playground_runs.offering_id))
  )
);

-- ── realtime: each user may only subscribe to their own notification channel ──
insert into realtime.channels (pattern, description, enabled)
values ('notify:%', 'Per-user in-app notifications', true)
on conflict (pattern) do update set description = excluded.description, enabled = excluded.enabled;

alter table realtime.channels enable row level security;
create policy notify_own_channel on realtime.channels for select to authenticated using (
  pattern = 'notify:%' and realtime.channel_name() = 'notify:' || (select auth.uid())::text
);
-- No client publishes: only the trigger below writes notification events.
alter table realtime.messages enable row level security;

create or replace function public.notifications_publish()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
begin
  perform realtime.publish('notify:' || new.user_id::text, 'notification',
    jsonb_build_object('id', new.id, 'kind', new.kind, 'payload', new.payload, 'at', new.at));
  return null;
end $$;
revoke all on function public.notifications_publish() from public;
create trigger notifications_realtime after insert on public.notifications
  for each row execute function public.notifications_publish();
