-- Pairwise trigram similarity between live shared copies the caller can see (theme suggestions).
-- ponytail: O(n^2) over at most 200 recent copies; move to embeddings + ANN if the corpus outgrows it.
create or replace function public.shared_pairs(p_threshold real default 0.2)
returns table (a uuid, b uuid, similarity real)
language sql stable security invoker
set search_path = pg_catalog, public, pg_temp as $$
  with s as (
    select id, title || ' ' || body as doc from public.shared_contributions
    where status = 'live' order by published_at desc limit 200
  )
  select x.id, y.id, similarity(x.doc, y.doc)::real
  from s x join s y on x.id < y.id
  where similarity(x.doc, y.doc) >= greatest(p_threshold, 0.1);
$$;
revoke all on function public.shared_pairs(real) from public, anon;
grant execute on function public.shared_pairs(real) to authenticated;
