# Federated learning: threat model and controls

Scope: the Phase 9 demonstration (`fl/`, `/e/fl`, the client opt-in panel). This is a **simulation on synthetic data**. The three "client environments" are separate objects in one Python process. Nothing below should be read as a claim about a production deployment.

## What is being protected
- **Client training records.** These are synthetic SME portfolios, one per client (`data_gen.py`).
- **Model integrity.** A bad or malicious participant shouldn't be able to steer the global model.
- **Deployment decisions.** No model is used until a named person approves it.

## Data flow
1. A client admin enrols their org with an explicit train consent: `fl_enroll`. This consent is separate from membership and from per-contribution publishing consent.
2. `npm run fl` reads the active enrolments and starts the coordinator with exactly those participants.
3. Each client trains locally (`Client.fit`) and returns only `(weight delta, n)`. The coordinator never sees rows.
4. The coordinator validates, clips and averages the updates, then evaluates on a separate synthetic holdout.
5. It writes a metadata-only log: params, participants, dropped and rejected clients with reasons, update norms, metrics, and the 19 model weights plus their hash. `assert_metadata_only` refuses to write any list longer than the model, which is what a leaked row or column would look like. The log is synced to `fl_runs` / `fl_rounds`, and the model is registered as a `candidate`.
6. A portal admin approves or rejects the candidate at `/e/fl`. Rollback re-pins the previously approved version. Every change goes through `audit_log`.

## Threats and controls

| Threat | Control in this demo | Status |
|---|---|---|
| Unauthorised participant | Enrolment only through `fl_enroll` (client admin of that org, consent required). The coordinator only runs enrolled orgs. | **Implemented** at the DB/RLS layer. Participant *identity at training time* is simulated: there is no per-client key or attestation. |
| Too few participants (easy reconstruction of one client's update) | Minimum cohort of 2. The run refuses to start below it, and a round is skipped if dropouts or rejections leave fewer. | **Implemented** |
| Poisoning / outlier updates | Shape and finiteness checks. An update is rejected if its norm is more than 3× the median of the other updates (`--poison` demonstrates this). | **Implemented**, but simple. A patient attacker sending in-bound updates is not detected. A production system would add robust aggregation (trimmed mean / median) and per-client history. |
| One client dominating | Norm clipping (C = 2.0). Weighting by n is disclosed in the UI. | **Implemented** |
| Update leakage (gradient inversion, membership inference) | Updates are clipped, but they are sent **in the clear** to the coordinator. | **Not mitigated.** See secure aggregation and DP below. |
| Coordinator sees individual updates | No secure aggregation. | **Not implemented**, and we don't claim it. Production design: pairwise-masked secure aggregation (Bonawitz et al.), so the coordinator only learns the sum, with dropout recovery through secret-shared masks. |
| Formal privacy | No differential privacy. | **Not implemented**, and we don't claim it. Design: client-level DP-FedAvg, meaning clip each update to C, add Gaussian noise σ·C to the sum, and track (ε, δ) with an RDP accountant across rounds. Publish ε per programme and stop training when the budget is spent. |
| Training data in logs | Metadata-only log with a structural assertion. RLS keeps runs, rounds and models employee-only. Clients see only their own enrolment. | **Implemented** |
| Unreviewed deployment | Candidate → human approve/reject (`fl_decide`, portal admin only). At most one approved model per programme (unique index). Rollback is available. | **Implemented** |
| Tampering with the registry | No direct write grants. Changes only through the security-definer RPCs. Append-only audit log. | **Implemented** |

## Skew
The clients are deliberately non-IID: each sees about 92% of one sector, with its own seasonality and size band. Local-only models misprice the sectors they've never seen. FedAvg pools that coverage without pooling data. Weighting by n pulls the global model toward the largest client's mix. The centralised oracle pools raw data, which a real programme must not do, and is shown **for reference only**.

## Withdrawal and lineage policy
- **Withdrawal** (`fl_withdraw`) takes effect from the next run. The org is excluded from all future rounds, and its enrolment row is kept, with `withdrawn_at`, for audit.
- **Models already trained** with that org's updates are **not** automatically "untrained". We don't promise machine unlearning. The policy is:
  1. Those versions stay in the registry with full lineage: run → rounds → participants → parent version.
  2. On request, an admin can retire them (reject the candidate, or roll back from the approved version).
  3. The next run trains a replacement without the withdrawn org.
- **Lineage:** each registry row records its `run_id`, its `parent_id` (the approved version when it was trained), the weights hash, and the decision (who, when, note). `fl_rounds` records exactly which orgs contributed to each round.

## Honest labels
The UI and this document say plainly that this demo uses simulated environments on synthetic data and plain weighted FedAvg with clipping, with **no secure aggregation and no differential privacy**. Keeping raw data local reduces exposure, but on its own it does not provide confidentiality, anonymity or regulatory compliance.
