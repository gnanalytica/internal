import { isAiConfigured } from "@/lib/ai";
import { askContextForApi } from "@/lib/api/ask-ops";
import { apiError, readJson, withApiAuth } from "@/lib/api/http";
import { askStreamResponse } from "@/lib/ask-stream";

/**
 * Ask AI over the API: `{ question }` in, an NDJSON stream out — one
 * `{type:"sources", sources:[{kind,id,title,href}]}` line, then
 * `{type:"delta", text}` chunks, then `{type:"done"}` or `{type:"error", message}`.
 *
 * Retrieval is limited to what the caller may see: a member signed in on their
 * phone never has a confidential project's docs or issues read by the model.
 */
export const POST = withApiAuth(async (req, auth) => {
  const { question } = await readJson<{ question?: unknown }>(req);
  const q = typeof question === "string" ? question.trim().slice(0, 1000) : "";
  if (!q) return apiError("Ask something: `question` is required.", 400);
  if (!isAiConfigured()) return apiError("AI isn't configured for this workspace yet.", 503);

  const ctx = await askContextForApi(auth.workspaceId, q, auth.scope);
  return askStreamResponse(q, ctx);
});
