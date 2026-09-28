import { ok, withApiAuth } from "@/lib/api/http";
import { apiProjectPages } from "@/lib/api/planning-ops";

type Params = { id: string };

/** The project's Docs: its page tree in the editor's order, flattened with a depth per row. */
export const GET = withApiAuth<Params>(async (_req, auth, { id }) => {
  const data = await apiProjectPages(auth, id);
  return ok({ data, count: data.length });
});
