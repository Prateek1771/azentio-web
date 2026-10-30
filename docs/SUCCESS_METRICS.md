# Success metrics (PRD §1.7)

Measured on 31 Oct 2026 against the shared InsForge backend and the live deployment at https://gz67ge67.insforge.site. Every row can be reproduced with the command in its Evidence column (run from `web/`).

| Metric | Target | Result | Evidence |
|---|---|---|---|
| Access matrix | 100% pass | **100%**: 6 personas × 15 routes, live and local; 207/207 API-level RLS checks | `tests/matrix.spec.ts`, `npm run test:rls` |
| Withdrawal | ≤ 60 s | **Immediate.** The shared copy is deleted in the withdrawing transaction, so the next request no longer finds it in the feed, the theme or AIRA | `tests/moderation.spec.ts` step 6, `npm run test:aira` (withdrawal check) |
| AIRA red-line rate | 0% | **0%** across 90 gold-set runs (60 as a client, plus the 30 adversarial questions again as an employee) | `npm run test:aira` |
| AIRA citation validity | 100% | **100%**: every `[S#]` cites a retrieved, RLS-visible source | `npm run test:aira` |
| AIRA instant resolution (IRR) | > 60% | **87%** (26 of the 30 answerable questions answered on the first turn) | `npm run test:aira` |
| Scenario walkthrough | end to end | **Passes**: three orgs → moderation (clarify, redact, publish) → theme (k ≥ 3) → idea → clients see the status → withdrawal | `tests/moderation.spec.ts`, [DEMO.md](DEMO.md) |
| Federated learning beats local-only | federated > local-only | **AUC 0.862 vs 0.824** (local-only mean; best single client 0.846), with one client dropping out in round 3 | `npm run fl`, `/e/fl` |

## Other release gates
- **Advisor:** 0 critical and 0 warnings. 35 findings are suppressed with recorded reasons:
  - `dangerous-function` (accepted risk): every SECURITY DEFINER function pins `search_path` and checks the caller.
  - `rls-no-policy` (false positive): `outbox` and `shared_org_link` are service-only by design.
  - `missing-rls-index` (won't fix): low-cardinality status columns.

  `npx -y @insforge/cli advisor suppressions` lists them.
- **Spend:** about $0.008 per full gold-set run. Total AI spend stays within the free $1 Model Gateway credit, and `budget.daily_calls` (200) caps daily use.
- **Unit tests** (`npm run test:unit`), lint and typecheck are clean.

## Known limits
- Two personas are unverified (`borealis-admin`, `acme-member`): their demo inboxes never confirmed. The RLS script skips them, and their scenario submissions are fixtures.
- Email delivery is off on the free plan. The outbox records every message, and setting `EMAIL_DELIVERY=insforge` on a paid plan turns delivery on.
- FL aggregation is plain FedAvg, with no secure aggregation or differential privacy. The UI says so.
