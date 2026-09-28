import { eq } from "drizzle-orm";

import { db } from "@/db";
import { workspaces } from "@/db/schema";
import { ok, readJson, withAdminApiAuth, withApiAuth } from "@/lib/api/http";
import { cleanBets } from "@/lib/api/overview-rules";

async function readBets(workspaceId: string): Promise<string[]> {
  const [ws] = await db.select({ bets: workspaces.bets }).from(workspaces).where(eq(workspaces.id, workspaceId)).limit(1);
  return (ws?.bets ?? []).filter(Boolean);
}

/** The company's "focus this quarter" bets shown on the Overview. */
export const GET = withApiAuth(async (_req, auth) => {
  const bets = await readBets(auth.workspaceId);
  return ok({ data: bets, count: bets.length });
});

/** Replace the bets: `{ bets: string[] }`, trimmed, blanks dropped, at most five. Admins only. */
export const PATCH = withAdminApiAuth(async (req, auth) => {
  const body = await readJson<{ bets?: unknown }>(req);
  const bets = cleanBets(body.bets);
  await db.update(workspaces).set({ bets }).where(eq(workspaces.id, auth.workspaceId));
  return ok({ data: bets, count: bets.length });
});
