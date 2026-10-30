-- Moderators and contributors work from the source contribution, so counts carry it (never to other members).
drop function public.feedback_counts(uuid);
create or replace function public.feedback_counts(p_contribution uuid default null)
returns table (contribution_id uuid, useful int, needs_evidence int)
language sql stable security definer
set search_path = pg_catalog, public, pg_temp as $$
  select s.source_id, count(*) filter (where f.kind = 'useful')::int, count(*) filter (where f.kind = 'needs_evidence')::int
  from public.shared_feedback f join public.shared_contributions s on s.id = f.shared_id
  where (public.has_grant('moderate') and (p_contribution is null or s.source_id = p_contribution))
     or (s.source_id = p_contribution and exists (
           select 1 from public.contributions c where c.id = p_contribution and c.author_id = auth.uid()))
  group by s.source_id;
$$;
revoke all on function public.feedback_counts(uuid) from public, anon;
grant execute on function public.feedback_counts(uuid) to authenticated;
