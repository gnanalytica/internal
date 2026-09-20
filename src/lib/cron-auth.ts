/**
 * Vercel signs cron invocations with `Authorization: Bearer $CRON_SECRET`.
 * Without a configured secret the route stays CLOSED: an unset env var must
 * never turn `Bearer undefined` into a valid credential.
 */
export function isCronRequest(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}
