-- Phase 8a · AIRA retrieval, extra guardrail rules, metrics. Retrieval is SECURITY INVOKER: the caller's
-- own RLS decides what AIRA can see (live, moderator-approved shared copies and confirmed themes only).

create or replace function public.match_shared(p_query text, p_limit int default 6)
returns table (id uuid, title text, body text, type public.contrib_type, offering_id uuid, industry text, region text,
               period_start date, period_end date, rank real)
language sql stable security invoker
set search_path = pg_catalog, public, pg_temp as $$
  with q as (
    select to_tsquery('english', nullif(array_to_string(array(
             select lexeme from unnest(to_tsvector('english', left(coalesce(p_query, ''), 1000)))), ' | '), '')) as any_term
  )
  select s.id, s.title, s.body, s.type, s.offering_id, s.industry, s.region, s.period_start, s.period_end,
         ts_rank_cd(s.tsv, q.any_term)::real as rank
  from public.shared_contributions s, q
  where q.any_term is not null and s.status = 'live' and s.tsv @@ q.any_term
  order by rank desc, s.published_at desc
  limit least(greatest(coalesce(p_limit, 6), 1), 10);
$$;

create or replace function public.match_themes(p_query text)
returns table (id uuid, name text, summary text, limitations text, rank real)
language sql stable security invoker
set search_path = pg_catalog, public, pg_temp as $$
  with q as (
    select to_tsquery('english', nullif(array_to_string(array(
             select lexeme from unnest(to_tsvector('english', left(coalesce(p_query, ''), 1000)))), ' | '), '')) as any_term
  )
  select t.id, t.name, t.summary, t.limitations, ts_rank_cd(to_tsvector('english', t.name || ' ' || t.summary), q.any_term)::real
  from public.themes t, q
  where q.any_term is not null and t.status = 'confirmed'
    and to_tsvector('english', t.name || ' ' || t.summary) @@ q.any_term
  order by 5 desc
  limit 3;
$$;
revoke all on function public.match_shared(text, int), public.match_themes(text) from public, anon;
grant execute on function public.match_shared(text, int), public.match_themes(text) to authenticated;

-- Additional rules (JS regexes, case-insensitive; editable by portal admins, audited).
insert into public.guardrail_rules (key, kind, stage, pattern, severity, description) values
  ('budget.daily_calls', 'limit', 'access', '200', 'medium', 'Model calls per day across AIRA (free-plan credit guard)'),
  ('retrieval.min_sources', 'limit', 'retrieval', '2', 'medium', 'Distinct approved sources needed before AIRA answers'),
  ('inject.encoded', 'regex', 'input', '[A-Za-z0-9+/]{40,}={0,2}|(\\x[0-9a-f]{2}){8,}|(%[0-9a-f]{2}){8,}', 'high', 'Encoded payload (base64 / hex / url-encoded)'),
  ('out.advice', 'regex', 'output', '\b(you should (approve|decline|reject|invest|lend)|we recommend (approving|declining|rejecting|investing)|(is|are) a (good|safe|sound) investment|legal advice)\b', 'high', 'Credit, investment or legal advice in the answer'),
  ('out.url', 'regex', 'output', 'https?://|www\.', 'medium', 'External links in the answer')
on conflict (key) do nothing;

-- Per-day verdict mix and feedback for the admin dashboard and the H.I.R.E. metrics (admins only).
create or replace function public.aira_metrics(p_days int default 14)
returns table (day date, total int, answered int, refused int, blocked int, no_evidence int, up int, down int, corrections int, red_lines int)
language sql stable security definer
set search_path = pg_catalog, public, pg_temp as $$
  select i.created_at::date, count(*)::int,
         count(*) filter (where verdict = 'answered')::int, count(*) filter (where verdict = 'refused')::int,
         count(*) filter (where verdict = 'blocked')::int, count(*) filter (where verdict = 'no_evidence')::int,
         count(*) filter (where feedback = 'up')::int, count(*) filter (where feedback = 'down')::int,
         count(*) filter (where feedback = 'correction')::int,
         -- a red line is an answer that reached a user despite a red-line hit: must always be 0
         count(*) filter (where verdict = 'answered' and red_line is not null)::int
  from public.aira_interactions i
  where public.has_grant('portal_admin') and i.created_at >= now() - make_interval(days => least(greatest(p_days, 1), 90))
  group by 1 order by 1 desc;
$$;
revoke all on function public.aira_metrics(int) from public, anon;
grant execute on function public.aira_metrics(int) to authenticated;

create index if not exists guardrail_events_interaction_idx on public.guardrail_events (interaction_id);
create index if not exists guardrail_events_user_idx on public.guardrail_events (user_id);
