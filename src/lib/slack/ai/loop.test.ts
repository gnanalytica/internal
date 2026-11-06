import Anthropic from "@anthropic-ai/sdk";
import type { StreamChunk } from "chat";
import { describe, expect, it, vi } from "vitest";

import { CUT_OFF_TEXT, EMPTY_TEXT, ERROR_TEXT, REFUSAL_TEXT, runAgent, type AgentOptions, type ModelClient, type ModelStream } from "./loop";

/* A scripted stand-in for the API: each call to stream() plays the next turn. */

type Turn = { text?: string[]; tools?: { id: string; name: string; input: unknown }[]; stop?: Anthropic.StopReason; error?: Error };

const usage = { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } as Anthropic.Usage;

function fakeClient(turns: Turn[]): ModelClient & { calls: Anthropic.MessageStreamParams[] } {
  const calls: Anthropic.MessageStreamParams[] = [];
  return {
    calls,
    messages: {
      stream(body) {
        calls.push(structuredClone(body));
        const turn = turns.shift();
        if (!turn) throw new Error("unexpected call");
        const events = (turn.text ?? []).map(
          (t) => ({ type: "content_block_delta", index: 0, delta: { type: "text_delta", text: t } }) as Anthropic.MessageStreamEvent,
        );
        const content = [
          ...(turn.text?.length ? [{ type: "text", text: turn.text.join(""), citations: null }] : []),
          ...(turn.tools ?? []).map((t) => ({ type: "tool_use", id: t.id, name: t.name, input: t.input })),
        ] as Anthropic.ContentBlock[];
        const stream: ModelStream = {
          async *[Symbol.asyncIterator]() {
            for (const e of events) yield e;
            if (turn.error) throw turn.error;
          },
          async finalMessage() {
            return {
              id: "m",
              type: "message",
              role: "assistant",
              model: "claude-haiku-5-5",
              content,
              stop_reason: turn.stop ?? (turn.tools?.length ? "tool_use" : "end_turn"),
              stop_sequence: null,
              stop_details: null,
              usage,
            } as unknown as Anthropic.Message;
          },
        };
        return stream;
      },
    },
  };
}

function options(client: ModelClient, over: Partial<AgentOptions> = {}): AgentOptions {
  return {
    client,
    model: "claude-haiku-5-5",
    system: [{ type: "text", text: "sys" }],
    tools: [{ name: "search_tasks", input_schema: { type: "object" } }],
    messages: [{ role: "user", content: "hi" }],
    execute: async () => ({ content: "[]" }),
    labelFor: () => "Searching tasks",
    maxToolRounds: 6,
    maxTokens: 1000,
    ...over,
  };
}

async function collect(gen: AsyncIterable<string | StreamChunk>) {
  const text: string[] = [];
  const chunks: StreamChunk[] = [];
  for await (const c of gen) {
    if (typeof c === "string") text.push(c);
    else chunks.push(c);
  }
  return { text: text.join(""), chunks };
}

