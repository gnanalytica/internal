import { askContext } from "@/lib/actions";
import { ASK_SYSTEM, askPrompt } from "@/lib/ask-prompt";
import { streamClaude } from "@/lib/ai";

/**
 * Stream an answer grounded in the workspace's docs and issues.
 *
 * NDJSON rather than plain text because the sources are known before the first
 * token and are worth showing immediately: one `sources` line, then a `delta`
 * per chunk, then `done` or `error`. A bare text stream would have forced the
 * sources to wait for the answer they belong to.
 *
 * Session-authenticated by `proxy.ts`, like every other browser route here —
 * `askContext` resolves the workspace from that session, so a caller can only
 * ever read their own.
 */
export async function POST(req: Request) {
  const { question } = (await req.json()) as { question?: string };
  const q = (question ?? "").trim();
  if (!q) return new Response("Ask something.", { status: 400 });

  let ctx: Awaited<ReturnType<typeof askContext>>;
  try {
    ctx = await askContext(q);
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Couldn't answer that" },
      { status: 503 },
    );
  }

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
          prompt: askPrompt(q, ctx.blocks),
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
        controller.enqueue(
          line({ type: "error", message: err instanceof Error ? err.message : "Couldn't answer that" }),
        );
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
