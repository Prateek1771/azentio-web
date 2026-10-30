-- Phase 9 · Federated learning programme (P2): opt-in enrolment with its own train consent, metadata-only
-- run/round logs, candidate model registry with human approval and rollback.
-- Training rows never reach these tables: the coordinator only syncs params, participants, norms and metrics.

create table public.fl_programs (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  task text not null,
  description text,
  min_participants int not null default 2 check (min_participants >= 2),
  created_at timestamptz not null default now()
);

-- Programme enrolment is its own consent (FL-01). It is never inferred from membership or from
-- per-contribution consents. Withdrawal stops future rounds; the row stays for lineage.
create table public.fl_enrollments (
  program_id uuid not null references public.fl_programs (id) on delete cascade,
  org_id uuid not null references public.orgs (id) on delete cascade,
  consent_train boolean not null check (consent_train),
  consented_by uuid references auth.users (id) on delete set null,
  consent_at timestamptz not null default now(),
  withdrawn_by uuid references auth.users (id) on delete set null,
  withdrawn_at timestamptz,
  primary key (program_id, org_id)
);

create table public.fl_runs (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.fl_programs (id) on delete cascade,
  params jsonb not null,
  aggregation text not null,
  participants text[] not null,
  comparison jsonb not null,
  skew jsonb not null,
  finished_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index fl_runs_program_idx on public.fl_runs (program_id, created_at desc);

create table public.fl_rounds (
  run_id uuid not null references public.fl_runs (id) on delete cascade,
  n int not null,
  status text not null,
  participants text[] not null,
  dropped text[] not null default '{}',
  rejected jsonb not null default '{}',
  clipped text[] not null default '{}',
  update_norms jsonb not null default '{}',
  weights_n jsonb not null default '{}',
  holdout jsonb not null,
  primary key (run_id, n)
);

create table public.model_registry (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.fl_programs (id) on delete cascade,
  run_id uuid not null references public.fl_runs (id) on delete restrict,
  version int not null,
  parent_id uuid references public.model_registry (id),
  status text not null default 'candidate' check (status in ('candidate', 'approved', 'rejected', 'retired')),
  metrics jsonb not null,
  weights float8[] not null,
  weights_sha256 text not null,
  approved_at timestamptz,
  decided_by uuid references auth.users (id) on delete set null,
  decided_at timestamptz,
  note text check (char_length(note) <= 1000),
  created_at timestamptz not null default now(),
  unique (program_id, version)
);
-- one deployed model per programme
create unique index model_registry_one_approved on public.model_registry (program_id) where status = 'approved';

-- ── RLS: employees read everything; clients see programmes and their own org's enrolment ──
alter table public.fl_programs enable row level security;
alter table public.fl_enrollments enable row level security;
alter table public.fl_runs enable row level security;
alter table public.fl_rounds enable row level security;
alter table public.model_registry enable row level security;
revoke all on public.fl_programs, public.fl_enrollments, public.fl_runs, public.fl_rounds, public.model_registry from anon, authenticated;
grant select on public.fl_programs, public.fl_enrollments, public.fl_runs, public.fl_rounds, public.model_registry to authenticated;

create policy fl_programs_select on public.fl_programs for select to authenticated
  using ((select public.is_employee()) or (select public.is_client_user()));
create policy fl_enrollments_select on public.fl_enrollments for select to authenticated
  using ((select public.is_employee()) or public.is_member(org_id));
create policy fl_runs_select on public.fl_runs for select to authenticated using ((select public.is_employee()));
create policy fl_rounds_select on public.fl_rounds for select to authenticated using ((select public.is_employee()));
create policy model_registry_select on public.model_registry for select to authenticated using ((select public.is_employee()));
-- Writes: enrolment and decisions go through the RPCs below; runs/rounds/candidates only via the service key.

-- ── enrolment: a client admin opts their own org in, with explicit train consent ──
create or replace function public.fl_enroll(p_program uuid, p_org uuid, p_consent boolean)
returns void language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
begin
  if not public.is_org_admin(p_org) then
    raise exception 'fl_enroll: only a client admin of this organisation can enrol it' using errcode = '42501';
  end if;
  if p_consent is not true then
    raise exception 'fl_enroll: Model-training consent is required to join the programme';
  end if;
  insert into public.fl_enrollments (program_id, org_id, consent_train, consented_by, consent_at)
  values (p_program, p_org, true, auth.uid(), now())
  on conflict (program_id, org_id) do update
    set consent_train = true, consented_by = auth.uid(), consent_at = now(), withdrawn_by = null, withdrawn_at = null;
end $$;

create or replace function public.fl_withdraw(p_program uuid, p_org uuid)
returns void language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
begin
  if not public.is_org_admin(p_org) then
    raise exception 'fl_withdraw: only a client admin of this organisation can withdraw it' using errcode = '42501';
  end if;
  update public.fl_enrollments set withdrawn_by = auth.uid(), withdrawn_at = now()
  where program_id = p_program and org_id = p_org and withdrawn_at is null;
end $$;

-- ── registry decisions: portal admins only; a human always makes the deployment call ──
create or replace function public.fl_decide(p_id uuid, p_status text, p_note text default null)
returns void language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
declare m public.model_registry;
begin
  if not public.has_grant('portal_admin') then
    raise exception 'fl_decide: only a portal admin can approve or reject models' using errcode = '42501';
  end if;
  if p_status not in ('approved', 'rejected') then
    raise exception 'fl_decide: Decision must be approved or rejected';
  end if;
  select * into m from public.model_registry where id = p_id for update;
  if m.id is null or m.status <> 'candidate' then
    raise exception 'fl_decide: Only a candidate model can be decided';
  end if;
  if p_status = 'approved' then
    update public.model_registry set status = 'retired', decided_by = auth.uid(), decided_at = now()
    where program_id = m.program_id and status = 'approved';
  end if;
  update public.model_registry
  set status = p_status, decided_by = auth.uid(), decided_at = now(), note = nullif(trim(p_note), ''),
      approved_at = case when p_status = 'approved' then now() else approved_at end
  where id = p_id;
end $$;

-- Rollback re-pins the most recently approved version before the current one (a stack, by approved_at).
create or replace function public.fl_rollback(p_program uuid, p_note text default null)
returns void language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
declare cur public.model_registry; prev uuid;
begin
  if not public.has_grant('portal_admin') then
    raise exception 'fl_rollback: only a portal admin can roll back models' using errcode = '42501';
  end if;
  select * into cur from public.model_registry where program_id = p_program and status = 'approved' for update;
  if cur.id is null then
    raise exception 'fl_rollback: No approved model to roll back';
  end if;
  select id into prev from public.model_registry
  where program_id = p_program and status = 'retired' and approved_at < cur.approved_at
  order by approved_at desc limit 1;
  if prev is null then
    raise exception 'fl_rollback: No earlier approved version to roll back to';
  end if;
  update public.model_registry set status = 'retired', decided_by = auth.uid(), decided_at = now(),
    note = coalesce(nullif(trim(p_note), ''), 'rolled back') where id = cur.id;
  update public.model_registry set status = 'approved', decided_by = auth.uid(), decided_at = now() where id = prev;
end $$;

revoke all on function public.fl_enroll(uuid, uuid, boolean), public.fl_withdraw(uuid, uuid),
  public.fl_decide(uuid, text, text), public.fl_rollback(uuid, text) from public, anon;
grant execute on function public.fl_enroll(uuid, uuid, boolean), public.fl_withdraw(uuid, uuid),
  public.fl_decide(uuid, text, text), public.fl_rollback(uuid, text) to authenticated;

do $$
declare t text;
begin
  foreach t in array array['fl_programs', 'fl_enrollments', 'fl_runs', 'model_registry'] loop
    execute format(
      'create trigger %I after insert or update or delete on public.%I for each row execute function public.audit_row()',
      t || '_audit', t);
  end loop;
end $$;
