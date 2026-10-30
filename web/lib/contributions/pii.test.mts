import assert from "node:assert/strict";
import { scanPii } from "./pii.ts";
import { whoCanSee } from "./model.ts";

assert.deepEqual(scanPii("Contact a.b@bank.co for details"), ["email"]);
assert.ok(scanPii("call +91 98765 43210").includes("phone"));
assert.ok(scanPii("card 4111 1111 1111 1111").includes("card_or_account"));
assert.ok(scanPii("IBAN GB82WEST12345698765432").includes("iban"));
assert.ok(scanPii("PAN ABCDE1234F").includes("pan"));
assert.ok(scanPii("id 1234 5678 9012").includes("aadhaar"));
// ordinary market observations stay clean
assert.deepEqual(scanPii("SME approvals rose 12% in Q3 2025 across 340 applications; median ticket 45,000."), []);

assert.match(whoCanSee({ state: "draft", visibility_choice: "propose_shared" }, "Acme"), /^Only you/);
assert.match(whoCanSee({ state: "published", visibility_choice: "org" }, "Acme"), /members of Acme\.$/);
assert.match(whoCanSee({ state: "submitted", visibility_choice: "propose_shared" }, "Acme"), /moderators/);
assert.match(whoCanSee({ state: "withdrawn", visibility_choice: "org" }, "Acme"), /^Only you/);

console.log("✓ pii scan + audience labels: all assertions passed");
