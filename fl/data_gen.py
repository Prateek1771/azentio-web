"""Synthetic SME portfolios for three isolated client environments + a separate global holdout.

Task: predict 90-day cash-flow stress for an SME borrower.
Feature schema (all clients share it; that is the compatibility assumption):
  0-11  monthly inflow shape: inflow_m / mean(inflows), oldest -> newest (scale-free, so bank size doesn't leak)
  12-15 sector one-hot: retail, manufacturing, agri, services
  16    log10(annual turnover) - 6, standardised-ish
  17    tenure with the bank in years / 10
Label: 1 = stressed within 90 days. One true rule generates labels everywhere; the clients differ only in
*which borrowers they see* (sector mix, seasonality, size), which is the skew federated learning helps with.
"""
import numpy as np

SECTORS = ["retail", "manufacturing", "agri", "services"]
N_FEATURES = 18

# Ground-truth logistic rule. Falling recent inflows and agri/retail exposure raise stress; size and tenure lower it.
_TRUE_W = np.array([0.2] * 6 + [0.0, -0.3, -0.6, -1.0, -1.6, -2.2] + [1.4, -1.6, 2.4, -1.2] + [-1.2, -1.4])
_TRUE_B = 0.3

# Each client is skewed: one dominant sector, its own seasonality, its own size band.
CLIENTS = {
    "acme-bank":        {"n": 260, "sector_p": [0.92, 0.0, 0.0, 0.08], "season_phase": 10, "amp": 0.35, "size_mu": 0.4},
    "borealis-finance": {"n": 340, "sector_p": [0.0, 0.92, 0.0, 0.08], "season_phase": 3,  "amp": 0.10, "size_mu": 1.0},
    "cedar-credit":     {"n": 180, "sector_p": [0.0, 0.0, 0.92, 0.08], "season_phase": 6,  "amp": 0.55, "size_mu": -0.2},
}
HOLDOUT = {"n": 1200, "sector_p": [0.25, 0.25, 0.25, 0.25], "season_phase": None, "amp": 0.3, "size_mu": 0.4}


def _sample(spec, rng):
    n = spec["n"]
    months = np.arange(12)
    phase = spec["season_phase"] if spec["season_phase"] is not None else rng.integers(0, 12, n)[:, None]
    season = 1 + spec["amp"] * np.sin(2 * np.pi * (months - phase) / 12)
    trend = 1 + rng.normal(0, 0.06, (n, 1)) * (months - 6)  # some borrowers decline, some grow
    raw = np.clip(season * trend * rng.lognormal(0, 0.12, (n, 12)), 0.05, None)
    shape = raw / raw.mean(axis=1, keepdims=True)
    sector = rng.choice(4, n, p=spec["sector_p"])
    size = rng.normal(spec["size_mu"], 0.6, n)
    tenure = rng.gamma(2.0, 0.3, n)
    X = np.column_stack([shape, np.eye(4)[sector], size, tenure])
    # labels use the shape *deviation* from flat (1.0), which is what the rule is defined on
    logits = (X[:, :12] - 1) @ _TRUE_W[:12] + X[:, 12:] @ _TRUE_W[12:] + _TRUE_B
    y = (rng.random(n) < 1 / (1 + np.exp(-logits))).astype(float)
    return X, y


def client_datasets(seed=7):
    """Each client's (X, y) is generated from its own RNG stream; nothing is pooled here."""
    return {name: _sample(spec, np.random.default_rng([seed, i])) for i, (name, spec) in enumerate(CLIENTS.items())}


def holdout(seed=7):
    return _sample(HOLDOUT, np.random.default_rng([seed, 99]))


def describe(name, X, y):
    """Aggregate stats only (no rows) for the skew explanation."""
    sectors = X[:, 12:16].mean(axis=0)
    top = int(sectors.argmax())
    return {
        "client": name,
        "n": int(len(y)),
        "stress_rate": round(float(y.mean()), 3),
        "dominant_sector": SECTORS[top],
        "dominant_share": round(float(sectors[top]), 2),
        "late_vs_early_inflow": round(float(X[:, 9:12].mean() / X[:, 0:3].mean()), 3),
    }
