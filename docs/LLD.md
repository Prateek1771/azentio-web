# azentio.ai portal: LLD (Low-Level Design)

## 3.1 Repository layout
```
azentio/
  app/
    (public)/            page.tsx, offerings/[slug], solutions, media, insights, about, demo, events
    (auth)/              login, verify, invite/[token], onboarding/terms, workspace/select
    (employee)/e/        dashboard, playground/[offering], live, experiments, ideas, library, fl
    (client)/c/[orgSlug]/ dashboard, sandboxes/[offering], observations/{mine,org,new,[id]}, learning, ideas, admin/members
    (staff)/s/           moderation/{queue,[id]}, reports, publisher/{banners,content,media}, admin/{orgs,users,grants,audit}, themes
    api/aira/route.ts    api/media/[id]/route.ts   api/outbox/callback/route.ts
  components/ui (shadcn), components/portal/*
  lib/ insforge/{server,client}.ts, authz.ts, validation/*.ts (zod), pii-rules.ts, aira/{retrieve,guard,prompt}.ts
  db/migrations/0001_core.sql 0002_rls.sql 0003_lifecycle.sql 0004_audit.sql 0005_search.sql
  functions/ withdraw-purge, embed-published, outbox-worker, cluster-themes, aira-metrics
  evals/ taxonomy.yaml, aira_gold.jsonl, run_gold.ts
  fl/ coordinator.py, client.py, data_gen.py, model.py, eval.py, docker-compose.yml, THREAT_MODEL.md
  scripts/seed.ts   tests/{access-matrix,lifecycle,withdrawal,aggregation}.spec.ts
  docs/ PRD.md HLD.md LLD.md USER_FLOWS.md
```

## 3.2 Database schema (core)
```sql
-- enums
org_kind: azentio | client
member_role: employee | client_member | client_admin
grant_kind: publish_media | moderate | invite | manage_roles | product_owner | portal_admin
audience: public | employee | client_entitled | org_private
contrib_type: observation | trend | gap | challenge | practice | suggestion
visibility_choice: private | org | propose_shared
contrib_state: draft | submitted | returned | published | unpublished | rejected | withdrawn
idea_status: proposed | under_review | planned | in_progress | released | not_proceeding

orgs(id uuid pk, slug unique, name, kind org_kind, industry, region, created_at)
profiles(user_id pk → auth.users, display_name, email)
memberships(id, user_id, org_id, role member_role, status active|revoked, unique(user_id,org_id))
grants(id, user_id, grant grant_kind, granted_by, created_at, unique(user_id,grant))
employee_allowlist(email pk, approved_by, created_at)
invitations(id, org_id, email, role, token_hash, expires_at, used_at, invited_by)
offerings(id, slug, name, summary, is_public)
entitlements(org_id, offering_id, pk(org_id,offering_id))
content(id, kind page|insight|banner|release_note|briefing|library, title, body, audience, offering_id?, org_id?, owner, review_date, published)
media(id, storage_key, title, audience, org_id?, offering_id?)
live_sessions(id, title, audience, org_id?, starts_at, stream_url_key, recording_media_id?)
terms_acceptance(user_id, org_id, version, accepted_at)

contributions(id, org_id, author_id, type, title, body, offering_id, industry, region,
  period_start, period_end, evidence_type, confidence low|med|high, visibility_choice,
  state contrib_state default 'draft', version int default 1, pii_flags jsonb, created_at, updated_at)
contribution_versions(contribution_id, version, snapshot jsonb, created_at)
consents(id, contribution_id, store bool, publish bool, attribute bool, train bool, actor, at)  -- append-only history
moderation_events(id, contribution_id, actor_id, action, reason, note_internal, at)
shared_contributions(id, source_id unique, source_version, title, body, type, offering_id,
  industry, region, period_label, attributed_org_name null, published_at,
  tsv tsvector generated, embedding vector(1536))
  -- deliberately NO org_id / author_id columns
shared_org_link(shared_id, org_id)   -- service-only table for distinct-org counts; no RLS read for users
reports(id, shared_id, reporter_id, reason, status open|upheld|dismissed, decision_note, at)
themes(id, name, summary, limitations, confidence, offering_ids uuid[], status draft|confirmed, updated_at)
theme_links(theme_id, shared_id)
ideas(id, title, problem, offering_id, proposed_outcome, owner_id, team, priority, status idea_status,
  public_update text, updated_at)
idea_evidence(idea_id, shared_id)
idea_status_history(idea_id, from_status, to_status, actor_id, at)
comments(id, parent_type, parent_id, author_id, body, at)       -- audience inherited via parent RLS
bookmarks, saved_searches(user_id, query jsonb)
notifications(id, user_id, kind, payload jsonb, read_at, at)
outbox(id, idempotency_key unique, channel email, to, template, payload, status queued|sent|delivered|failed, attempts)
audit_log(id, actor_id, action, entity, entity_id, before jsonb, after jsonb, at)  -- insert-only
playground_runs(id, user_id, org_id?, offering_id, inputs jsonb, output jsonb, feedback jsonb)
aira_interactions(id, user_id, audience_scope, question, retrieved_ids uuid[], cited_ids uuid[],
  answer, blocked bool, red_line text?, feedback up|down|correction?, at)
fl_programs, fl_enrollments(org_id, consent_at), fl_runs, fl_rounds(run_id, n, participants, metrics jsonb),
model_registry(id, run_id, version, status candidate|approved|rejected|retired, approved_by, metrics)
```

