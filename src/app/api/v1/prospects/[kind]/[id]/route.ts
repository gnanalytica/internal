import { ApiInputError } from "@/lib/api/errors";
import { notFound, ok, readJson, withApiAuth } from "@/lib/api/http";
import { invalidateProspects, kindOr404, parseInput, recordId } from "@/lib/api/prospects";
import { readProspectDetail, saveProspectRecord } from "@/lib/prospects/service";
import { patchSchema } from "@/lib/prospects/touch";

type Params = { kind: string; id: string };

/** One record in full, with its Activity history (newest first). */
export const GET = withApiAuth<Params>(async (_req, _auth, { kind, id }) => {
  const detail = await readProspectDetail(kindOr404(kind), recordId(id));
  return detail ? ok({ data: detail }) : notFound("Prospect");
});

/**
 * Write cells on this row: the body is `{ column: value }`, by sheet header
 * name. Only the dashboard's writable columns for this kind are accepted;
 * formula columns and anything else are refused, as on the web.
 */
export const PATCH = withApiAuth<Params>(async (req, _auth, { kind, id }) => {
  const k = kindOr404(kind);
  const patch = parseInput(patchSchema, await readJson(req));
  if (!Object.keys(patch).length) throw new ApiInputError("Nothing to save.", 400);
  const res = await saveProspectRecord(k, recordId(id), patch, invalidateProspects);
  if (!res.ok) throw new ApiInputError(res.message, 422);
  return ok({ data: { written: res.written, message: res.message } });
});
