# Build phases

The phase-by-phase plan for building the azentio.ai portal. Requirement IDs refer to the [PRD](PRD.md); designs are in the [HLD](HLD.md), [LLD](LLD.md) and [user flows](USER_FLOWS.md).

Each phase lists the deliverables, the requirement IDs (from the PRD) it covers, and **exit criteria** that must pass before the next phase starts. P0 phases (1–6) are the judged minimum. Phases 7–8 are P1, and phase 9 is P2.

## Phase 0: Foundation & setup
- **Goal:** a running skeleton wired to the real backend.
- **Tasks:**
  - Install the Next.js 16 deps: `@insforge/sdk`, `openai`, `zod`, shadcn/ui, `lucide-react`, `framer-motion`.
  - Port the design tokens (`docs/design/tokens.css`) into `globals.css` and the Tailwind theme.
  - Build the base components (Button, Card, Eyebrow, PageHero, Section, Form fields, Tabs, Badge, EmptyState) and the header/footer/mega-menu shells from the prototype.
  - Set up SSR auth (`lib/insforge/{server,client}.ts`, `/api/auth/refresh`, `proxy.ts` with `updateSession`).
  - Create `.env.example`, a lint and typecheck script, and Playwright.
- **Exit:**
  - `npm run build` passes.
  - The home shell renders with the prototype look.
  - The server client can query InsForge.

## Phase 1: Data model, RLS & audit (security core)
- **Goal:** all authorisation lives in the database before any UI.
- **Tasks:**
  - Migrations: core tables (orgs, memberships, grants, allow-list, invitations, offerings, entitlements, content, media, live_sessions, terms).
  - RLS helpers (`is_member`, `has_grant`, `is_employee`, `entitled`), all SECURITY DEFINER with a pinned `search_path`.
  - Per-operation policies and column grants.
  - Append-only `audit_log` via triggers.
  - Seed script with ≥ 3 synthetic client orgs, an employee/moderator (your email on the allow-list), and client admins/members.
  - Provisioning is keyed by **email** (`employee_allowlist`, `provisioned_access`). `claim_provisioned_access()` binds it to the signed-in, *verified* user, so nothing is ever written to `auth`.
  - AIRA guardrail tables + baseline rules (`guardrail_rules`, `aira_interactions`, `guardrail_events`). See [AIRA guardrails](AIRA_GUARDRAILS.md).
  - RLS test matrix (`npm run test:rls`) that sends real API requests as anon and as each persona. Raw SQL can't switch roles on InsForge, so it uses verified demo accounts.
- **Covers:** AUTH-01/02/03/08
- **Exit:** the RLS test matrix passes. Client A can never read client B rows, and a moderator can't read drafts.

## Phase 2: Authentication & onboarding
- **Tasks:**
  - Email OTP login (request/verify server actions, rate-limited).
  - Employee gate: verified email + allow-list → membership.
  - Invitations: hashed, single-use, expiring, bound to the email.
  - Terms and sharing-explanation screen ("joining ≠ consent").
  - Active-workspace cookie + switcher.
  - `lib/authz.ts` guards (`requireUser`, `requireMembership`, `requireGrant`) used by every route group.
  - Sign-out.
  - **Demo login buttons** for the admin roles (portal admin, moderator, publisher, product owner, client admins). They sign in on the server with passwords from `.env.local` and only appear when `DEMO_LOGIN_ENABLED=true`.
- **Covers:** AUTH-04/05/06/07
- **Exit:**
  - An uninvited external email gets no membership.
  - An expired or reused invite fails.
  - A multi-org user switches workspace.

## Phase 3: Public website
- **Tasks:**
  - Port all prototype public routes and copy: home (carousel, capability flip cards, featured products, media band, trust, news, CTA), products + 8 product pages, solutions, lab, technology, media, insights, about.
  - `/connect` and `/hackathon/register` as persisted, validated, honeypot + rate-limited server actions.
  - AIRA launcher shell.
  - SEO metadata, reduced-motion support, AA contrast.
- **Covers:** PUB-01/02
- **Exit:**
  - Lighthouse a11y ≥ 95.
  - Forms store rows.
  - Protected routes redirect to login.

## Phase 4: Employee portal
- **Tasks:**
  - `/e` dashboard.
  - Guided Playground: offering → synthetic inputs → deterministic/AI-assisted run → evidence → structured feedback. "Simulated" labels, runs saved to `playground_runs`.
  - Internal Live + recordings (audience-gated, served through `/api/media/[id]` with signed URLs).
  - Publisher workspace `/s/publisher`: the prototype's configurator, gated by the `publish_media` grant (stream, recordings, homepage banners).
- **Covers:** EMP-01/02/03, PUB-03
- **Exit:**
  - A client or the public gets 403 on employee pages, APIs and media URLs.
  - An ordinary employee can't edit broadcasts.

