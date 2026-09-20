import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/data";
import { appBaseUrl } from "@/lib/email";
import { authUrl, isGoogleOAuthConfigured } from "@/lib/google/oauth";

/** Browser GET (session-authenticated by the proxy): start the Google consent flow. */
export async function GET() {
  if (!isGoogleOAuthConfigured()) return Response.json({ error: "Google OAuth is not configured." }, { status: 503 });
  const me = await getCurrentUser();
  redirect(authUrl(appBaseUrl(), me.id));
}
