# azentio.ai: Website & Intelligent Collaboration Portal

Enterprise AI website and secure collaboration portal for Azentio, built for the azentio.ai hackathon.
It has three audiences:
- public visitors, who discover offerings
- employees, who get an internal playground, live sessions and experiments
- client organisations, who get private workspaces

The core is a governed collective-learning loop: clients contribute market observations, moderators
de-identify and publish them, themes roll up into improvement ideas, and AIRA (an AI assistant) answers
questions with citations to approved evidence only.

> Status: **planning complete, build starting** (see [Build phases](docs/BUILD_PHASES.md)).

## Highlights
- **Server-enforced access:** Postgres RLS + tenant membership + separate grants. Nothing is trusted from the browser.
- **Contribution lifecycle:** draft → submitted → returned ⇄ submitted → published / rejected → withdrawn. Every transition is audited.
- **Privacy by design:** published copies hold only reviewed fields, 4 separate consents (store / publish / attribute / train), trend counts suppressed below 3 organisations, withdrawal purged in ≤ 60 s.
- **AIRA:** read-only RAG over published shared learning (OpenAI), with an inline citation and red-line guard. Evaluated with the H.I.R.E. framework.
- **Federated learning (P2):** opt-in demo with 3 isolated synthetic client datasets, FedAvg, update clipping/validation, dropout, and a candidate model registry with human approval.

## Tech stack
| Layer | Choice |
|---|---|
| Web | Next.js 16 (App Router, TypeScript), Tailwind CSS, shadcn/ui |
| Backend | InsForge: Postgres + RLS, Auth (email OTP), Storage, Functions, Schedules, Realtime |
| AI | OpenAI (chat + `text-embedding-3-small`), pgvector |
| Federated learning | Python (numpy / Flower) in `fl/` |
| Tests | Playwright, SQL RLS tests, AIRA gold set |
| Hosting | Vercel (web) + InsForge cloud |

## Repository layout
```text
web/          Next.js app (public site, employee portal, client portal, staff consoles, API routes)
migrations/   InsForge SQL migrations (schema, RLS, lifecycle, audit, search)
functions/    InsForge edge functions (withdraw-purge, embed, outbox, clustering)
fl/           Federated-learning demo (P2)
evals/        AIRA taxonomy + gold set
docs/         PRD, HLD, LLD, user flows, requirements, build phases, design system
```

## Documentation
| Doc | What's inside |
|---|---|
| [Requirements](docs/REQUIREMENTS.md) | The hackathon brief in Markdown |
| [PRD](docs/PRD.md) | Goals, personas, requirement IDs with priority, NFRs, metrics |
| [HLD](docs/HLD.md) | Architecture, trust boundaries, data flows, AI (H.I.R.E.) evaluation |
| [LLD](docs/LLD.md) | Schema, state machine, RLS, API surface, AIRA / purge / FL design |
| [User flows](docs/USER_FLOWS.md) | Mermaid flows per persona |
| [Build phases](docs/BUILD_PHASES.md) | Phase-by-phase plan with exit criteria |
| [AIRA guardrails](docs/AIRA_GUARDRAILS.md) | Layered chatbot guardrails (G1–G15), pipeline, data contract |
| [Design system](docs/design/DESIGN_SYSTEM.md) | Tokens, components, voice (from the reference prototype) |
| [Routes](docs/design/ROUTES.md) | Prototype sitemap → our route map |

## Getting started
Requirements: Node 20+, npm, Python 3.11+ (for `fl/`), an InsForge project, an OpenAI API key.

```bash
cd web
npm install
cp .env.example .env.local   # fill in the values below
npm run dev                  # http://localhost:3100
```

| Variable | Where it's used |
|---|---|
| `NEXT_PUBLIC_INSFORGE_URL`, `NEXT_PUBLIC_INSFORGE_ANON_KEY` | Browser + server SDK (user-scoped) |
| `INSFORGE_API_KEY` | Server-only admin client (audited functions only) |
| `OPENAI_API_KEY`, `OPENAI_MODEL`, `OPENAI_EMBED_MODEL` | AIRA, redaction suggestions, clustering |
| `K_MIN_ORGS` | Minimum distinct organisations for trend counts (default 3) |
| `NEXT_PUBLIC_APP_URL` | Invite links and auth redirects |

Database: `npx -y @insforge/cli db migrations up --all`, then `npm run seed` (synthetic orgs, users and observations).

> Never commit `.insforge/`, `.mcp.json` or `.env*`. They hold admin keys and are git-ignored.

## Demo personas (synthetic)
The seed creates the Azentio org plus 3 fictional client organisations: Acme Bank, Borealis Finance and Cedar Credit Union.
- Each persona is a plus-address on one demo inbox (`DEMO_INBOX`), for example `hitliprateek5+moderator@gmail.com`.
- Access is provisioned by email and binds on the first verified sign-in.

| Persona | Org | Grants |
|---|---|---|
| `employee` | Azentio | none |
| `moderator` | Azentio | moderate |
| `po` | Azentio | product_owner |
| `publisher` | Azentio | publish_media |
| `admin` | Azentio | portal_admin, manage_roles, invite |
| `acme-admin`, `borealis-admin`, `cedar-admin` | their client org | client admin |
| `acme-member`, `borealis-member`, `cedar-member` | their client org | client member |
| `multi` | Acme + Borealis | client member in both |

The admin-role personas also get demo passwords (`npm run demo:create`, then `npm run demo:verify <alias> <code>`), which are stored only in `web/.env.local`. They power the one-click demo-login buttons and the RLS tests.

## Scripts (once built)
| Command | Purpose |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run seed` | Load synthetic data (idempotent) |
| `npm run test:rls` | RLS matrix as anon + each persona through the real API |
| `npm run demo:create` / `demo:verify` | Create and verify demo-login accounts |
| `npm run test:e2e` | Playwright access matrix + lifecycle tests |
| `npm run test:aira` | AIRA gold-set evaluation |
| `python -m fl.run --rounds 5` | Federated-learning demo |

## License
Hackathon project. All product information is indicative, and all data is synthetic.
