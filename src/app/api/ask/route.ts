import { askContext } from "@/lib/actions";
import { askStreamResponse } from "@/lib/ask-stream";

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
 * ever read their own. API clients (the mobile app) use `/api/v1/ask`.
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

  return askStreamResponse(q, ctx);
}