## 3.3 Lifecycle state machine (enforced by the `contrib_transition()` trigger)
| From | Action | To | Who |
|---|---|---|---|
| draft | submit (`visibility_choice=propose_shared` needs `consents.publish`) | submitted | author |
| draft | save | draft | author |
| submitted | request_clarification | returned | moderator |
| returned | amend + resubmit | submitted | author |
| submitted | publish (writes shared row) | published | moderator |
| submitted | reject (reason required) | rejected | moderator |
| published | report upheld temporarily | unpublished | moderator |
| unpublished | restore | published | moderator |
| published / unpublished / submitted | withdraw | withdrawn | author or moderator |
| published | material edit | submitted (version+1, shared row deleted until re-published) | author |

`org`-visibility items skip moderation: they stay `draft`/`org_visible` and are readable only by same-org members via RLS. Any other transition raises an exception, and every transition writes `audit_log` + `moderation_events` + `notifications`.

## 3.4 RLS policies (representative)
```sql
-- helpers (SECURITY DEFINER, stable)
is_member(org uuid) := exists(select 1 from memberships where user_id=auth.uid() and org_id=org and status='active')
has_grant(g grant_kind) := exists(select 1 from grants where user_id=auth.uid() and grant=g)
is_employee() := exists(membership in azentio org with role='employee')
entitled(off uuid) := exists(entitlements e join memberships m on e.org_id=m.org_id where m.user_id=auth.uid() and e.offering_id=off)

contributions SELECT: author_id=auth.uid()
   OR (visibility_choice in ('org','propose_shared') and is_member(org_id) and state<>'draft' or visibility_choice='org')
   OR (has_grant('moderate') and state <> 'draft')      -- moderators never see drafts
contributions INSERT: author_id=auth.uid() and is_member(org_id) and state='draft'
shared_contributions SELECT: auth.uid() is not null and (is_employee() or exists client membership)
content SELECT: audience='public' or (audience='employee' and is_employee())
   or (audience='client_entitled' and entitled(offering_id)) or (audience='org_private' and is_member(org_id))
grants INSERT: has_grant('manage_roles') and has_grant('portal_admin')
memberships INSERT/UPDATE by client_admin: same org AND role in ('client_member','client_admin')
audit_log: INSERT via trigger only; SELECT has_grant('portal_admin')
```

