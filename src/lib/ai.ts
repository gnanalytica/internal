import "server-only";

/** True when the Anthropic API key is configured (enables AI features). */
export function isAiConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

const MODEL = process.env.AI_MODEL || "claude-sonnet-4-6";

type ClaudeContent = { type: string; text?: string };

/** Call the Anthropic Messages API and return the concatenated text output. */
export async function callClaude(opts: {
  system?: string;
  prompt: string;
  maxTokens?: number;
}): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("AI isn't configured. Add an ANTHROPIC_API_KEY.");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: opts.maxTokens ?? 1024,
      ...(opts.system ? { system: opts.system } : {}),
      messages: [{ role: "user", content: opts.prompt }],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`AI request failed (${res.status}): ${body.slice(0, 200)}`);
  }

  const data = (await res.json()) as { content?: ClaudeContent[] };
  return (data.content ?? [])
    .filter((c) => c.type === "text" && typeof c.text === "string")
    .map((c) => c.text as string)
    .join("");
}
