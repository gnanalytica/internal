import { auth } from "@/lib/auth/server";
import type { NextRequest } from "next/server";

// Next.js 16 middleware (proxy.ts). Redirects unauthenticated users to sign-in.
// The middleware (and the underlying auth instance) is built lazily on the first
// request so `next build` doesn't need the auth secrets to be present.
export default function proxy(request: NextRequest) {
  return auth.middleware({ loginUrl: "/auth/sign-in" })(request);
}

export const config = {
  // Protect everything except the auth pages, the auth API proxy, the
  // API-key-authenticated v1 API, and static assets.
  matcher: ["/((?!api/auth|api/v1|auth|_next/static|_next/image|favicon.ico).*)"],
};
