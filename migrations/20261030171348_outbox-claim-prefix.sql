-- Optional key prefix so a test worker only ever claims its own rows (never real queued email).
drop function public.outbox_claim(int);
create or replace function public.outbox_claim(p_limit int default 10, p_key_prefix text default null)
returns setof public.outbox language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
begin
  update public.outbox set status = 'unknown', last_error = 'worker stopped mid-send; not retried to avoid a duplicate'
  where status = 'sending' and claimed_at < now() - interval '10 minutes'
    and (p_key_prefix is null or idempotency_key like p_key_prefix || '%');
  return query
  update public.outbox o set status = 'sending', attempts = o.attempts + 1, claimed_at = now()
  where o.id in (
    select id from public.outbox
    where status in ('queued', 'retry') and next_attempt_at <= now()
      and (p_key_prefix is null or idempotency_key like p_key_prefix || '%')
    order by created_at limit least(greatest(p_limit, 1), 50)
    for update skip locked
  )
  returning o.*;
end $$;
revoke all on function public.outbox_claim(int, text) from public, anon, authenticated;
