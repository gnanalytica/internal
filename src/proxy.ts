import { auth } from "@/lib/auth/server";

// Next.js 16 middleware (proxy.ts). Redirects unauthenticated users to sign-in.
export default auth.middleware({
  loginUrl: "/auth/sign-in",
});

export const config = {
  // Protect everything except the auth pages, the auth API proxy, the
  // API-key-authenticated v1 API, and static assets.
  matcher: ["/((?!api/auth|api/v1|auth|_next/static|_next/image|favicon.ico).*)"],
};
