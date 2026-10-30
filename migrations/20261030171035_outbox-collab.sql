-- Phase 7a · Email outbox, last-admin protection, comments, bookmarks, saved searches,
-- acknowledgements, quality feedback, contribution attachments, publisher org lookup.

-- ── email outbox: one row per event (idempotency key), claimed with skip-locked ──
create table public.outbox (
  id uuid primary key default gen_random_uuid(),
  idempotency_key text not null unique,
  to_email text not null,
  template text not null,
  payload jsonb not null default '{}',
  status text not null default 'queued' check (status in ('queued', 'sending', 'retry', 'sent', 'failed', 'unknown')),
  attempts int not null default 0,
  next_attempt_at timestamptz not null default now(),
  claimed_at timestamptz,
  provider_id text,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);
create index outbox_due_idx on public.outbox (next_attempt_at) where status in ('queued', 'retry');
create index outbox_status_idx on public.outbox (status, created_at desc);
alter table public.outbox enable row level security;
revoke all on public.outbox from anon, authenticated;

-- Notifications people need off-platform become emails (one per notification, ever).
create or replace function public.enqueue_notification_email()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
begin
  if new.kind in ('contribution.return', 'contribution.reject', 'contribution.publish', 'idea.update', 'report.decided') then
    insert into public.outbox (idempotency_key, to_email, template, payload)
    select 'notif:' || new.id, p.email, new.kind, new.payload
    from public.profiles p where p.user_id = new.user_id
    on conflict (idempotency_key) do nothing;
  end if;
  return null;
end $$;
revoke all on function public.enqueue_notification_email() from public;
create trigger notifications_email after insert on public.notifications
  for each row execute function public.enqueue_notification_email();

-- Worker claim. A row left in "sending" (worker crashed mid-send) becomes "unknown" and is never
-- retried automatically: that is what makes a retry unable to double-send.
create or replace function public.outbox_claim(p_limit int default 10)
returns setof public.outbox language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
begin
  update public.outbox set status = 'unknown', last_error = 'worker stopped mid-send; not retried to avoid a duplicate'
  where status = 'sending' and claimed_at < now() - interval '10 minutes';
  return query
  update public.outbox o set status = 'sending', attempts = o.attempts + 1, claimed_at = now()
  where o.id in (
    select id from public.outbox
    where status in ('queued', 'retry') and next_attempt_at <= now()
    order by created_at limit least(greatest(p_limit, 1), 50)
    for update skip locked
  )
  returning o.*;
end $$;
revoke all on function public.outbox_claim(int) from public, anon, authenticated;

create or replace function public.outbox_overview()
returns table (id uuid, to_email text, template text, status text, attempts int, last_error text, created_at timestamptz, sent_at timestamptz)
language sql stable security definer
set search_path = pg_catalog, public, pg_temp as $$
  select o.id, o.to_email, o.template, o.status, o.attempts, o.last_error, o.created_at, o.sent_at
  from public.outbox o where public.has_grant('portal_admin')
  order by o.created_at desc limit 100;
$$;
revoke all on function public.outbox_overview() from public, anon;
grant execute on function public.outbox_overview() to authenticated;

-- ── memberships: an org always keeps at least one active client admin ──
create or replace function public.guard_last_admin()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
begin
  -- service operations (no end-user session) such as org or account deletion are exempt
  if auth.uid() is null or old.role <> 'client_admin' or old.status <> 'active' then
    return coalesce(new, old);
  end if;
  if tg_op = 'UPDATE' and new.role = 'client_admin' and new.status = 'active' then
    return new;
  end if;
  if not exists (
    select 1 from public.memberships m
    where m.org_id = old.org_id and m.id <> old.id and m.role = 'client_admin' and m.status = 'active'
  ) then
    raise exception 'An organisation needs at least one active administrator' using errcode = 'P0001';
  end if;
  return coalesce(new, old);
end $$;
revoke all on function public.guard_last_admin() from public;
create trigger memberships_last_admin before update or delete on public.memberships
  for each row execute function public.guard_last_admin();

-- Publishers target client content at an org, so they may read org names.
create policy orgs_select_publisher on public.orgs for select to authenticated
  using (public.has_grant('publish_media'));

