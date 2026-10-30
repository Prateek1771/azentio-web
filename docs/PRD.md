# azentio.ai portal: PRD (Product Requirements Document)

## 1.1 Problem
Azentio sells AI products for banking, finance and insurance. Today it has no single place to:
- show offerings publicly
- give employees and clients their own secure spaces
- turn what clients see in the market into product improvements

That last one has to happen without leaking one client's confidential information to another.

## 1.2 Goals
| # | Goal | Measure |
|---|---|---|
| G1 | Public visitors understand offerings and convert | Demo requests and event registrations submitted |
| G2 | Employees and clients get distinct, exclusive experiences | 0 access-matrix test failures |
| G3 | Client observations become governed shared learning | Draft → published flow works; median moderation time shown |
| G4 | Learning drives product change | Themes linked to improvement ideas, with audited status |
| G5 | Trust: no private data leaks | Red-line rate 0; withdrawal purge ≤ 60 s |
| G6 | (P2) Credible federated-learning demo | Federated model beats the local-only baseline on the holdout |

## 1.3 Non-goals
- Building the real credit, reporting or document-processing products
- Billing and production customer-system integrations
- Deploying client-trained models to production
- Regulatory certification
- Real client data (everything is synthetic)

## 1.4 Personas
| Persona | Needs | Must never |
|---|---|---|
| Public visitor | Learn offerings, watch media, request a demo, register for an event | See private workspaces, observations or internal broadcasts |
| Employee | Internal dashboard, Playground, Live, experiments, assigned ideas | Get admin by default, or see every client's private data |
| Client member | Own-org workspace, entitled demos, contribute observations, read shared learning | See other tenants' data or employee-only tools |
| Client admin | Invite/revoke own-org members, assign client roles | Grant platform roles, touch other tenants, self-enable products |
| Learning moderator | Review, redact, publish, reject, withdraw, handle reports | Read unsubmitted private drafts |
| Content publisher | Banners, public content, video audiences | Administer identity or read private learning |
| Product owner (employee grant) | Themes → ideas → status updates | Access evidence that wasn't shared to them |
| Portal admin | Orgs, roles, config, ops | Read private client content without an explicit audited authorisation |

## 1.5 Functional requirements
Priority: **P0** = must ship for judging, **P1** = should ship, **P2** = advanced track.

**Access & identity (AUTH)**
| ID | Requirement | Pri |
|---|---|---|
| AUTH-01 | Server-side RBAC + tenant membership + resource audience + product entitlement, checked on every page, API and media request | P0 |
| AUTH-02 | Deny by default. Public content is explicitly marked `public`. | P0 |
| AUTH-03 | Separate grants: publish_media, moderate, invite, manage_roles, product_owner, portal_admin | P0 |
| AUTH-04 | Employee login: email OTP for `@azentio.com` **plus** an approved provisioning record | P0 |
| AUTH-05 | Client join only by a single-use, expiring invitation bound to the invited email | P0 |
| AUTH-06 | Terms + learning-sharing explanation on first join. Joining ≠ consent to share or train. | P0 |
| AUTH-07 | Multi-membership users choose an active workspace; the switcher shows the current org | P0 |
| AUTH-08 | Every privileged action is audited | P0 |
| AUTH-09 | Entra ID OIDC as an optional provider (documented, not built) | P2 |

**Public website (PUB)**
| ID | Requirement | Pri |
|---|---|---|
| PUB-01 | Home, offerings catalogue, solutions, approved media, insights, about | P0 |
| PUB-02 | Demo request form and hackathon/event registration (validated, stored, spam-limited) | P0 |
| PUB-03 | Publisher-managed banners and public content | P1 |

**Employee portal (EMP)**
| ID | Requirement | Pri |
|---|---|---|
| EMP-01 | Dashboard: quick links to Playground, Live, experiments, assigned ideas, learning work | P0 |
| EMP-02 | Guided Playground: pick an offering → inspect synthetic inputs → run deterministic/AI demo → evidence → structured feedback. "Simulated" labels everywhere. | P0 |
| EMP-03 | Internal Live/recordings restricted to employees; only publishers can configure them | P0 |
| EMP-04 | Product owner: review themes, create ideas, link evidence, update status | P0 |
| EMP-05 | Experiment submissions, hackathon team spaces, release notes, knowledge library (owner, review date) | P1 |

**Client portal (CLI)**
| ID | Requirement | Pri |
|---|---|---|
| CLI-01 | Dashboard: active org, entitled offerings, demos, sessions, contribution status, visible ideas. Real empty states. | P0 |
| CLI-02 | Entitled sandboxes with runs isolated per tenant and user | P0 |
| CLI-03 | My observations / Our org's observations, visually distinct from the shared feed | P0 |
| CLI-04 | Shared feed search with filters (offering, industry, region, period, topic). Counts follow visibility. | P0 |
| CLI-05 | Client admin: invite, revoke, assign client roles; show membership and invite states | P1 |
| CLI-06 | Improvement-idea status in plain language (owner/team, last update) | P0 |
| CLI-07 | Saved searches, bookmarks, notifications, comments (inherit audience), acknowledgements, client resources | P1 |
| CLI-08 | Client briefings, release notes, invite-only webinars | P1 |

