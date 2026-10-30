// Outbox checks. Default: idempotency, concurrency, backoff and crash safety with a fake sender.
// --real: also sends one real email to DEMO_INBOX through InsForge emails.send.  Run: npm run test:outbox [-- --real]
// Every claim is scoped to this run's key prefix, so real queued email is never touched.
import assert from "node:assert/strict";
import { createAdminClient } from "@insforge/sdk";
import { runOutbox } from "../lib/email/worker.ts";

const admin = createAdminClient({ baseUrl: process.env.NEXT_PUBLIC_INSFORGE_URL!, apiKey: process.env.INSFORGE_API_KEY! });
const db = admin.database;
const TAG = `outbox-test-${Date.now()}:`;
const inbox = process.env.DEMO_INBOX ?? "hitliprateek5@gmail.com";
const row = (n: number | string) => ({ idempotency_key: `${TAG}${n}`, to_email: "nobody@example.invalid", template: "report.decided", payload: {} });
const enqueue = (r: object) => db.from("outbox").upsert([r], { onConflict: "idempotency_key", ignoreDuplicates: true });
type R = { status: string; attempts: number; last_error: string | null };
const get = async (k: string) => (await db.from("outbox").select("status, attempts, last_error").eq("idempotency_key", `${TAG}${k}`).single()).data as R;

try {
  // 1 · the same key enqueued twice is one row
  await enqueue(row(0));
  await enqueue(row(0));
  const { data: keyed } = await db.from("outbox").select("id").eq("idempotency_key", `${TAG}0`);
  assert.equal(keyed?.length, 1, "duplicate enqueue must not create a second row");
  console.log("✓ re-enqueuing the same key is ignored");

  // 2 · concurrent workers: every row is sent exactly once
  for (let n = 1; n < 6; n++) await enqueue(row(n));
  let sends = 0;
  const fake = async () => {
    await new Promise((r) => setTimeout(r, 50)); // widen the race window
    sends++;
    return {};
  };
  // three workers race at the same instant, each taking up to 2 rows: skip-locked must split them
  const runs = await Promise.all([1, 2, 3].map(() => runOutbox(db, fake, 2, TAG)));
  for (let i = 0; i < 3 && sends < 6; i++) runs.push(await runOutbox(db, fake, 2, TAG)); // sweep anything left
  const { data: rows } = await db.from("outbox").select("status, attempts").like("idempotency_key", `${TAG}%`);
  assert.equal(sends, 6, `6 sends expected, got ${sends}`);
  assert.equal(runs.reduce((n, r) => n + r.claimed, 0), 6, "claims across workers must add up to exactly 6");
  assert.ok((rows as R[]).every((r) => r.status === "sent" && r.attempts === 1), JSON.stringify(rows));
  console.log(`✓ concurrent workers: 6 rows, 6 sends, none twice (claims per worker: ${runs.map((r) => r.claimed).join(", ")})`);

  // 3 · failures back off, then stop after 3 attempts
  await enqueue(row("fail"));
  const failing = async () => ({ error: "provider rejected" });
  await runOutbox(db, failing, 50, TAG);
  assert.equal((await get("fail")).status, "retry");
  await runOutbox(db, failing, 50, TAG);
  assert.equal((await get("fail")).attempts, 1, "not due again until its backoff passes");
  for (let i = 0; i < 2; i++) {
    await db.from("outbox").update({ next_attempt_at: new Date(0).toISOString() }).eq("idempotency_key", `${TAG}fail`);
    await runOutbox(db, failing, 50, TAG);
  }
  const f = await get("fail");
  assert.deepEqual([f.status, f.attempts], ["failed", 3]);
  console.log("✓ a failing send backs off, then stops after 3 attempts");

  // 4 · a worker that died mid-send: the row becomes "unknown" and is never resent
  await db.from("outbox").insert([{ ...row("stale"), status: "sending", attempts: 1, claimed_at: new Date(Date.now() - 11 * 60_000).toISOString() }]);
  let called = 0;
  await runOutbox(db, async () => (called++, {}), 50, TAG);
  assert.deepEqual([(await get("stale")).status, called], ["unknown", 0]);
  console.log("✓ a row stuck mid-send becomes 'unknown' and is not resent");

  // 5 · optional real send
  if (process.argv.includes("--real")) {
    await enqueue({ ...row("real"), to_email: inbox });
    await runOutbox(db, async (m) => {
      const { error } = await admin.emails.send({ ...m, from: "azentio.ai" });
      return { error: error?.message };
    }, 50, TAG);
    const d = await get("real");
    if (d.status !== "sent") throw new Error(`real email not sent: ${d.status} — ${d.last_error}`);
    console.log(`✓ real email accepted by the provider for ${inbox}`);
  }
} finally {
  await db.from("outbox").delete().like("idempotency_key", `${TAG}%`);
}
