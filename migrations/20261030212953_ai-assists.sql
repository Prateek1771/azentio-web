-- Phase 8b · Duplicate detection with trigram similarity (free, deterministic, no embeddings).
create extension if not exists pg_trgm;

create index if not exists shared_contributions_trgm_idx on public.shared_contributions
  using gin ((title || ' ' || body) gin_trgm_ops);

-- SECURITY INVOKER: the caller only ever compares against shared copies they can already see.
create or replace function public.similar_shared(p_text text, p_limit int default 5)
returns table (id uuid, title text, similarity real)
language sql stable security invoker
set search_path = pg_catalog, public, pg_temp as $$
  select s.id, s.title, similarity(s.title || ' ' || s.body, left(coalesce(p_text, ''), 5000))::real
  from public.shared_contributions s
  where (s.title || ' ' || s.body) % left(coalesce(p_text, ''), 5000)
  order by 3 desc
  limit least(greatest(coalesce(p_limit, 5), 1), 10);
$$;
revoke all on function public.similar_shared(text, int) from public, anon;
grant execute on function public.similar_shared(text, int) to authenticated;
