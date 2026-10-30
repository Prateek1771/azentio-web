-- Withdrawing a reported item purges its shared copy, which nulls reports.shared_id (FK set null).
-- That system change must not trip the "already decided / cannot be edited" guard.
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
    return new;
  end if;
  if new.shared_id is null and old.shared_id is not null
     and (new.status, new.decision_note, new.reason) is not distinct from (old.status, old.decision_note, old.reason) then
    return new; -- purge cascade
  end if;
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
  return new;
end $$;
