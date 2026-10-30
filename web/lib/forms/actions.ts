"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { createInsForgeAdminClient } from "@/lib/insforge/admin";

// Public forms. Anonymous API inserts are revoked in the DB, so this is the only write path:
// honeypot → timing trap → rate limits → validated insert with the admin client.

export type FormState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  duplicate?: boolean;
  values?: Record<string, string>; // echoed back so a failed submit keeps what the user typed
};

const MIN_FILL_MS = 2000;
const PER_EMAIL_PER_HOUR = 3;
const PER_IP_PER_HOUR = 10;

// ponytail: per-instance memory window; move to a DB/edge KV counter when running multiple instances.
const ipHits = new Map<string, number[]>();
function ipLimited(ip: string) {
  const now = Date.now();
  const hits = (ipHits.get(ip) ?? []).filter((t) => now - t < 3_600_000);
  hits.push(now);
  ipHits.set(ip, hits);
  return hits.length > PER_IP_PER_HOUR;
}

async function botCheck(form: FormData) {
  if (String(form.get("website") ?? "").trim()) return true; // honeypot filled
  const started = Number(form.get("t"));
  if (!started || Date.now() - started < MIN_FILL_MS) return true; // too fast for a human
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  return ipLimited(ip) ? "limited" : false;
}

const fieldErrors = (e: z.ZodError) =>
  Object.fromEntries(e.issues.map((i) => [String(i.path[0]), i.message]));

const echo = (form: FormData, keys: string[]) =>
  Object.fromEntries(keys.map((k) => [k, String(form.get(k) ?? "").slice(0, 4000)]));

async function recentByEmail(table: "demo_requests" | "event_registrations", email: string) {
  const since = new Date(Date.now() - 3_600_000).toISOString();
  const { count } = await createInsForgeAdminClient()
    .database.from(table)
    .select("id", { count: "exact", head: true })
    .ilike("email", email)
    .gte("created_at", since);
  return count ?? 0;
}

const connectSchema = z.object({
  interest: z.enum(["demo", "collaboration", "challenge", "general"], { message: "Choose what you're interested in." }),
  name: z.string().trim().min(1, "Enter your name.").max(120, "Keep your name under 120 characters."),
  email: z.string().trim().toLowerCase().email("Enter a valid work email.").max(254),
  organisation: z.string().trim().max(160, "Keep the organisation under 160 characters.").optional(),
  message: z.string().trim().max(4000, "Keep your message under 4,000 characters.").optional(),
});

export async function submitConnect(_: FormState, form: FormData): Promise<FormState> {
  const bot = await botCheck(form);
  if (bot === "limited") return { error: "Too many submissions from your network. Please try again later." };
  if (bot) return { ok: true }; // silent: never tell a bot it was caught

  const values = echo(form, ["interest", "name", "email", "organisation", "message"]);
  const parsed = connectSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values };
  if ((await recentByEmail("demo_requests", parsed.data.email)) >= PER_EMAIL_PER_HOUR)
    return { error: "We've already received a few messages from this email. We'll be in touch soon.", values };

  const { error } = await createInsForgeAdminClient()
    .database.from("demo_requests")
    .insert([{ ...parsed.data, organisation: parsed.data.organisation || null, message: parsed.data.message || null }]);
  if (error) return { error: "We couldn't send your enquiry. Please try again.", values };
  return { ok: true };
}

const registerSchema = z.object({
  name: z.string().trim().min(1, "Enter your name.").max(120, "Keep your name under 120 characters."),
  email: z.string().trim().toLowerCase().email("Enter a valid email address.").max(254),
  consent: z.literal("on", { message: "Please agree so we can store your registration." }),
});

export async function submitHackathon(_: FormState, form: FormData): Promise<FormState> {
  const bot = await botCheck(form);
  if (bot === "limited") return { error: "Too many submissions from your network. Please try again later." };
  if (bot) return { ok: true };

  const values = echo(form, ["name", "email", "consent"]);
  const parsed = registerSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values };

  const { error } = await createInsForgeAdminClient()
    .database.from("event_registrations")
    .insert([{ name: parsed.data.name, email: parsed.data.email, consent: true }]);
  if (error) {
    if (error.code === "23505" || /duplicate|unique/i.test(error.message)) return { ok: true, duplicate: true };
    return { error: "We couldn't save your registration. Please try again.", values };
  }
  return { ok: true };
}
