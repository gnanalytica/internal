import { authenticateApiKey, type ApiAuth } from "./auth";

export function ok(data: unknown, status = 200): Response {
  return Response.json(data, { status });
}

export function apiError(message: string, status = 400): Response {
  return Response.json({ error: message }, { status });
}

export const unauthorized = () =>
  apiError(
    "Unauthorized. Provide an API key via `Authorization: Bearer <key>`.",
    401,
  );
export const notFound = (what = "Resource") => apiError(`${what} not found.`, 404);

/**
 * Wrap a route handler with API-key auth. The wrapped fn receives the request,
 * the resolved auth context, and the route's params.
 */
export function withApiAuth<P>(
  fn: (req: Request, auth: ApiAuth, params: P) => Promise<Response> | Response,
) {
  return async (req: Request, ctx: { params: Promise<P> }): Promise<Response> => {
    const auth = await authenticateApiKey(req);
    if (!auth) return unauthorized();
    try {
      const params = (ctx?.params ? await ctx.params : ({} as P)) as P;
      return await fn(req, auth, params);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Internal error";
      return apiError(message, 400);
    }
  };
}

/** Parse a JSON body, tolerating empty bodies. */
export async function readJson<T = Record<string, unknown>>(
  req: Request,
): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    return {} as T;
  }
}
