-- Phase 4 · Playground runs + safe embed URLs for media and live sessions.

create table public.playground_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  org_id uuid references public.orgs (id) on delete cascade,      -- client sandboxes (Phase 5)
  offering_id uuid not null references public.offerings (id) on delete cascade,
  scenario_key text not null check (scenario_key ~ '^[a-z0-9-]{2,60}$'),
  mode text not null check (mode in ('deterministic', 'ai_assisted')),
  inputs jsonb not null,
  output jsonb not null,
  feedback jsonb check (
    feedback is null or (
      jsonb_typeof(feedback -> 'useful') = 'boolean'
      and (feedback ->> 'rating')::int between 1 and 5
      and char_length(coalesce(feedback ->> 'comment', '')) <= 1000
    )
  ),
  created_at timestamptz not null default now()
);
create index playground_runs_user_idx on public.playground_runs (user_id, created_at desc);
create index playground_runs_offering_idx on public.playground_runs (offering_id);
create index playground_runs_org_idx on public.playground_runs (org_id);

alter table public.playground_runs enable row level security;
revoke all on public.playground_runs from anon, authenticated;
grant select, insert on public.playground_runs to authenticated;
grant update (feedback) on public.playground_runs to authenticated;

create policy playground_select on public.playground_runs for select to authenticated
  using (user_id = (select auth.uid()) or public.has_grant('portal_admin'));
create policy playground_insert on public.playground_runs for insert to authenticated
  with check (user_id = (select auth.uid()) and org_id is null and public.is_employee());
create policy playground_feedback on public.playground_runs for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Only https embeds from known players, or direct mp4/webm. Blocks javascript:/data: and arbitrary iframes.
create or replace function public.guard_embed_url()
returns trigger language plpgsql
set search_path = pg_catalog, public, pg_temp as $$
begin
  if new.embed_url is not null and not (
    new.embed_url ~ '^https://(www\.)?youtube(-nocookie)?\.com/embed/[A-Za-z0-9_-]{6,20}([?][^\s<>"]*)?$'
    or new.embed_url ~ '^https://player\.vimeo\.com/video/[0-9]{3,15}([?][^\s<>"]*)?$'
    or new.embed_url ~ '^https://player\.twitch\.tv/[?][^\s<>"]+$'
    or new.embed_url ~* '^https://[^\s<>"/]+/[^\s<>"]+\.(mp4|webm)([?][^\s<>"]*)?$'
  ) then
    raise exception 'embed_url must be a YouTube, Vimeo or Twitch player URL, or a direct https mp4/webm' using errcode = '22023';
  end if;
  return new;
end $$;
create trigger media_embed_guard before insert or update of embed_url on public.media
  for each row execute function public.guard_embed_url();
create trigger live_sessions_embed_guard before insert or update of embed_url on public.live_sessions
  for each row execute function public.guard_embed_url();

-- At most one session is "live" at a time.
create unique index live_sessions_one_live on public.live_sessions ((true)) where is_live;

create trigger playground_runs_audit after insert or update or delete on public.playground_runs
  for each row execute function public.audit_row();
