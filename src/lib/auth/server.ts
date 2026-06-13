import { createNeonAuth } from "@neondatabase/auth/next/server";

/**
 * Server-side Neon Auth (Better Auth) instance.
 * Provides .handler() for the API proxy, .middleware() for route protection,
 * and .getSession()/.signUp/.signIn/.signOut server methods.
 */
export const auth = createNeonAuth({
  baseUrl: process.env.NEON_AUTH_BASE_URL!,
  cookies: {
    secret: process.env.NEON_AUTH_COOKIE_SECRET!,
  },
});
