-- Phase 1 · core schema. Authorisation lives in RLS (next migrations); this file is structure only.
-- Contribution / moderation / idea tables arrive with Phases 5-6.

create extension if not exists pgcrypto;

-- ── enums (all created now so later phases never alter types) ─────────────
create type public.org_kind as enum ('azentio', 'client');
create type public.member_role as enum ('employee', 'client_member', 'client_admin');
create type public.member_status as enum ('active', 'revoked');
create type public.grant_kind as enum ('publish_media', 'moderate', 'invite', 'manage_roles', 'product_owner', 'portal_admin');
create type public.audience as enum ('public', 'employee', 'client_entitled', 'org_private');
create type public.content_kind as enum ('page', 'insight', 'banner', 'release_note', 'briefing', 'library', 'experiment');
create type public.contrib_type as enum ('observation', 'trend', 'gap', 'challenge', 'practice', 'suggestion');
create type public.visibility_choice as enum ('private', 'org', 'propose_shared');
create type public.contrib_state as enum ('draft', 'submitted', 'returned', 'published', 'unpublished', 'rejected', 'withdrawn');
create type public.idea_status as enum ('proposed', 'under_review', 'planned', 'in_progress', 'released', 'not_proceeding');

-- ── identity & tenancy ───────────────────────────────────────────────────
create table public.orgs (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,60}$'),
  name text not null check (char_length(name) between 2 and 120),
  kind public.org_kind not null,
  industry text,
  region text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- exactly one Azentio (employee) organisation
create unique index orgs_single_azentio on public.orgs (kind) where kind = 'azentio';

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) <= 120),
  email text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  org_id uuid not null references public.orgs (id) on delete cascade,
  role public.member_role not null,
  status public.member_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, org_id)
);
create index memberships_org_idx on public.memberships (org_id);

create table public.grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind public.grant_kind not null,
  granted_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (user_id, kind)
);

