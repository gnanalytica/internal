/**
 * Where to send someone after they sign in, from a `?next=` value — only ever a
 * path on this site. Anything else (another origin, a protocol-relative `//x`,
 * a backslash trick browsers normalise to `//`) falls back to the default, so
 * the sign-in page can never be used to bounce people to another site.
 */
export function safeNextPath(value: string | null | undefined, fallback = "/issues"): string {
  const v = (value ?? "").trim();
  if (!v || v.length > 2000) return fallback;
  if (!v.startsWith("/") || v.startsWith("//") || v.startsWith("/\\") || v.includes("\\")) return fallback;
  if (/^\/(auth|api)\//.test(v)) return fallback;
  return v;
}