## 3.5 Server-side API surface (server actions / route handlers)
| Name | Input (zod) | Checks | Effect |
|---|---|---|---|
| `requestOtp(email)` | email | rate-limit 5/15min | InsForge `signInWithOtp` |
| `verifyOtp(email, code)` | | employee allow-list or pending invite | session cookie |
| `acceptInvite(token)` | token | hash match, unexpired, unused, email == verified | membership + terms gate |
| `setActiveWorkspace(orgId)` | uuid | `is_member` | httpOnly cookie |
| `saveDraft / submitContribution` | ContributionSchema | membership, lengths, PII scan | row + consents + transition |
| `moderate(id, action, payload)` | | `has_grant('moderate')` | transition; publish → shared row + embed |
| `withdraw(id)` | | author or moderator | transition → purge (sync) |
| `report(sharedId, reason)` | | authenticated | report row; notify moderators |
| `upsertIdea / setIdeaStatus` | IdeaSchema | `product_owner` | idea + history |
| `inviteMember / revokeMember` | | client_admin of the same org, allowed role | invitation + outbox |
| `GET /api/media/[id]` | | audience check | 302 to signed URL (TTL 300 s) |
| `POST /api/aira` | {question} | auth, rate-limit 20/h | streamed, guarded answer |

## 3.6 AIRA pipeline
1. Embed the question (`OPENAI_EMBED_MODEL`).
2. `select … from shared_contributions order by embedding <=> $1 limit 8` with the **user's** RLS client. Results below the similarity threshold are dropped.
3. If fewer than 2 sources → "Not enough approved evidence" + feed link.
4. Prompt: system rules (answer only from sources, cite `[S1]`, no dates/commitments, no org names) + numbered sources.
5. Guard: parse the cited IDs ⊆ retrieved IDs; regex red lines (PII, "will be released by", tenant names from a server-side list); on fail → blocked answer, `red_line` logged.
6. Stream to the UI with source cards; capture feedback (👍 / 👎 / "that's wrong").

## 3.7 Withdrawal purge (`withdraw-purge`, called synchronously)
Delete `shared_contributions` (cascades to embeddings, theme_links, idea_evidence soft-flag) → recompute the affected theme counts → `revalidateTag('feed','themes')` → audit. A test asserts that search and AIRA miss the item within 60 s.

## 3.8 Aggregation rule
```sql
select theme_id, case when count(distinct org_id) >= :k then count(distinct org_id) end as orgs
from theme_links tl join shared_org_link s using(shared_id) group by theme_id
```
Runs through a SECURITY DEFINER function that returns only suppressed aggregates. Filters that would narrow the cohort below k return "suppressed".

## 3.9 PII rules (`lib/pii-rules.ts`)
Regexes: card numbers (Luhn), IBAN, account-number-like 9–18 digit runs, emails, phones, national-ID patterns, a "confidential" keyword list, and currency amounts with a precise date. Hits are stored in `pii_flags` → badge in the moderator UI. The LLM second pass adds `{field, span, reason}` suggestions only.

## 3.10 Federated learning module
- `data_gen.py`: 3 synthetic SME portfolios with different seasonality skews. Features: monthly inflows (12), sector, size, tenure. Label: 90-day cash-flow stress.
- `model.py`: small MLP (PyTorch). `client.py`: Flower NumPyClient that trains locally, clips the update norm to C, returns weights + n.
- `coordinator.py`: FedAvg weighted by n, validates update shapes and norms (rejects outliers), min 2 of 3 participants, simulates dropout of client C in round 3.
- `eval.py`: global holdout; compares federated vs a local-only model per client vs a centralised oracle (labelled "for reference only").
- Sync: per-round metadata to `fl_rounds`; the final model goes to `model_registry` as `candidate`; the admin approves in the UI; rollback re-pins the previous approved version.

## 3.11 Testing
- Playwright: access matrix (8 personas × resource types, including direct API/media/URL guessing), lifecycle, withdrawal timer, aggregation suppression, escalation attempts
- SQL tests: RLS assertions per role via `set request.jwt.claims`
- AIRA gold set in CI; `agent_metrics.py` nightly
- FL: `pytest fl/` (shapes, clipping, dropout path)