**Collective learning (LRN)**
| ID | Requirement | Pri |
|---|---|---|
| LRN-01 | Structured contribution form: type (observation / trend / gap / challenge / practice / suggestion), offering, industry, region, period, evidence type, confidence, body | P0 |
| LRN-02 | Starts as a private draft. Save never shares. | P0 |
| LRN-03 | Client + server validation (required fields, lengths) | P0 |
| LRN-04 | Sharing choice: private / my org / propose to community | P0 |
| LRN-05 | 4 separate consents: store, publish, attribute, train. Consent history kept. | P0 |
| LRN-06 | Sensitive-content warning + rules scan that flags items for moderators | P0 |
| LRN-07 | Lifecycle with explicit transitions + audit (see LLD §3.3) | P0 |
| LRN-08 | Moderator: redact the shared copy, request clarification, reject, publish | P0 |
| LRN-09 | Published copy holds only reviewed fields (no tenant ID, notes, attachments) | P0 |
| LRN-10 | Material edit → new version → re-review. The audience never widens silently. | P0 |
| LRN-11 | Report contribution → moderator can temporarily unpublish → decision recorded | P0 |
| LRN-12 | Withdraw → purge search, index, cache and AIRA within ≤ 60 s | P0 |
| LRN-13 | In-app notifications on every state change | P0 |
| LRN-14 | Email via outbox, idempotent. "Delivered" shown only after provider confirmation. | P1 |
| LRN-15 | Attachments (type/size limits, private bucket, same audience) | P1 |
| LRN-16 | "Who can see this version" panel for the contributor | P0 |

**Insights & improvement (INS)**
| ID | Requirement | Pri |
|---|---|---|
| INS-01 | Theme dashboard: theme, offerings, linked evidence, period, distinct-org count (only when ≥ k=3), confidence/limitations, last update | P0 |
| INS-02 | Repeated posts from one org count once | P0 |
| INS-03 | Improvement ideas: title, problem, offering, evidence refs, outcome, owner/team, priority, status (Proposed / Under review / Planned / In progress / Released / Not proceeding). Audited. | P0 |
| INS-04 | Audience-safe status updates to contributors | P0 |
| INS-05 | Semantic clustering, duplicate detection, trend summaries, digests, assisted prioritisation | P1 |
| INS-06 | Quality feedback (useful / needs evidence), transparent moderation reasons, no leaderboards | P1 |

**AIRA assistant (AI)**
| ID | Requirement | Pri |
|---|---|---|
| AI-01 | RAG Q&A over published shared contributions and themes the caller can see. Every answer cites its sources. | P1 |
| AI-02 | Says "not enough evidence" below the source threshold | P1 |
| AI-03 | Inline red-line guard blocks the answer before display (see H.I.R.E. section) | P1 |
| AI-04 | Interactions logged; nightly metrics (UCR, PPR, DIY, IRR, RLR); gold-set CI | P1 |
| AI-05 | Employee-only content never enters a client/public AIRA index | P0 (by design) |

**Federated learning (FL)**
| ID | Requirement | Pri |
|---|---|---|
| FL-01 | Separate opt-in programme, consent = `consents.train` + programme enrolment | P2 |
| FL-02 | ≥ 3 isolated synthetic client datasets with a documented task, model and feature schema | P2 |
| FL-03 | Local training → aggregation round → global eval on a holdout vs baseline | P2 |
| FL-04 | Update validation, norm clipping, dropout scenario, skew explanation | P2 |
| FL-05 | Metadata-only logs; candidate model registry; human approval; rollback | P2 |
| FL-06 | Threat model doc; honest labels for simulated controls; withdrawal and lineage policy | P2 |

## 1.6 Non-functional requirements
- **Security:** RLS on every table; per-user DB client (no service key in request paths); signed media URLs (TTL ≤ 5 min); CSRF-safe server actions; rate limits on OTP, forms and AIRA; OWASP top-10 checks.
- **Privacy:** private sources are never embedded or sent to OpenAI; only published shared text is. Logs scrub bodies. Synthetic data only.
- **Performance:** page TTFB < 500 ms p95 on Vercel; feed search < 300 ms; AIRA first token < 3 s.
- **Accessibility:** WCAG 2.2 AA, keyboard navigable, honours reduced motion.
- **Reliability:** AIRA down → feed search still works; outbox retries with backoff.
- **Auditability:** append-only audit log for grants, moderation, status changes and FL runs.
- **Production SLA (to state in the docs):** withdrawal propagation ≤ 60 s.

## 1.7 Success metrics (demo)
- Access matrix: 100% pass
- Withdrawal: ≤ 60 s
- AIRA: RLR 0%, citation validity 100%, IRR > 60%
- Scenario walkthrough completes end to end
- FL beats the local-only baseline

## 1.8 Release plan
| Phase | Content |
|---|---|
| 0 | Setup, prototype and competitor research, design system, seed data |
| 1 (P0) | Schema/RLS, auth, public site, employee and client portals, contribution lifecycle, moderation, feed, themes, ideas, in-app notifications |
| 2 (P1) | Email outbox, client admin, comments/bookmarks/saved searches, AIRA + evals, AI suggestions, clustering |
| 3 (P2) | Federated learning track |
| 4 | Acceptance suite, hardening, deploy, demo script |

## 1.9 Risks
| Risk | Mitigation |
|---|---|
| RLS bug leaks across tenants | Access-matrix tests on every PR |
| De-identification misses rare details | Moderator HITL + LLM suggestion + rules scan; nothing auto-publishes |
| AIRA hallucinates or cites the wrong item | Citations validated against the retrieved allowed set before display |
| Gaps in InsForge features (pgvector, email OTP restrictions) | Verify in Phase 0; fallback: Resend for email, plain FTS for search |
| P2 scope creep | FL is an isolated `fl/` module and can't block P0/P1 |

## 1.10 Open questions for you
1. Do you have a real `@azentio.com` mailbox for testing employee login, or should I use an allow-list of test emails?
2. Brand assets (logo, colours) beyond the prototype?
3. What's the deadline? It decides how much of P1 is in scope.
