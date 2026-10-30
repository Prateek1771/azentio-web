"""FedAvg coordinator over simulated, isolated client environments.

    python fl/run.py --participants acme-bank,borealis-finance,cedar-credit --dropout cedar-credit@3

Clients train locally and return only a weight delta + sample count. The coordinator validates, clips and
averages those deltas. It never receives rows. Output (metadata only) goes to fl/out/run.json.
"""
import argparse
import hashlib
import json
import pathlib
from datetime import datetime, timezone

import numpy as np

import eval as fl_eval
import model
from data_gen import client_datasets, holdout


class Client:
    """A client environment. Its data stays in this object; fit() returns an update, never rows."""

    def __init__(self, name, X, y, poison_round=None):
        self.name, self._X, self._y, self._poison_round = name, X, y, poison_round

    def fit(self, global_w, rnd, epochs):
        delta = model.local_train(global_w, self._X, self._y, epochs=epochs) - global_w
        if rnd == self._poison_round:  # simulated malicious client: huge, sign-flipped update
            delta = -40 * delta
        return delta, len(self._y)


def validate(updates):
    """Reject wrong-shape, non-finite, or outlier-norm updates (norm > 3x the median of the *other* updates)."""
    ok, rejected = {}, {}
    norms = {n: float(np.linalg.norm(d)) for n, (d, _) in updates.items() if d.shape == (model.N_PARAMS,) and np.isfinite(d).all()}
    for name, (delta, n) in updates.items():
        if name not in norms:
            rejected[name] = "bad shape or non-finite values"
            continue
        others = [v for k, v in norms.items() if k != name]
        if others and norms[name] > 3 * float(np.median(others)):
            rejected[name] = f"norm {norms[name]:.2f} > 3x cohort median"
            continue
        ok[name] = (delta, n)
    return ok, rejected, norms


def clip(delta, c):
    norm = np.linalg.norm(delta)
    return (delta * (c / norm), True) if norm > c else (delta, False)


def parse_at(s):
    if not s:
        return None, None
    name, rnd = s.split("@")
    return name, int(rnd)


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--participants", default="acme-bank,borealis-finance,cedar-credit")
    ap.add_argument("--rounds", type=int, default=6)
    ap.add_argument("--local-epochs", type=int, default=20)
    ap.add_argument("--clip", type=float, default=2.0)
    ap.add_argument("--min-participants", type=int, default=2)
    ap.add_argument("--dropout", default="cedar-credit@3", help="client@round that fails to respond ('' for none)")
    ap.add_argument("--poison", default="", help="client@round that sends a malicious update")
    ap.add_argument("--seed", type=int, default=7)
    ap.add_argument("--out", default=str(pathlib.Path(__file__).parent / "out" / "run.json"))
    a = ap.parse_args(argv)

    all_data = client_datasets(a.seed)
    names = [n for n in a.participants.split(",") if n]
    unknown = [n for n in names if n not in all_data]
    if unknown:
        raise SystemExit(f"unknown participants: {unknown}")
    if len(names) < a.min_participants:
        raise SystemExit(f"cohort of {len(names)} is below the minimum of {a.min_participants}; not starting")

    drop_name, drop_round = parse_at(a.dropout)
    poison_name, poison_round = parse_at(a.poison)
    clients = {n: Client(n, *all_data[n], poison_round if n == poison_name else None) for n in names}
    hold = holdout(a.seed)

    w = model.init()
    rounds = []
    for rnd in range(1, a.rounds + 1):
        dropped = [drop_name] if rnd == drop_round and drop_name in clients else []
        updates = {n: c.fit(w, rnd, a.local_epochs) for n, c in clients.items() if n not in dropped}
        ok, rejected, norms = validate(updates)
        clipped = []
        if len(ok) >= a.min_participants:
            total = sum(n for _, n in ok.values())
            agg = np.zeros(model.N_PARAMS)
            for name, (delta, n) in ok.items():
                delta, was = clip(delta, a.clip)
                clipped += [name] if was else []
                agg += delta * (n / total)
            w = w + agg
            status = "aggregated"
        else:
            status = "skipped: below minimum cohort after dropout/rejection"
        rounds.append({
            "n": rnd,
            "status": status,
            "participants": sorted(ok),
            "dropped": dropped,
            "rejected": rejected,
            "clipped": clipped,
            "update_norms": {k: round(v, 4) for k, v in norms.items()},
            "weights_n": {k: n for k, (_, n) in ok.items()},
            "holdout": model.evaluate(w, *hold),
        })

    result = {
        "program": "sme-cashflow-stress",
        "finished_at": datetime.now(timezone.utc).isoformat(),
        "params": {
            "rounds": a.rounds, "local_epochs": a.local_epochs, "clip_norm": a.clip, "min_participants": a.min_participants,
            "dropout": a.dropout or None, "poison": a.poison or None, "seed": a.seed, "model": "logistic regression (19 params)",
        },
        "aggregation": "FedAvg weighted by n, norm-clipped; plain averaging (no secure aggregation, no differential privacy)",
        "participants": names,
        "rounds": rounds,
        "comparison": fl_eval.compare(w, {n: all_data[n] for n in names}, hold, epochs=a.rounds * a.local_epochs),
        "skew": fl_eval.skew({n: all_data[n] for n in names}, hold),
        "weights": [round(float(x), 6) for x in w],
        "weights_sha256": hashlib.sha256(w.tobytes()).hexdigest(),
    }
    assert_metadata_only(result)
    out = pathlib.Path(a.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(result, indent=2))
    c = result["comparison"]
    print(f"federated AUC {c['federated']['auc']} | local-only mean {c['local_only_mean']['auc']} | oracle (reference) {c['oracle_reference_only']['auc']}")
    print(f"wrote {out}")
    return result


def assert_metadata_only(obj):
    """No list in the log may be longer than the model itself: that's what a leaked row/column would look like."""
    if isinstance(obj, dict):
        for v in obj.values():
            assert_metadata_only(v)
    elif isinstance(obj, list):
        assert len(obj) <= model.N_PARAMS, f"list of length {len(obj)} in coordinator log: possible training data"
        for v in obj:
            assert_metadata_only(v)


if __name__ == "__main__":
    main()