## Phase 5: Client portal & contribution lifecycle
- **Tasks:**
  - `/c/[org]` dashboard with real empty states; entitled sandboxes (tenant-isolated runs).
  - Contribution form (structured fields, client + server zod validation, sensitive-data guidance, PII rules scan).
  - My / Our-org observations.
  - Sharing choice + 4 consents.
  - Lifecycle state-machine trigger with versions.
  - "Who can see this" panel.
  - Withdraw and amend-returned.
  - In-app notifications (realtime).
- **Covers:** CLI-01/02/03, LRN-01–07, LRN-10, LRN-13, LRN-16
- **Exit:**
  - Save never shares.
  - Every illegal transition is rejected by the DB.
  - A material edit creates a new version and goes back to review.

## Phase 6: Moderation, shared learning, themes & ideas
- **Tasks:**
  - Moderation queue (source vs editable shared copy, PII flags): clarify / reject / publish (writes `shared_contributions` with reviewed fields only).
  - Report → temporary unpublish → decision.
  - Withdraw-purge (sync, cache revalidation).
  - Shared feed with FTS + filters (offering, industry, region, period, topic).
  - Theme dashboard with k ≥ 3 distinct-org suppression.
  - Improvement ideas (audited statuses, evidence links, audience-safe public updates).
  - Client ideas view.
- **Covers:** CLI-04/06, LRN-08/09/11/12, INS-01–04
- **Exit:**
  - The brief's SME-seasonality scenario runs end to end.
  - Withdrawal disappears from feed and themes in ≤ 60 s.
  - The shared payload contains no tenant ID, notes or attachments.

**Checkpoint (P0 complete):** full access-matrix + lifecycle suites green → deploy to Vercel.

## Phase 7: P1 collaboration features
- **Tasks:**
  - Email via outbox (idempotent; "delivered" only on provider confirmation).
  - Client admin invite/revoke + role assignment (no escalation).
  - Comments (inherit audience), bookmarks, saved searches, acknowledgements.
  - Attachments (private bucket, type/size limits).
  - Quality feedback.
  - Client briefings, release notes, webinars.
  - Employee experiments, team spaces, knowledge library.
- **Covers:** CLI-05/07/08, LRN-14/15, EMP-05, INS-06
- **Exit:** escalation attempts are blocked by RLS, and the email retry doesn't double-send.

## Phase 8: AIRA & AI assists
- **Guardrails:** implement G1–G15 from [AIRA guardrails](AIRA_GUARDRAILS.md). They're layered, deterministic first, and fail closed.
- **Tasks:**
  - `embed-published` function.
  - `/api/aira`: RLS-scoped pgvector retrieval → OpenAI → citation ⊆ retrieved IDs + red-line regex guard → streamed answer with source cards, or "not enough evidence".
  - Interaction logging + feedback.
  - Moderator redaction suggestions (diff, suggestion-only).
  - LLM PII second pass.
  - Duplicate detection.
  - Theme clustering job + LLM naming (PO confirms).
  - Trend digests.
  - `evals/` taxonomy + 30-question gold set.
  - Nightly H.I.R.E. metrics.
- **Covers:** AI-01–05, INS-05
- **Exit:**
  - Gold set: 0 red lines, 100% valid citations.
  - A withdrawn item is never cited.

## Phase 9: Federated learning track (P2)
- **Tasks:**
  - `fl/`: synthetic data for 3 isolated clients, numpy model, FedAvg with clipping/validation and a dropout round.
  - Global holdout vs local-only vs a reference oracle.
  - Metadata-only logs synced to `fl_*` tables.
  - Candidate model registry with human approve/rollback UI at `/e/fl`.
  - Programme opt-in via train consent.
  - `THREAT_MODEL.md`.
- **Covers:** FL-01–06
- **Exit:**
  - Federated beats the local-only baseline.
  - The dropout run completes.
  - Logs contain no training rows.

## Phase 10: Hardening, deploy & demo
- **Tasks:**
  - Full Playwright acceptance suite (8 personas × resources, including direct API/media/URL guessing).
  - InsForge advisor scan clean.
  - Rate limits, error pages, observability (audit UI, AIRA metrics page).
  - Production deploy.
  - Demo script following USER_FLOWS §4.7.
  - README final pass.
- **Exit:** every PRD §1.7 success metric is met and recorded.

## Traceability summary
| Phase | Requirement IDs |
|---|---|
| 1–2 | AUTH-01…08 |
| 3 | PUB-01/02 |
| 4 | EMP-01…03, PUB-03 |
| 5 | CLI-01…03, LRN-01…07, 10, 13, 16 |
| 6 | CLI-04/06, LRN-08/09/11/12, INS-01…04 |
| 7 | CLI-05/07/08, LRN-14/15, EMP-05, INS-06 |
| 8 | AI-01…05, INS-05 |
| 9 | FL-01…06 |
| 10 | NFRs, PRD §1.7 metrics |

Phases 1 → 2 → (3 ∥ 4) → 5 → 6 must run in this order. Phase 9 (`fl/`) is independent and can run in parallel at any time after Phase 1.
