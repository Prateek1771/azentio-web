-- Phase 10 · advisor: index the FL foreign keys (joins and cascades on org/run/user deletes).
create index if not exists fl_enrollments_org_id_idx on public.fl_enrollments (org_id);
create index if not exists fl_enrollments_consented_by_idx on public.fl_enrollments (consented_by);
create index if not exists fl_enrollments_withdrawn_by_idx on public.fl_enrollments (withdrawn_by);
create index if not exists model_registry_run_id_idx on public.model_registry (run_id);
create index if not exists model_registry_parent_id_idx on public.model_registry (parent_id);
create index if not exists model_registry_decided_by_idx on public.model_registry (decided_by);