describe("runAgent", () => {
  it("streams a plain answer and sends the request the bot is meant to send", async () => {
    const client = fakeClient([{ text: ["Two tasks ", "are open."] }]);
    const logUsage = vi.fn();
    const out = await collect(runAgent(options(client, { logUsage })));
    expect(out.text).toBe("Two tasks are open.");
    const req = client.calls[0];
    expect(req.model).toBe("claude-haiku-5-5");
    expect(req.thinking).toEqual({ type: "adaptive" });
    expect(req.output_config).toEqual({ effort: "low" });
    expect(req.tool_choice).toEqual({ type: "auto" });
    expect(req.max_tokens).toBe(1000);
    expect(req.messages.at(-1)?.role).toBe("user");
    expect(logUsage).toHaveBeenCalledWith(expect.objectContaining({ round: 1, stopReason: "end_turn", usage }));
  });

  it("runs tools, returns every result in one user turn, and shows progress", async () => {
    const client = fakeClient([
      {
        text: ["Looking."],
        tools: [
          { id: "t1", name: "search_tasks", input: { text: "login" } },
          { id: "t2", name: "get_task", input: { task: "VAL-1" } },
        ],
      },
      { text: ["Found it."] },
    ]);
    const execute = vi.fn(async (name: string) => (name === "get_task" ? { content: "nope", isError: true } : { content: '{"tasks":[]}' }));
    const out = await collect(runAgent(options(client, { execute })));

    expect(execute.mock.calls).toEqual([
      ["search_tasks", { text: "login" }],
      ["get_task", { task: "VAL-1" }],
    ]);
    expect(out.text).toBe("Looking.\n\nFound it.");
    expect(out.chunks.map((c) => c.type === "task_update" && `${c.id}:${c.status}`)).toEqual([
      "t1:in_progress",
      "t1:complete",
      "t2:in_progress",
      "t2:error",
    ]);

    const second = client.calls[1].messages;
    expect(second.at(-2)?.role).toBe("assistant");
    const results = second.at(-1)!;
    expect(results.role).toBe("user");
    expect(results.content).toEqual([
      { type: "tool_result", tool_use_id: "t1", content: '{"tasks":[]}' },
      { type: "tool_result", tool_use_id: "t2", content: "nope", is_error: true },
    ]);
  });

  it("caps tool rounds, then makes one last call with tools off", async () => {
    const loop = { tools: [{ id: "t", name: "search_tasks", input: {} }] };
    const client = fakeClient([loop, loop, { text: ["Here's what I found."] }]);
    const execute = vi.fn(async () => ({ content: "[]" }));
    const out = await collect(runAgent(options(client, { execute, maxToolRounds: 2 })));
    expect(execute).toHaveBeenCalledTimes(2);
    expect(client.calls).toHaveLength(3);
    expect(client.calls[2].tool_choice).toEqual({ type: "none" });
    expect(out.text).toBe("Here's what I found.");
  });

  it("turns a refusal into a plain message and runs none of that turn's tools", async () => {
    const client = fakeClient([{ text: ["Sure, "], tools: [{ id: "t", name: "create_task", input: {} }], stop: "refusal" }]);
    const execute = vi.fn();
    const out = await collect(runAgent(options(client, { execute })));
    expect(execute).not.toHaveBeenCalled();
    expect(out.text).toBe(`Sure, \n\n${REFUSAL_TEXT}`);
  });

  it("never runs a tool call cut off at max_tokens", async () => {
    const client = fakeClient([{ tools: [{ id: "t", name: "create_task", input: { title: "Half" } }], stop: "max_tokens" }]);
    const execute = vi.fn();
    const out = await collect(runAgent(options(client, { execute })));
    expect(execute).not.toHaveBeenCalled();
    expect(out.text).toBe(CUT_OFF_TEXT);
  });

  it("answers with a plain message when the API fails, keeping what was already said", async () => {
    const client = fakeClient([{ text: ["Let me check"], error: new Error("socket hang up") }]);
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const out = await collect(runAgent(options(client)));
    spy.mockRestore();
    expect(out.text).toBe(`Let me check\n\n${ERROR_TEXT}`);
  });

  it("reports a tool that throws as an error result instead of failing the reply", async () => {
    const client = fakeClient([{ tools: [{ id: "t", name: "search_tasks", input: {} }] }, { text: ["Sorry, that didn't work."] }]);
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const out = await collect(runAgent(options(client, { execute: async () => Promise.reject(new Error("db down")) })));
    spy.mockRestore();
    const result = (client.calls[1].messages.at(-1)!.content as Anthropic.ToolResultBlockParam[])[0];
    expect(result.is_error).toBe(true);
    expect(out.text).toBe("Sorry, that didn't work.");
  });

  it("defuses mentions in the model's text", async () => {
    const out = await collect(runAgent(options(fakeClient([{ text: ["ping @here and <", "!channel>"] }]))));
    expect(out.text).not.toMatch(/@here|<!channel>/);
  });

  it("says something even when the model says nothing", async () => {
    const out = await collect(runAgent(options(fakeClient([{ text: [] }]))));
    expect(out.text).toBe(EMPTY_TEXT);
  });
});
