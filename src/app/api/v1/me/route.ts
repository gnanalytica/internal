import { eq } from "drizzle-orm";

import { db } from "@/db";
import { workspaces } from "@/db/schema";
import { ok, withApiAuth } from "@/lib/api/http";

export const GET = withApiAuth(async (_req, auth) => {
  const [ws] = await db
    .select({ id: workspaces.id, name: workspaces.name, slug: workspaces.slug })
    .from(workspaces)
    .where(eq(workspaces.id, auth.workspaceId))
    .limit(1);
  return ok({ workspace: ws ?? null });
});
