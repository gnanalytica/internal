import "server-only";

import Anthropic from "@anthropic-ai/sdk";

/** True when the Anthropic API key is configured (enables AI features). */
export function isAiConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

const MODEL = process.env.AI_MODEL || "claude-opus-5";

/**
 * Both callers are short, grounded tasks over context we hand them — read this
 * doc, answer from these rows. Effort buys thoroughness on open-ended problems
 * and mostly buys tokens on these, so they run a step below the `high` default.
 */
const EFFORT = "medium" as const;

/**
 * No `cache_control` anywhere here, deliberately. Caching is a prefix match and
 * the minimum cacheable prefix is 512-4096 tokens depending on the model; our
 * system prompts are two sentences, and everything large — the document, the
 * retrieved rows — is in the user turn and differs every call. A breakpoint
 * would cache nothing and read as if we had thought about it.
 */
function client(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("AI isn't configured. Add an ANTHROPIC_API_KEY.");
  }
  return new Anthropic();
}

/**
 * A refusal and a truncation both arrive as HTTP 200 with content attached, so
 * nothing throws and the caller reads a partial answer as a whole one. That is
 * how `max_tokens: 800` went unnoticed on the Ask path.
 */
function assertComplete(stopReason: string | null, stopDetails: unknown): void {
  if (stopReason === "refusal") {
    const d = stopDetails as { category?: string; explanation?: string } | null;
    throw new Error(
      `The model declined to answer${d?.category ? ` (${d.category})` : ""}.` +
        (d?.explanation ? ` ${d.explanation}` : ""),
    );
  }
  if (stopReason === "max_tokens") {
    throw new Error("The answer was cut off before it finished. Try a narrower question.");
  }
}

function text(content: Anthropic.ContentBlock[]): string {
  return content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
}

/** Call Claude and return the text output. */
export async function callClaude(opts: {
  system?: string;
  prompt: string;
  maxTokens?: number;
}): Promise<string> {
  const res = await client().messages.create({
    model: MODEL,
    max_tokens: opts.maxTokens ?? 16000,
    thinking: { type: "adaptive" },
    output_config: { effort: EFFORT },
    ...(opts.system ? { system: opts.system } : {}),
    messages: [{ role: "user", content: opts.prompt }],
  });
  assertComplete(res.stop_reason, res.stop_details);
  return text(res.content);
}

/**
 * Call Claude and get back data that matches `schema`.
 *
 * The alternative — asking for JSON in the prompt and finding it in the prose
 * afterwards — fails silently: a model that adds a sentence before the array,
 * or truncates mid-object, yields an empty list that looks like "no issues
 * found" rather than a parse failure.
 */
export async function callClaudeJson<T>(opts: {
  system?: string;
  prompt: string;
  schema: Record<string, unknown>;
  maxTokens?: number;
}): Promise<T> {
  const res = await client().messages.create({
    model: MODEL,
    max_tokens: opts.maxTokens ?? 16000,
    thinking: { type: "adaptive" },
    output_config: { effort: EFFORT, format: { type: "json_schema", schema: opts.schema } },
    ...(opts.system ? { system: opts.system } : {}),
    messages: [{ role: "user", content: opts.prompt }],
  });
  assertComplete(res.stop_reason, res.stop_details);
  return JSON.parse(text(res.content)) as T;
}

/**
 * Stream the text of an answer.
 *
 * The final message is inspected after the stream closes: a refusal throws, and
 * a truncation is appended as a visible note rather than thrown, because by
 * then the reader already has most of an answer and silently dropping it would
 * be the worse failure.
 */
export async function* streamClaude(opts: {
  system?: string;
  prompt: string;
  maxTokens?: number;
}): AsyncGenerator<string> {
  const stream = client().messages.stream({
    model: MODEL,
    max_tokens: opts.maxTokens ?? 16000,
    thinking: { type: "adaptive" },
    output_config: { effort: EFFORT },
    ...(opts.system ? { system: opts.system } : {}),
    messages: [{ role: "user", content: opts.prompt }],
  });

  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      yield event.delta.text;
    }
  }

  const final = await stream.finalMessage();
  if (final.stop_reason === "refusal") {
    const d = final.stop_details as { category?: string } | null;
    throw new Error(`The model declined to answer${d?.category ? ` (${d.category})` : ""}.`);
  }
  if (final.stop_reason === "max_tokens") {
    yield "\n\n[The answer was cut off before it finished.]";
  }
}
