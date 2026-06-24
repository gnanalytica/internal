import { auth } from "@/lib/auth/server";

// Build the handler per request rather than at module load, so the underlying
// auth instance is only constructed when a request is served — `next build`
// can collect page data for this route without auth secrets being present.
export const GET = (...args: Parameters<ReturnType<typeof auth.handler>["GET"]>) =>
  auth.handler().GET(...args);

export const POST = (...args: Parameters<ReturnType<typeof auth.handler>["POST"]>) =>
  auth.handler().POST(...args);
