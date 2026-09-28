import { z } from "zod";

import { ApiInputError } from "@/lib/api/errors";
import { ok, readJson, withApiAuth } from "@/lib/api/http";
import { invalidateProspects, parseInput, requireMemberName } from "@/lib/api/prospects";
import { assignProspects } from "@/lib/prospects/service";
import { idSchema, kindSchema } from "@/lib/prospects/touch";

const body = z.object({ kind: kindSchema, ids: z.array(idSchema).min(1).max(50) });

/** Assign up to 50 records of one kind to the caller, by first name as the team writes it. */
export const POST = withApiAuth(async (req, auth) => {
  const { kind, ids } = parseInput(body, await readJson(req));
  const name = await requireMemberName(auth);
  const res = await assignProspects(kind, ids, name, invalidateProspects);
  if (!res.ok) throw new ApiInputError(res.message, 422);
  return ok({ data: { written: res.written, message: res.message } });
});
