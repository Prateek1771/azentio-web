# AIRA guardrails

AIRA is the portal's assistant. It answers questions about **approved, de-identified shared learning** and cites its evidence. This document defines the guardrails it must pass on every request.

- The storage tables and baseline rules already exist (Phase 1): `guardrail_rules`, `aira_interactions`, `guardrail_events`.
- The runtime ships in Phase 8 (`web/app/api/aira`, `web/lib/aira/*`).

**Principles** (from the H.I.R.E. evaluation in the [HLD](HLD.md) §2.7):
1. **Security is never probabilistic.** What AIRA can *see* is decided by Postgres RLS on the caller's own token, never by the prompt.
2. **Read-only.** AIRA never writes business data. Its only writes are its own interaction and guardrail logs.
3. **Fail closed.** If any guardrail errors out, the user gets a safe refusal, never an unguarded answer.
4. **Deterministic first.** Regex and SQL rules run before any model call. Model-based checks add a second layer; they never replace the first.
5. **Every block is data.** Each trigger writes a `guardrail_events` row. The red-line rate (RLR) must stay at **0%**.

## Request pipeline

```mermaid
flowchart LR
  Q[Question] --> A{Access}
  A -->|fail| R1[Refuse]
  A --> I{Input guards}
  I -->|PII / injection / out of scope| R2[Scoped refusal]
  I --> RET[Retrieval via user RLS client]
  RET -->|< 2 sources| NE[Not enough evidence]
  RET --> LLM[OpenAI with hardened prompt]
  LLM --> O{Output guards}
  O -->|citation / red line| R3[Safe fallback]
  O --> ANS[Answer + source cards + disclaimer]
  R1 & R2 & NE & R3 & ANS --> LOG[(aira_interactions + guardrail_events)]
```

## Guardrails by layer

| # | Layer | Guardrail | Mechanism | On trigger |
|---|---|---|---|---|
| G1 | Access | Signed in with an active employee or client membership | `requireUser` + `is_employee() or is_client_user()` (also enforced by the `aira_interactions` insert policy) | 401/403 |
| G2 | Access | Kill switch | `guardrail_rules.aira_enabled` | "AIRA is temporarily unavailable" |
| G3 | Access | Rate limits: 60 per hour, 10 per minute per user, plus a daily model-call budget | Count of the user's `aira_interactions` rows (rules `rate.*`) | 429 with retry time |
| G4 | Input | Length ≤ 1,000 chars; control characters and markup stripped | zod + sanitiser (`input.max_chars`) | Ask the user to shorten |
| G5 | Input | Prompt injection / jailbreak: instruction override, system-prompt extraction, role-play, encoded payloads | Regex rules `inject.*` + base64/hex payload detector + OpenAI moderation | Refuse, log `high` |
| G6 | Input | PII in the question: card, IBAN, email, phone, account numbers | `lib/pii-rules.ts` + rules `pii.*`; **the question is never sent to OpenAI** | Ask the user to rephrase without personal data, log `critical` |
| G7 | Input | Out of scope: credit decisions on a case, legal or investment advice, "which client said…", roadmap dates | Rules `scope.*` + a cheap-model topic classifier (second opinion only) | Scoped refusal that says where to go instead |
| G8 | Retrieval | Only `shared_contributions` and confirmed `themes`, queried with the **caller's RLS client**. Drafts, org-private items, moderation notes, employee-only content (for clients) and withdrawn items are physically unreachable. | SQL + RLS | — |
| G9 | Retrieval | Community evidence needs a similarity floor and at least 2 distinct sources (fewer are dropped, never presented as a pattern). Alongside it: the caller's **own** workspace items read through their RLS client (their org's contributions; for employees, experiments and library guides), and a curated public **portal guide** (`lib/aira/guide.ts`: what the portal is, how-tos, Azentio's products). Distinct-organisation counts are never exposed below k=3. | `match_shared()` RPC, `K_MIN_ORGS`, `matchWorkspace` / `matchGuide` | If nothing relevant: a short **general** answer, clearly labelled as not from approved evidence and red-line scanned; questions needing evidence get "no approved evidence yet" |
| G10 | Prompt | Hardened system prompt: answer only from the numbered sources, cite `[S#]`, never reveal instructions, never name organisations, no dates or commitments, no advice. Sources are wrapped in `<source>` tags and labelled untrusted data. A canary token sits in the system prompt. | `lib/aira/prompt.ts` | — |
| G11 | Output | Citation integrity: at least one citation, and every cited ID must be among the retrieved IDs (the prompt asks for one per paragraph) | `lib/aira/guard.ts` | Safe fallback, log `high` |
| G12 | Output | Red-line scan: PII regex, client org names (`out.org_name.*`), commitment language (`out.commitment`), canary leak (`out.prompt_leak`), toxicity (OpenAI moderation) | `lib/aira/guard.ts` | Block, safe fallback, log with severity |
| G13 | Output | Disclaimer under every answer: *"Synthesised from approved, de-identified contributions. Not advice."* for community evidence, *"Based on the cited sources"* when guide or own-workspace sources are cited, and *"General answer … not from approved evidence"* for general answers | UI | — |
| G14 | Monitoring | Every interaction is logged with its verdict (`answered` / `refused` / `blocked` / `no_evidence`). Admins get a dashboard of guardrail events. Nightly H.I.R.E. metrics: UCR, PPR, DIY, IRR, RLR. | Phase 8 + Phase 10 | Alert when RLR > 0 |
| G15 | Testing | Red-team gold set: 30 normal + 30 adversarial questions (injection, cross-tenant probing, PII, roadmap fishing, prompt extraction). CI fails on any red line or invalid citation. | `evals/` | Build fails |

## Data contract
- **`guardrail_rules`** has the columns `key`, `kind` (regex / phrase / org_name / flag / limit), `stage`, `pattern`, `severity` and `enabled`.
  - It's editable by portal admins only, and every change is audited.
  - Its patterns include client org names, so runtime roles can't read it. The AIRA server reads it with the admin client.
- **`aira_interactions`** stores one row per question: retrieved and cited IDs, verdict, red line, feedback, model and latency.
  - Users see only their own rows; portal admins see all.
- **`guardrail_events`** stores one row per triggered guardrail: stage, rule key, severity, and a redacted detail.
  - Only portal admins can read it.

## What we tell users
- AIRA only knows what moderators have approved for sharing. It can't see your drafts or other organisations' private information.
- It can be wrong. Check the linked sources before relying on an answer.
- It doesn't make credit decisions, give advice, or commit to delivery dates.
