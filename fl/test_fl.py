"""Phase 9 exit check: python fl/test_fl.py"""
import json
import pathlib
import tempfile

import run

with tempfile.TemporaryDirectory() as d:
    out = pathlib.Path(d) / "run.json"
    r = run.main(["--dropout", "cedar-credit@3", "--poison", "borealis-finance@2", "--out", str(out)])
    text = out.read_text()

c = r["comparison"]
assert c["federated"]["auc"] > c["local_only_mean"]["auc"], "federated must beat the local-only baseline"
assert all(c["federated"]["auc"] > m["auc"] for m in c["local_only"].values()), "federated must beat every local-only model"

r3 = r["rounds"][2]
assert r3["dropped"] == ["cedar-credit"] and r3["status"] == "aggregated", "dropout round must still complete"
assert "borealis-finance" in r["rounds"][1]["rejected"], "poisoned update must be rejected"

run.assert_metadata_only(json.loads(text))
try:
    run.main(["--participants", "acme-bank", "--out", str(pathlib.Path(tempfile.gettempdir()) / "x.json")])
    raise AssertionError("a cohort of 1 must refuse to start")
except SystemExit:
    pass
print("fl ok")
