import { notFound, ok, withApiAuth } from "@/lib/api/http";
import { recordRoute } from "@/lib/api/record-route";
import { getDatabase } from "@/lib/data";

type Params = { id: string };

/** The database with its field schema and every row. */
export const GET = withApiAuth<Params>(async (_req, auth, { id }) => {
  const database = await getDatabase(auth.workspaceId, id);
  if (!database) return notFound("Database");
  return ok({ data: database });
});

const handlers = recordRoute("databases");

export const PATCH = handlers.PATCH;
export const DELETE = handlers.DELETE;
