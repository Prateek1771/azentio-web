// InsForge Model Gateway (OpenRouter), included free with the project ($1 credit). Server-only key.
// Plain fetch so scripts and the app share it; no provider SDK needed.
export const AI_MODEL = () => process.env.AIRA_MODEL || "openai/gpt-4o-mini";

type Msg = { role: "system" | "user" | "assistant"; content: string };
export type ChatResult = { text: string; model: string; tokens: number };

export async function chat(messages: Msg[], opts: { maxTokens?: number; timeoutMs?: number; model?: string; json?: boolean } = {}): Promise<ChatResult> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error("AI gateway not configured (run: npx -y @insforge/cli ai setup)");
  const model = opts.model ?? AI_MODEL();
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "X-Title": "azentio.ai portal" },
    body: JSON.stringify({ model, messages, temperature: 0, max_tokens: opts.maxTokens ?? 500, ...(opts.json ? { response_format: { type: "json_object" } } : {}) }),
    signal: AbortSignal.timeout(opts.timeoutMs ?? 20_000),
  });
  const json = (await res.json().catch(() => ({}))) as { choices?: { message?: { content?: string } }[]; usage?: { total_tokens?: number }; error?: { message?: string } };
  if (!res.ok) throw new Error(`gateway ${res.status}: ${json.error?.message ?? "error"}`);
  return { text: json.choices?.[0]?.message?.content?.trim() ?? "", model, tokens: json.usage?.total_tokens ?? 0 };
}
