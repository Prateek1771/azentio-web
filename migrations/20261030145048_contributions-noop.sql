-- Phase 5 · Saving an unchanged form is a no-op, not an "illegal transition".
-- Fires before contributions_guard (triggers run in name order) and skips the row entirely.
create or replace function public.contrib_skip_noop()
returns trigger language plpgsql
set search_path = pg_catalog, public, pg_temp as $$
begin
  if (new.type, new.title, new.body, new.offering_id, new.industry, new.region, new.period_start, new.period_end,
      new.evidence_type, new.confidence, new.visibility_choice, new.state, new.moderator_reason)
     is not distinct from
     (old.type, old.title, old.body, old.offering_id, old.industry, old.region, old.period_start, old.period_end,
      old.evidence_type, old.confidence, old.visibility_choice, old.state, old.moderator_reason) then
    return null;
  end if;
  return new;
end $$;
create trigger contributions_a_skip_noop before update on public.contributions
  for each row execute function public.contrib_skip_noop();
