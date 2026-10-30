"use server";

import { z } from "zod";
import OpenAI from "openai";
import { requireEmployee, requireOrg, requireUser } from "@/lib/authz";
import { createInsForgeServerClient } from "@/lib/insforge/server";
import { engines, type EngineOutput } from "./engines";
import { scenarioFor } from "./scenarios";

export type RunResult = {
  error?: string;
  runId?: string;
  output?: EngineOutput & { narrative?: string; aiNotice?: string };
  mode?: "deterministic" | "ai_assisted";
};

const SYSTEM = `You explain sandbox results from a demonstration of enterprise AI products.
Rules: Use ONLY the synthetic scenario and deterministic results provided. Never state or imply an approved credit,
lending or business decision; describe recommendations as simulated. Never promise outcomes, dates or product features.
Do not invent numbers. Write 3-4 short sentences in plain English, then one sentence starting "Limitations:".`;

const NEWSROOM_SYSTEM = `You draft a short, editable LinkedIn-style post (80-120 words) for the given executive persona,
based ONLY on the provided synthetic headlines. Mark it clearly as a draft. No invented facts, figures, company names or promises.`;

async function narrate(offering: string, scenario: unknown, output: EngineOutput): Promise<{ narrative?: string; aiNotice?: string }> {
  if (!process.env.OPENAI_API_KEY) return { aiNotice: "AI assistance isn't configured. Showing the deterministic result only." };
  try {
    // OPENAI_BASE_URL optionally points at an OpenAI-compatible gateway (e.g. OpenRouter).
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, baseURL: process.env.OPENAI_BASE_URL || undefined, timeout: 20_000, maxRetries: 1 });
    const res = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL ?? "gpt-5-mini",
      messages: [
        { role: "system", content: offering === "persona-newsroom" ? NEWSROOM_SYSTEM : SYSTEM },
        // Synthetic scenario + deterministic output only; never user free text or real data.
        { role: "user", content: JSON.stringify({ offering, scenario, result: output }) },
      ],
    });
    const text = res.choices[0]?.message?.content?.trim();
    return text ? { narrative: text } : { aiNotice: "The AI assistant returned nothing. Showing the deterministic result only." };
  } catch {
    return { aiNotice: "The AI assistant is unavailable right now. Showing the deterministic result only." };
  }
}

const runSchema = z.object({
  offering: z.string().regex(/^[a-z0-9-]+$/),
  scenario: z.string().regex(/^[a-z0-9-]+$/),
  mode: z.enum(["deterministic", "ai_assisted"]),
  values: z.record(z.string(), z.union([z.number(), z.string()])),
  org: z.string().regex(/^[a-z0-9-]+$/).optional(),
});

export async function runScenario(raw: z.input<typeof runSchema>): Promise<RunResult> {
  const parsed = runSchema.safeParse(raw);
  if (!parsed.success) return { error: "Invalid run request." };
  const { offering, scenario: key, mode, values } = parsed.data;
  // Client sandboxes run inside one org (tenant + user isolated); otherwise it's the employee playground.
  const orgId = parsed.data.org ? (await requireOrg(parsed.data.org)).org.org_id : (await requireEmployee(), null);
  const scenario = scenarioFor(offering, key);
  const engine = engines[offering];
  if (!scenario || !engine) return { error: "Unknown scenario." };
  if (orgId) {
    const { data: ent } = await (await createInsForgeServerClient()).database
      .from("entitlements").select("offerings!inner(slug)").eq("org_id", orgId).eq("offerings.slug", offering).limit(1);
    if (!ent?.length) return { error: "This offering isn't enabled for your organisation." };
  }

  // Only editable fields can change, and only within the scenario's safe bounds.
  const inputs: Record<string, number | string> = { document: scenario.document ?? "" };
  for (const f of scenario.fields) {
    const v = f.editable ? values[f.key] : undefined;
    if (v === undefined) inputs[f.key] = f.value;
    else if (f.options) inputs[f.key] = f.options.includes(String(v)) ? String(v) : f.value;
    else if (typeof f.value === "number") {
      const num = Number(v);
      if (!Number.isFinite(num)) return { error: `${f.label} must be a number.` };
      inputs[f.key] = Math.min(f.max ?? num, Math.max(f.min ?? num, num));
    } else inputs[f.key] = f.value;
  }

  const output: RunResult["output"] = engine(inputs);
  if (mode === "ai_assisted") Object.assign(output, await narrate(offering, { entity: scenario.entity, summary: scenario.summary, inputs }, output));

  const insforge = await createInsForgeServerClient();
  const { data: off } = await insforge.database.from("offerings").select("id").eq("slug", offering).single();
  const { data, error } = await insforge.database
    .from("playground_runs")
    .insert([{ offering_id: (off as { id: string } | null)?.id, org_id: orgId, scenario_key: key, mode, inputs, output }])
    .select("id")
    .single();
  if (error) return { error: "The run completed but couldn't be saved.", output, mode };
  return { runId: (data as { id: string }).id, output, mode };
}

const feedbackSchema = z.object({
  runId: z.string().uuid(),
  useful: z.boolean(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(1000).optional(),
});

export async function saveFeedback(raw: z.input<typeof feedbackSchema>): Promise<{ ok?: boolean; error?: string }> {
  await requireUser(); // RLS limits feedback to the caller's own runs
  const parsed = feedbackSchema.safeParse(raw);
  if (!parsed.success) return { error: "Please choose useful / not useful and a rating." };
  const { runId, ...feedback } = parsed.data;
  const insforge = await createInsForgeServerClient();
  const { error } = await insforge.database.from("playground_runs").update({ feedback }).eq("id", runId);
  return error ? { error: "Couldn't save feedback." } : { ok: true };
}
