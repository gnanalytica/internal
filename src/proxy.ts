import { auth } from "@/lib/auth/server";
import { NextResponse, type NextRequest } from "next/server";

// Next.js 16 middleware (proxy.ts). Redirects unauthenticated users to sign-in.
// The middleware (and the underlying auth instance) is built lazily on the first
// request so `next build` doesn't need the auth secrets to be present.
export default function proxy(request: NextRequest) {
  // Server Functions (actions) POST to the page route they live on. Don't run
  // the auth redirect on them: a 307 in response to an action surfaces in the
  // browser as the opaque "An unexpected response was received from the server"
  // error and breaks every mutation. Actions enforce auth themselves via
  // getWorkspace()/getCurrentUser(), which redirect gracefully. Per the Next.js
  // docs: "Always verify authentication and authorization inside each Server
  // Function rather than relying on Proxy alone." Only POSTs to these matched
  // page routes are Server Functions (the API routes are excluded below).
  if (request.method === "POST") {
    return NextResponse.next();
  }
  return auth.middleware({ loginUrl: "/auth/sign-in" })(request);
}

export const config = {
  // Protect everything except the auth pages, the auth API proxy, the
  // API-key-authenticated v1 API, the OAuth token endpoint, and static assets.
  //
  // `api/oauth` is excluded because it authenticates the CALLER with client
  // credentials, not a browser session — a session redirect there is nonsense
  // (the client has no session and cannot follow one).
  //
  // It happened to work anyway, because the POST guard above returns early for
  // every POST. That is an accident of a rule written for Server Functions: if
  // that guard is ever narrowed, the token exchange would start 307-ing to a
  // sign-in page and the Connect flow would break with a confusing error. Being
  // explicit here means the exclusion survives on its own reasoning.
  //
  // NOTE: `/oauth/authorize` is deliberately NOT excluded — that one IS a
  // browser page and must send an anonymous visitor to sign in first.
  matcher: [
    "/((?!api/auth|api/oauth|api/v1|auth|_next/static|_next/image|favicon.ico).*)",
  ],
};
