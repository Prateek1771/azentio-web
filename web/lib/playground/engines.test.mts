// Run: npm run test:unit
import assert from "node:assert/strict";
import { engines } from "./engines.ts";
import { scenarios } from "./scenarios.ts";
import { toEmbed } from "../media/embed.ts";

const inputs = (o: string, k: number) => Object.fromEntries(scenarios[o][k].fields.map((f) => [f.key, f.value]));

// SME: the healthy bakery passes; the thin-cash-flow start-up does not.
assert.equal(engines["sme-credit-decisioning"](inputs("sme-credit-decisioning", 0)).tone, "positive");
assert.notEqual(engines["sme-credit-decisioning"](inputs("sme-credit-decisioning", 1)).tone, "positive");
// Every decision-like headline is labelled as a simulation.
for (const [slug, list] of Object.entries(scenarios))
  for (const [k, s] of list.entries()) {
    const out = engines[slug]({ ...inputs(slug, k), document: s.document ?? "" });
    assert.match(out.headline, /simulat|synthetic/i, `${slug}/${s.key} headline must be labelled`);
    assert.ok(out.evidence.length > 0, `${slug}/${s.key} has evidence`);
  }
// Deterministic: same input, same output.
assert.deepEqual(engines["credit-strategy-simulator"](inputs("credit-strategy-simulator", 0)), engines["credit-strategy-simulator"](inputs("credit-strategy-simulator", 0)));
// Tighter cut-off → fewer approvals; looser → more.
const approvals = (k: number) => engines["credit-strategy-simulator"](inputs("credit-strategy-simulator", k)).headline;
assert.match(approvals(0), /^-/);
assert.match(approvals(1), /^\+/);
// Document Intelligence catches a non-reconciling invoice.
assert.equal(engines["document-intelligence"]({ document: scenarios["document-intelligence"][1].document! }).tone, "negative");
assert.equal(engines["document-intelligence"]({ document: scenarios["document-intelligence"][0].document! }).tone, "positive");
// RIVA flags the unmapped sector and the wrong date format; the clean mapping passes.
assert.equal(engines.riva(inputs("riva", 0)).evidence.filter((e) => e.status === "fail").length, 2);
assert.equal(engines.riva(inputs("riva", 1)).tone, "positive");

// Embed converter: known players only, https only.
assert.equal(toEmbed("https://www.youtube.com/watch?v=dQw4w9WgXcQ")?.url, "https://www.youtube.com/embed/dQw4w9WgXcQ");
assert.equal(toEmbed("https://youtu.be/dQw4w9WgXcQ")?.url, "https://www.youtube.com/embed/dQw4w9WgXcQ");
assert.equal(toEmbed("https://vimeo.com/123456789")?.url, "https://player.vimeo.com/video/123456789");
assert.equal(toEmbed("https://www.twitch.tv/azentio", "portal.example")?.url, "https://player.twitch.tv/?channel=azentio&parent=portal.example");
assert.equal(toEmbed("https://cdn.example.com/talk.mp4")?.kind, "video");
assert.equal(toEmbed("javascript:alert(1)"), null);
assert.equal(toEmbed("http://www.youtube.com/watch?v=dQw4w9WgXcQ"), null);
assert.equal(toEmbed("https://evil.example/page"), null);

console.log("✓ engines + embed converter: all assertions passed");