-- ── comments (audience inherited from the parent) ────────────────────────
create table public.comments (
  id uuid primary key default gen_random_uuid(),
  parent_type text not null check (parent_type in ('shared', 'content')),
  parent_id uuid not null,
  author_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  body text not null check (char_length(body) between 2 and 2000),
  hidden boolean not null default false,
  at timestamptz not null default now()
);
create index comments_parent_idx on public.comments (parent_type, parent_id, at);
create index comments_author_idx on public.comments (author_id);

create or replace function public.comment_guard()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
begin
  if jsonb_array_length(public.pii_scan(new.body)) > 0 then
    raise exception 'Comments cannot contain contact details, ID or account numbers' using errcode = 'P0001';
  end if;
  return new;
end $$;
create or replace function public.comment_notify()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
declare v_author uuid; v_title text;
begin
  if new.parent_type = 'shared' then
    select c.author_id, s.title into v_author, v_title
    from public.shared_contributions s join public.contributions c on c.id = s.source_id where s.id = new.parent_id;
    if v_author is not null and v_author <> new.author_id then
      insert into public.notifications (user_id, kind, payload)
      values (v_author, 'comment.new', jsonb_build_object('shared_id', new.parent_id, 'title', v_title));
    end if;
  end if;
  return null;
end $$;
revoke all on function public.comment_guard(), public.comment_notify() from public;
create trigger comments_guard before insert on public.comments for each row execute function public.comment_guard();
create trigger comments_notify after insert on public.comments for each row execute function public.comment_notify();

-- The thread re-checks parent visibility and returns labels, never author ids or other orgs' names.
create or replace function public.comment_thread(p_type text, p_id uuid)
returns table (id uuid, body text, at timestamptz, mine boolean, author_label text, hidden boolean)
language sql stable security definer
set search_path = pg_catalog, public, pg_temp as $$
  select c.id, c.body, c.at, c.author_id = auth.uid(),
         case
           when c.author_id = auth.uid() then 'You'
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
      else false
    end
  order by c.at;
$$;
revoke all on function public.comment_thread(text, uuid) from public, anon;
grant execute on function public.comment_thread(text, uuid) to authenticated;

-- ── own-row collections ──────────────────────────────────────────────────
create table public.bookmarks (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  shared_id uuid not null references public.shared_contributions (id) on delete cascade,
  at timestamptz not null default now(),
  primary key (user_id, shared_id)
);
create index bookmarks_shared_idx on public.bookmarks (shared_id);

create table public.saved_searches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  query jsonb not null,
  at timestamptz not null default now()
);
create index saved_searches_user_idx on public.saved_searches (user_id);

create table public.acknowledgements (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  content_id uuid not null references public.content (id) on delete cascade,
  at timestamptz not null default now(),
  primary key (user_id, content_id)
);
create index acknowledgements_content_idx on public.acknowledgements (content_id);

create table public.shared_feedback (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  shared_id uuid not null references public.shared_contributions (id) on delete cascade,
  kind text not null check (kind in ('useful', 'needs_evidence')),
  at timestamptz not null default now(),
  primary key (user_id, shared_id)
);
create index shared_feedback_shared_idx on public.shared_feedback (shared_id);

create or replace function public.ack_counts()
returns table (content_id uuid, acknowledged int)
language sql stable security definer
set search_path = pg_catalog, public, pg_temp as $$
  select a.content_id, count(*)::int from public.acknowledgements a
  where public.has_grant('publish_media') or public.has_grant('portal_admin')
  group by a.content_id;
$$;

-- Counts go only to moderators and to the contributor of that item: no public scores, no leaderboards.
create or replace function public.feedback_counts(p_contribution uuid default null)
returns table (shared_id uuid, useful int, needs_evidence int)
language sql stable security definer
set search_path = pg_catalog, public, pg_temp as $$
  select f.shared_id, count(*) filter (where f.kind = 'useful')::int, count(*) filter (where f.kind = 'needs_evidence')::int
  from public.shared_feedback f join public.shared_contributions s on s.id = f.shared_id
  where (p_contribution is null and public.has_grant('moderate'))
     or (s.source_id = p_contribution and exists (
           select 1 from public.contributions c where c.id = p_contribution and c.author_id = auth.uid()))
  group by f.shared_id;
$$;
revoke all on function public.ack_counts(), public.feedback_counts(uuid) from public, anon;
grant execute on function public.ack_counts(), public.feedback_counts(uuid) to authenticated;

