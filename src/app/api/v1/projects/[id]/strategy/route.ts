import { apiApplyStrategyOp, apiGetStrategy, loadProjectMeta } from "@/lib/api/business-ops";
import { ok, readJson, withApiAuth } from "@/lib/api/http";
import { assertProjectVisible } from "@/lib/api/scope";
import { parseStrategyOp } from "@/lib/api/strategy-op";

type Params = { id: string };

/**
 * A project's strategy surface: the saved model with its auto-derived values
 * resolved, plus the scores the web shows. `enabled: false` when the project
 * has the Strategy department turned off; `view: null` before it is set up.
 */
export const GET = withApiAuth<Params>(async (_req, auth, { id }) => {
  assertProjectVisible(auth, id, "Project");
  const project = await loadProjectMeta(auth.workspaceId, id);
  return ok({ data: await apiGetStrategy(project) });
});

/**
 * Apply one strategy edit — the same ops the web applies, e.g.
 * `{ "op": "flipSignal", "id": "…" }` or `{ "op": "setVision", "vision": "…" }`.
 * Answers with the updated surface.
 */
export const POST = withApiAuth<Params>(async (req, auth, { id }) => {
  assertProjectVisible(auth, id, "Project");
  const op = parseStrategyOp(await readJson<unknown>(req));
  const project = await loadProjectMeta(auth.workspaceId, id);
  return ok({ data: await apiApplyStrategyOp(auth.workspaceId, project, op) });
});
