import assert from "node:assert/strict";
import { cluster } from "./assists.ts";

// union-find over similarity pairs; singletons are dropped, chains merge
const ids = ["a", "b", "c", "d", "e"];
const groups = cluster(ids, [
  { a: "a", b: "b", similarity: 0.3 },
  { a: "b", b: "c", similarity: 0.15 },
  { a: "d", b: "e", similarity: 0.05 }, // below threshold
], 0.12).map((g) => g.sort().join(""));
assert.deepEqual(groups, ["abc"]);
assert.deepEqual(cluster(ids, [], 0.12), []);
console.log("✓ theme clustering: union-find groups, thresholds and singletons");
