# fl/: federated learning track (P2)

Numpy only. Task: 90-day cash-flow stress for SME borrowers, across three isolated synthetic client portfolios.

```bash
python fl/test_fl.py      # exit check: federated beats every local-only model, dropout round completes, no rows in logs
python fl/run.py --dropout cedar-credit@3 --poison borealis-finance@2   # local run → fl/out/run.json
cd web && npm run fl      # enrolled orgs only → sync metadata to fl_* tables → candidate in model_registry
```

| File | Role |
|---|---|
| `data_gen.py` | Feature schema, ground-truth rule, per-client skew, holdout |
| `model.py` | Logistic regression (19 params), local training, AUC |
| `run.py` | Client simulation + FedAvg coordinator (validation, clipping, min cohort, dropout, poison) |
| `eval.py` | Federated vs local-only vs centralised oracle (reference only); skew explanation |
| `THREAT_MODEL.md` | Threats, controls (implemented vs simulated vs not), withdrawal and lineage policy |

Approve, reject and roll back models at `/e/fl` (portal admin). Clients opt in from their workspace dashboard.
