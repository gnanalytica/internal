import { ApiInputError } from "@/lib/api/errors";
import { ok, readJson, withApiAuth } from "@/lib/api/http";
import { invalidateProspects, kindOr404, parseInput, recordId, requireMemberName } from "@/lib/api/prospects";
import { logProspectTouch, readProspectDetail } from "@/lib/prospects/service";
import { touchSchema } from "@/lib/prospects/touch";

type Params = { kind: string; id: string };

/**
 * Log a call, message or meeting on this record, as the caller: updates the
 * row (status, last_contacted, next step, what was learnt, a dated line at
 * the top of notes) and appends one row to Activity. The body is the web's
 * log form — channel, direction, outcome, durationMin, summary, statusAfter,
 * nextStep, nextStepDate, fields — with `name` optional.
 */
export const POST = withApiAuth<Params>(async (req, auth, { kind, id }) => {
  const k = kindOr404(kind);
  const rid = recordId(id);
  const body = await readJson<Record<string, unknown>>(req);
  const by = await requireMemberName(auth);
  const name = typeof body.name === "string" ? body.name : ((await readProspectDetail(k, rid))?.record.name ?? "");
  const input = parseInput(touchSchema, { ...body, kind: k, id: rid, name });
  const res = await logProspectTouch(input, by, invalidateProspects);
  if (!res.ok) throw new ApiInputError(res.message, 422);
  return ok({ data: { written: res.written, message: res.message } }, 201);
});
