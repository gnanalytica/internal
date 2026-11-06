import Anthropic from "@anthropic-ai/sdk";
import type { StreamChunk } from "chat";

import { createSanitizer } from "./prompt";

/**
 * The bot's tool loop, as one stream of what to show in Slack: the model's
 * text as it arrives, plus a task card per tool call while it runs (Slack
 * shows those as a working indicator; adapters that can't simply skip them).
 *
 * A manual loop rather than the SDK's tool runner, because the reply is one
 * Slack message streamed across every round, the rounds are capped, writes
 * that need a confirmation are diverted by the executor, and each call's usage
 * is logged — all of which sit naturally in a loop we own. The client is
 * injected, so tests drive it with a fake and never reach the API.
 *
 * The request follows the model's current API: adaptive thinking (the model's
 * default — no budget is sent), effort "low" for short grounded lookups,
 * tool_choice "auto" (forcing a tool isn't used), no assistant prefill.
 * Thinking blocks go back unchanged in the assistant turn with the tool
 * results, which keeps both the reasoning and the message cache intact.
 */

export type ModelStream = AsyncIterable<Anthropic.MessageStreamEvent> & { finalMessage(): Promise<Anthropic.Message> };

export type ModelClient = {
  messages: { stream(body: Anthropic.MessageStreamParams, options?: { signal?: AbortSignal }): ModelStream };
};

export type ToolResult = { content: string; isError?: boolean };

export type ToolExecutor = (name: string, input: unknown) => Promise<ToolResult>;

export type UsageLog = (u: { round: number; model: string; stopReason: string | null; usage: Anthropic.Usage }) => void;

export type AgentOptions = {
  client: ModelClient;
  model: string;
  system: Anthropic.TextBlockParam[];
  tools: Anthropic.Tool[];
  messages: Anthropic.MessageParam[];
  execute: ToolExecutor;
  /** Shown on the task card while a tool runs, e.g. "Searching tasks". */
  labelFor: (toolName: string) => string;
  maxToolRounds: number;
  maxTokens: number;
  signal?: AbortSignal;
  logUsage?: UsageLog;
};

export const REFUSAL_TEXT = "I can't help with that one.";
export const ERROR_TEXT = "Sorry, something went wrong on my side and I couldn't finish that. Try again in a moment.";
export const CUT_OFF_TEXT = "_(That answer ran long and was cut off — try a narrower question.)_";
export const EMPTY_TEXT = "I don't have an answer for that.";

/** A short reason for the log and, when it's the caller's to fix, for them. */
function apiErrorText(err: unknown): string {
  if (err instanceof Anthropic.RateLimitError) return "I'm getting too many requests right now. Try again in a minute.";
  if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError)
    return "The AI isn't configured correctly (the API key was refused). An admin needs to check ANTHROPIC_API_KEY.";
  if (err instanceof Anthropic.APIConnectionError) return "I couldn't reach the AI service. Try again in a moment.";
  return ERROR_TEXT;
}

export async function* runAgent(opts: AgentOptions): AsyncGenerator<string | StreamChunk> {
  const messages = [...opts.messages];
  const sanitizer = createSanitizer();
  let wrote = false;
  let endsWithBreak = true;

  // Text from a new round starts a new paragraph.
  function* emit(text: string): Generator<string> {
    if (!text) return;
    endsWithBreak = /\n\s*$/.test(text);
    wrote = true;
    yield text;
  }

  for (let round = 0; round <= opts.maxToolRounds; round++) {
    const toolsOff = round === opts.maxToolRounds;
    let final: Anthropic.Message;
    let startedRound = false;
    try {
      const stream = opts.client.messages.stream(
        {
          model: opts.model,
          max_tokens: opts.maxTokens,
          system: opts.system,
          tools: opts.tools,
          // After the last allowed round the model must answer with what it has.
          tool_choice: toolsOff ? { type: "none" } : { type: "auto" },
          thinking: { type: "adaptive" },
          output_config: { effort: "low" },
          messages,
        },
        { signal: opts.signal },
      );
      for await (const event of stream) {
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
          let out = sanitizer.push(event.delta.text);
          if (!startedRound && out) {
            startedRound = true;
            if (wrote && !endsWithBreak) out = `\n\n${out.trimStart()}`;
          }
          yield* emit(out);
        }
      }
      yield* emit(sanitizer.flush());
      final = await stream.finalMessage();
    } catch (err) {
      if (opts.signal?.aborted) return;
      console.error(`[slack-ai] model call failed (round ${round + 1}):`, err);
      yield* emit(`${wrote ? "\n\n" : ""}${apiErrorText(err)}`);
      return;
    }

    opts.logUsage?.({ round: round + 1, model: final.model, stopReason: final.stop_reason, usage: final.usage });

    // A refusal can arrive after partial output, or cut a tool call off mid-input: stop, run nothing.
    if (final.stop_reason === "refusal") {
      yield* emit(`${wrote ? "\n\n" : ""}${REFUSAL_TEXT}`);
      return;
    }
    const toolUses = final.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
    if (final.stop_reason === "max_tokens") {
      // A tool input cut off here would parse as a valid partial object; never run it.
      yield* emit(`${wrote ? "\n\n" : ""}${CUT_OFF_TEXT}`);
      return;
    }
    if (final.stop_reason !== "tool_use" || toolUses.length === 0 || toolsOff) break;

    messages.push({ role: "assistant", content: final.content });
    const results: Anthropic.ToolResultBlockParam[] = [];
    // One at a time: a write and a read of the same task in one turn should
    // see each other, and these calls are quick.
    for (const use of toolUses) {
      const title = opts.labelFor(use.name);
      yield { type: "task_update", id: use.id, title, status: "in_progress" };
      let result: ToolResult;
      try {
        result = await opts.execute(use.name, use.input);
      } catch (err) {
        console.error(`[slack-ai] tool ${use.name} failed:`, err);
        result = { content: "That lookup failed on the server. Tell the person it didn't work and to try again.", isError: true };
      }
      yield { type: "task_update", id: use.id, title, status: result.isError ? "error" : "complete" };
      results.push({ type: "tool_result", tool_use_id: use.id, content: result.content, ...(result.isError ? { is_error: true } : {}) });
    }
    // Every result for the turn goes back in one user message.
    messages.push({ role: "user", content: results });
  }

  if (!wrote) yield EMPTY_TEXT;
}
