import { isCronRequest } from "@/lib/cron-auth";
import { listGrants } from "@/lib/google/grants";
import { ingestGrant } from "@/lib/google/ingest";
import { isGoogleOAuthConfigured } from "@/lib/google/oauth";

/** Every 15 minutes: Gmail + Calendar → interactions, for every connected user. */
export const maxDuration = 300;

export async function GET(req: Request) {
  if (!isCronRequest(req)) return Response.json({ error: "Unauthorized." }, { status: 401 });
  if (!isGoogleOAuthConfigured()) return Response.json({ skipped: "Google OAuth is not configured." });
  const grants = await listGrants();
  const results = [];
  for (const g of grants) results.push(...(await ingestGrant(g)));
  return Response.json({ grants: grants.length, results });
}