-- Pre-provisioning keyed by email; bound to a user id on first verified sign-in.
create table public.employee_allowlist (
  email text primary key check (email = lower(email) and email like '%@%'),
  approved_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.provisioned_access (
  id uuid primary key default gen_random_uuid(),
  email text not null check (email = lower(email) and email like '%@%'),
  org_id uuid not null references public.orgs (id) on delete cascade,
  role public.member_role not null,
  grants public.grant_kind[] not null default '{}',
  claimed_by uuid references auth.users (id) on delete set null,
  claimed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (email, org_id)
);

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs (id) on delete cascade,
  email text not null check (email = lower(email) and email like '%@%'),
  role public.member_role not null check (role in ('client_member', 'client_admin')),
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  used_by uuid references auth.users (id) on delete set null,
  revoked_at timestamptz,
  invited_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index invitations_org_idx on public.invitations (org_id);

create table public.terms_acceptance (
  user_id uuid not null references auth.users (id) on delete cascade,
  org_id uuid not null references public.orgs (id) on delete cascade,
  version text not null,
  accepted_at timestamptz not null default now(),
  primary key (user_id, org_id, version)
);

-- ── catalogue & audience-scoped content ──────────────────────────────────
create table public.offerings (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,60}$'),
  name text not null,
  category text not null,
  headline text,
  summary text,
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.entitlements (
  org_id uuid not null references public.orgs (id) on delete cascade,
  offering_id uuid not null references public.offerings (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (org_id, offering_id)
);
create index entitlements_offering_idx on public.entitlements (offering_id);

create table public.content (
  id uuid primary key default gen_random_uuid(),
  kind public.content_kind not null,
  slug text,
  title text not null check (char_length(title) between 1 and 200),
  body text not null default '',
  audience public.audience not null,
  offering_id uuid references public.offerings (id) on delete cascade,
  org_id uuid references public.orgs (id) on delete cascade,
  owner_id uuid references auth.users (id) on delete set null,
  review_date date,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (audience <> 'org_private' or org_id is not null),
  check (audience <> 'client_entitled' or offering_id is not null)
);
create index content_audience_idx on public.content (audience, published);
create index content_org_idx on public.content (org_id);
create index content_offering_idx on public.content (offering_id);

create table public.media (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 200),
  summary text,
  storage_key text,          -- private bucket object (served via /api/media/[id])
  embed_url text,            -- or an external embed (YouTube/Vimeo/MP4)
  audience public.audience not null,
  offering_id uuid references public.offerings (id) on delete cascade,
  org_id uuid references public.orgs (id) on delete cascade,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (storage_key is not null or embed_url is not null),
  check (audience <> 'org_private' or org_id is not null),
  check (audience <> 'client_entitled' or offering_id is not null)
);
create index media_audience_idx on public.media (audience, published);

create table public.live_sessions (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  audience public.audience not null,
  offering_id uuid references public.offerings (id) on delete cascade,
  org_id uuid references public.orgs (id) on delete cascade,
  embed_url text,
  starts_at timestamptz,
  is_live boolean not null default false,
  recording_media_id uuid references public.media (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (audience <> 'org_private' or org_id is not null),
  check (audience <> 'client_entitled' or offering_id is not null)
);
create index live_sessions_audience_idx on public.live_sessions (audience);

-- ── public forms (write-only for visitors) ───────────────────────────────
create table public.demo_requests (
  id uuid primary key default gen_random_uuid(),
  interest text not null check (interest in ('demo', 'collaboration', 'challenge', 'general')),
  name text not null check (char_length(name) between 1 and 120),
  email text not null check (char_length(email) <= 254 and email like '%@%'),
  organisation text check (char_length(organisation) <= 160),
  message text check (char_length(message) <= 4000),
  created_at timestamptz not null default now()
);

create table public.event_registrations (
  id uuid primary key default gen_random_uuid(),
  event text not null default 'hackathon-2026',
  name text not null check (char_length(name) between 1 and 120),
  email text not null check (char_length(email) <= 254 and email like '%@%'),
  consent boolean not null check (consent),
  created_at timestamptz not null default now()
);
create unique index event_registrations_once on public.event_registrations (event, lower(email));

-- ── audit (append-only; written only by trusted triggers) ────────────────
create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid,
  action text not null,
  entity text not null,
  entity_id text,
  before jsonb,
  after jsonb,
  at timestamptz not null default now()
);
create index audit_log_entity_idx on public.audit_log (entity, entity_id);
create index audit_log_at_idx on public.audit_log (at desc);

-- ── AIRA guardrails (chatbot ships in Phase 8; controls are data-model citizens now) ─
create table public.guardrail_rules (
  key text primary key check (key ~ '^[a-z0-9_.-]{2,80}$'),
  kind text not null check (kind in ('regex', 'phrase', 'org_name', 'flag', 'limit')),
  stage text not null check (stage in ('access', 'input', 'retrieval', 'output')),
  pattern text not null,
  severity text not null default 'high' check (severity in ('low', 'medium', 'high', 'critical')),
  enabled boolean not null default true,
  description text,
  updated_at timestamptz not null default now()
);

create table public.aira_interactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  org_id uuid references public.orgs (id) on delete set null,
  question text not null check (char_length(question) <= 1000),
  retrieved_ids uuid[] not null default '{}',
  cited_ids uuid[] not null default '{}',
  answer text,
  verdict text not null check (verdict in ('answered', 'refused', 'blocked', 'no_evidence')),
  red_line text,
  feedback text check (feedback in ('up', 'down', 'correction')),
  model text,
  latency_ms integer,
  created_at timestamptz not null default now()
);
create index aira_interactions_user_idx on public.aira_interactions (user_id, created_at desc);

create table public.guardrail_events (
  id uuid primary key default gen_random_uuid(),
  interaction_id uuid references public.aira_interactions (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  stage text not null check (stage in ('access', 'input', 'retrieval', 'output')),
  rule_key text not null,
  severity text not null check (severity in ('low', 'medium', 'high', 'critical')),
  detail jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index guardrail_events_at_idx on public.guardrail_events (created_at desc);

-- ── updated_at maintenance ───────────────────────────────────────────────
create trigger orgs_updated_at before update on public.orgs for each row execute function system.update_updated_at();
create trigger profiles_updated_at before update on public.profiles for each row execute function system.update_updated_at();
create trigger memberships_updated_at before update on public.memberships for each row execute function system.update_updated_at();
create trigger offerings_updated_at before update on public.offerings for each row execute function system.update_updated_at();
create trigger content_updated_at before update on public.content for each row execute function system.update_updated_at();
create trigger media_updated_at before update on public.media for each row execute function system.update_updated_at();
create trigger live_sessions_updated_at before update on public.live_sessions for each row execute function system.update_updated_at();
create trigger guardrail_rules_updated_at before update on public.guardrail_rules for each row execute function system.update_updated_at();
