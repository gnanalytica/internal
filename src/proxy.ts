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
  // API-key-authenticated v1 API, and static assets.
  matcher: ["/((?!api/auth|api/v1|auth|_next/static|_next/image|favicon.ico).*)"],
};
