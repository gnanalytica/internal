import { createNeonAuth, type NeonAuth } from "@neondatabase/auth/next/server";

/**
 * Server-side Neon Auth (Better Auth) instance.
 * Provides .handler() for the API proxy, .middleware() for route protection,
 * and .getSession()/.signUp/.signIn/.signOut server methods.
 *
 * Construction is deferred until the instance is first used. `next build`
 * evaluates the route (`/api/auth/[...path]`) and proxy modules while
 * collecting page data; building eagerly here would require
 * NEON_AUTH_COOKIE_SECRET / NEON_AUTH_BASE_URL to be present at build time and
 * fail the build when they aren't (e.g. preview deployments). The secrets are
 * only actually needed to serve a request, so we construct lazily instead.
 */
let instance: NeonAuth | null = null;

function resolveAuth(): NeonAuth {
  if (!instance) {
    instance = createNeonAuth({
      baseUrl: process.env.NEON_AUTH_BASE_URL!,
      cookies: {
        secret: process.env.NEON_AUTH_COOKIE_SECRET!,
        // 'lax' lets the session cookie survive the top-level cross-site redirect
        // back from an OAuth provider (Google/GitHub). Default 'strict' drops it.
        sameSite: "lax",
      },
    });
  }
  return instance;
}

export const auth = new Proxy({} as NeonAuth, {
  get(_target, prop, receiver) {
    const real = resolveAuth();
    const value = Reflect.get(real as object, prop, receiver);
    return typeof value === "function" ? value.bind(real) : value;
  },
});
