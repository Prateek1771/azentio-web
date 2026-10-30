import { render } from "./templates.ts";

type Row = { id: string; to_email: string; template: string; payload: Record<string, unknown>; attempts: number };
type Db = { rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message?: string } | null }>; from: (t: string) => any }; // eslint-disable-line @typescript-eslint/no-explicit-any
export type Send = (msg: { to: string; subject: string; html: string }) => Promise<{ error?: string }>;

const BACKOFF_MIN = [1, 5, 30];
const MAX_ATTEMPTS = 3;

// Claims due rows (skip-locked, so concurrent runs never share a row) and sends each once.
// A crash between send and mark leaves the row "sending"; the next claim turns it "unknown", never resends it.
export async function runOutbox(db: Db, send: Send, limit = 10, keyPrefix?: string) {
  const { data, error } = await db.rpc("outbox_claim", { p_limit: limit, p_key_prefix: keyPrefix ?? null });
  if (error) throw new Error(`outbox_claim: ${error.message}`);
  const rows = (data ?? []) as Row[];
  let sent = 0;
  for (const r of rows) {
    let err: string | undefined;
    try {
      const msg = render(r.template, r.payload);
      err = (await send({ to: r.to_email, ...msg })).error;
    } catch (e) {
      err = (e as Error).message;
    }
    if (!err) {
      sent++;
      // payload scrubbed: invite links and titles don't sit at rest once delivered to the provider
      await db.from("outbox").update({ status: "sent", sent_at: new Date().toISOString(), payload: {}, last_error: null }).eq("id", r.id);
    } else {
      const final = r.attempts >= MAX_ATTEMPTS;
      const next = new Date(Date.now() + BACKOFF_MIN[Math.min(r.attempts - 1, BACKOFF_MIN.length - 1)] * 60_000).toISOString();
      await db.from("outbox").update({ status: final ? "failed" : "retry", next_attempt_at: next, last_error: err.slice(0, 500) }).eq("id", r.id);
    }
  }
  return { claimed: rows.length, sent };
}
