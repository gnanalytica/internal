import { notFound, ok, readJson, withApiAuth } from "@/lib/api/http";
import { apiFeatureDetail, apiUpdateFeature } from "@/lib/api/planning-ops";
import { recordRoute } from "@/lib/api/record-route";

type Params = { id: string };

const handlers = recordRoute("features");

/** The feature with its PRD (`spec`) as Markdown and its linked tasks. */
export const GET = withApiAuth<Params>(async (_req, auth, { id }) => ok({ data: await apiFeatureDetail(auth, id) }));

/** The writable fields, plus `spec` as Markdown (stored as the editor's document). */
export const PATCH = withApiAuth<Params>(async (req, auth, { id }) => {
  const patch = await readJson<Record<string, unknown>>(req);
  const updated = await apiUpdateFeature(auth, id, patch);
  if (!updated) return notFound("Feature");
  return ok({ data: await apiFeatureDetail(auth, id), updated: true });
});

export const DELETE = handlers.DELETE;
