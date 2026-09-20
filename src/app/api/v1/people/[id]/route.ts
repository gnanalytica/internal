import { notFound, ok, readJson, withApiAuth } from "@/lib/api/http";
import { apiPatchPerson, personDetailDto, type PersonPatch } from "@/lib/api/people-ops";
import { getPersonView, resolveContactId } from "@/lib/sheet-crm/queries";

type P = { id: string };

/** One person by contact id or sheet person id (P#####): sheet rows, network, timeline. */
export const GET = withApiAuth<P>(async (_req, auth, { id }) => {
  const contactId = await resolveContactId(auth.workspaceId, id);
  const view = contactId ? await getPersonView(auth.workspaceId, contactId) : null;
  if (!view) return notFound("Person");
  return ok({ data: personDetailDto(view) });
});

/**
 * Update outreach state and/or sheet cells:
 *   { "outreachStatus": "contacted", "nextActionAt": "2026-09-25",
 *     "sheet": { "prospect_intelligence": { "Next Action": "…" }, "people": { "phone": "…" } } }
 * Each sheet cell is judged on its own (ok / pending / refused_formula / refused_readonly / column_absent).
 */
export const PATCH = withApiAuth<P>(async (req, auth, { id }) => {
  const contactId = await resolveContactId(auth.workspaceId, id);
  if (!contactId) return notFound("Person");
  const body = await readJson<PersonPatch>(req);
  const result = await apiPatchPerson(auth.workspaceId, auth.userId, contactId, body);
  const view = await getPersonView(auth.workspaceId, contactId);
  return ok({ data: view ? personDetailDto(view) : { id: contactId }, writes: result.writes });
});
