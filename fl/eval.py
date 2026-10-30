"""Comparison on the separate synthetic holdout: federated vs local-only vs a centralised oracle.

The oracle pools every client's rows, which a real federated programme must never do. It exists here only
as a reference ceiling for the simulation and is labelled that way everywhere it is shown.
"""
import numpy as np

import model
from data_gen import describe


def compare(global_w, datasets, holdout, epochs):
    Xh, yh = holdout
    local = {name: model.evaluate(model.local_train(model.init(), X, y, epochs=epochs), Xh, yh) for name, (X, y) in datasets.items()}
    Xp = np.vstack([X for X, _ in datasets.values()])
    yp = np.concatenate([y for _, y in datasets.values()])
    return {
        "federated": model.evaluate(global_w, Xh, yh),
        "local_only": local,
        "local_only_mean": {k: round(float(np.mean([m[k] for m in local.values()])), 4) for k in ("auc", "accuracy", "log_loss")},
        "oracle_reference_only": model.evaluate(model.local_train(model.init(), Xp, yp, epochs=epochs), Xh, yh),
    }


def skew(datasets, holdout):
    stats = [describe(n, X, y) for n, (X, y) in datasets.items()]
    hold = describe("holdout", *holdout)
    lines = [
        f"{s['client']}: {s['dominant_share']:.0%} {s['dominant_sector']}, stress rate {s['stress_rate']:.0%} "
        f"(holdout {hold['stress_rate']:.0%}), late/early inflow {s['late_vs_early_inflow']}"
        for s in stats
    ]
    lines.append(
        "Each client sees mostly one sector, so a local-only model barely learns the other sectors' risk and "
        "misprices them on the mixed holdout. FedAvg combines updates that each cover a different slice of the "
        "feature space. Weighting by n means the largest client pulls the global model toward its own sector mix."
    )
    return {"clients": stats, "holdout": hold, "explanation": lines}
