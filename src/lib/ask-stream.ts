import "server-only";

import { streamClaude } from "@/lib/ai";
import { ASK_SYSTEM, askPrompt } from "@/lib/ask-prompt";

/**
 * Stream an Ask answer as NDJSON: one `sources` line, then a `delta` per
 * chunk, then `done` or `error`. Shared by the web's `/api/ask` (session) and
 * `/api/v1/ask` (API key), which differ only in how they retrieve context.
 */
export function askStreamResponse(question: string, ctx: { sources: unknown[]; blocks: string[]; note?: string }): Response {
  const encoder = new TextEncoder();
  const line = (o: unknown) => encoder.encode(`${JSON.stringify(o)}\n`);

  const stream = new ReadableStream({
    async start(controller) {
      try {
        controller.enqueue(line({ type: "sources", sources: ctx.sources }));

        // Nothing retrieved: say so and stop, without spending a model call.
        if (ctx.note !== undefined) {
          controller.enqueue(line({ type: "delta", text: ctx.note }));
          controller.enqueue(line({ type: "done" }));
          return;
        }

        for await (const text of streamClaude({
          system: ASK_SYSTEM,
          prompt: askPrompt(question, ctx.blocks),
          // Thinking tokens count against this, so it is not the answer's
          // length — a concise reply that thought hard still needs the room.
          maxTokens: 8192,
        })) {
          controller.enqueue(line({ type: "delta", text }));
        }
        controller.enqueue(line({ type: "done" }));
      } catch (err) {
        // The response has already started, so the status is long since sent;
        // the only honest way to report a mid-stream failure is in the stream.
        controller.enqueue(line({ type: "error", message: err instanceof Error ? err.message : "Couldn't answer that" }));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