-- ── attachments: same audience as the source contribution, never on the shared copy ──
create table public.contribution_attachments (
  id uuid primary key default gen_random_uuid(),
  contribution_id uuid not null references public.contributions (id) on delete cascade,
  storage_key text not null unique,
  name text not null check (char_length(name) between 1 and 200),
  mime text not null check (mime in ('application/pdf', 'image/png', 'image/jpeg', 'text/csv',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document')),
  size int not null check (size between 1 and 10485760),
  at timestamptz not null default now(),
  -- keys live under the contribution's own folder, so a row can't point at someone else's file
  check (storage_key like contribution_id::text || '/%')
);
create index contribution_attachments_contribution_idx on public.contribution_attachments (contribution_id);

create or replace function public.attachment_limit()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
begin
  if (select count(*) from public.contribution_attachments where contribution_id = new.contribution_id) >= 5 then
    raise exception 'A contribution can have at most 5 attachments' using errcode = 'P0001';
  end if;
  return new;
end $$;
revoke all on function public.attachment_limit() from public;
create trigger contribution_attachments_limit before insert on public.contribution_attachments
  for each row execute function public.attachment_limit();

-- ── privileges + RLS ─────────────────────────────────────────────────────
alter table public.comments enable row level security;
alter table public.bookmarks enable row level security;
alter table public.saved_searches enable row level security;
alter table public.acknowledgements enable row level security;
alter table public.shared_feedback enable row level security;
alter table public.contribution_attachments enable row level security;
revoke all on public.comments, public.bookmarks, public.saved_searches, public.acknowledgements,
  public.shared_feedback, public.contribution_attachments from anon, authenticated;

grant select, delete on public.comments to authenticated;
grant insert (parent_type, parent_id, body) on public.comments to authenticated;
grant update (hidden) on public.comments to authenticated;
create policy comments_select on public.comments for select to authenticated
  using (author_id = (select auth.uid()) or public.has_grant('moderate'));
create policy comments_insert on public.comments for insert to authenticated with check (
  author_id = (select auth.uid()) and case parent_type
    when 'shared' then exists (select 1 from public.shared_contributions s where s.id = comments.parent_id)
    when 'content' then exists (select 1 from public.content t where t.id = comments.parent_id and t.published)
    else false end
);
create policy comments_delete on public.comments for delete to authenticated
  using (author_id = (select auth.uid()) or public.has_grant('moderate'));
create policy comments_hide on public.comments for update to authenticated
  using (public.has_grant('moderate')) with check (public.has_grant('moderate'));

grant select, insert (shared_id), delete on public.bookmarks to authenticated;
create policy bookmarks_own on public.bookmarks for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and exists (select 1 from public.shared_contributions s where s.id = bookmarks.shared_id));

grant select, insert (name, query), delete on public.saved_searches to authenticated;
create policy saved_searches_own on public.saved_searches for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

grant select, insert (content_id), delete on public.acknowledgements to authenticated;
create policy acknowledgements_own on public.acknowledgements for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and exists (select 1 from public.content t where t.id = acknowledgements.content_id and t.published));

grant select, insert (shared_id, kind), update (kind), delete on public.shared_feedback to authenticated;
create policy shared_feedback_own on public.shared_feedback for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and exists (select 1 from public.shared_contributions s where s.id = shared_feedback.shared_id));

grant select, insert (contribution_id, storage_key, name, mime, size), delete on public.contribution_attachments to authenticated;
create policy attachments_select on public.contribution_attachments for select to authenticated
  using (exists (select 1 from public.contributions c where c.id = contribution_attachments.contribution_id));
create policy attachments_write on public.contribution_attachments for insert to authenticated with check (
  exists (select 1 from public.contributions c where c.id = contribution_attachments.contribution_id
          and c.author_id = (select auth.uid()) and c.state in ('draft', 'returned'))
);
create policy attachments_delete on public.contribution_attachments for delete to authenticated using (
  exists (select 1 from public.contributions c where c.id = contribution_attachments.contribution_id
          and c.author_id = (select auth.uid()) and c.state in ('draft', 'returned'))
);

do $$
declare t text;
begin
  foreach t in array array['comments', 'contribution_attachments', 'acknowledgements'] loop
    execute format(
      'create trigger %I after insert or update or delete on public.%I for each row execute function public.audit_row()',
      t || '_audit', t);
  end loop;
end $$;
