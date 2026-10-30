-- Phase 1 · audit trail. Trusted trigger writes; nobody (not even project admins via DML) can edit history.

create or replace function public.audit_row()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
declare
  v_before jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  v_after  jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
  v_id text := coalesce(v_after ->> 'id', v_before ->> 'id',
                        v_after ->> 'key', v_before ->> 'key',
                        v_after ->> 'email', v_before ->> 'email');
begin
  -- never copy secrets into the log
  v_before := v_before - 'token_hash';
  v_after := v_after - 'token_hash';
  insert into public.audit_log (actor_id, action, entity, entity_id, before, after)
  values (auth.uid(), lower(tg_op), tg_table_name, v_id, v_before, v_after);
  return coalesce(new, old);
end $$;
revoke all on function public.audit_row() from public;

do $$
declare t text;
begin
  foreach t in array array[
    'orgs', 'memberships', 'grants', 'employee_allowlist', 'provisioned_access', 'invitations',
    'entitlements', 'offerings', 'content', 'media', 'live_sessions', 'guardrail_rules'
  ] loop
    execute format(
      'create trigger %I after insert or update or delete on public.%I for each row execute function public.audit_row()',
      t || '_audit', t);
  end loop;
end $$;

create or replace function public.audit_log_immutable()
returns trigger language plpgsql as $$
begin
  raise exception 'audit_log is append-only';
end $$;
create trigger audit_log_no_update before update or delete on public.audit_log
  for each row execute function public.audit_log_immutable();
create trigger audit_log_no_truncate before truncate on public.audit_log
  for each statement execute function public.audit_log_immutable();
