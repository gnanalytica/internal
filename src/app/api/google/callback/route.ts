import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/data";
import { appBaseUrl } from "@/lib/email";
import { saveGrant } from "@/lib/google/grants";
import { exchangeCode, isGoogleOAuthConfigured, userEmail, verifyState } from "@/lib/google/oauth";

/** Google redirects here with ?code&state. The state must name the signed-in user. */
export async function GET(req: Request) {
  if (!isGoogleOAuthConfigured()) return Response.json({ error: "Google OAuth is not configured." }, { status: 503 });
  const url = new URL(req.url);
  const me = await getCurrentUser();
  const userId = verifyState(url.searchParams.get("state"));
  const code = url.searchParams.get("code");
  if (!userId || userId !== me.id || !code) redirect("/settings?google=error");
  try {
    const tok = await exchangeCode(appBaseUrl(), code);
    if (!tok.refresh_token) redirect("/settings?google=no-refresh-token");
    const email = await userEmail(tok.access_token);
    await saveGrant(me.id, email, tok.scope ?? "", tok.refresh_token);
  } catch (err) {
    console.error("[google] callback", err);
    redirect("/settings?google=error");
  }
  redirect("/settings?google=connected");
}
