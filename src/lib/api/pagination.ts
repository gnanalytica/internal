export type Cursor = { createdAt: string; id: string };

export function encodeCursor(c: Cursor): string {
  return Buffer.from(JSON.stringify(c)).toString("base64url");
}

export function decodeCursor(raw: string | null): Cursor | null {
  if (!raw) return null;
  try {
    const c = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
    if (typeof c?.createdAt === "string" && typeof c?.id === "string") return c;
  } catch {
    // fall through
  }
  return null;
}

/** Parse `?limit=&cursor=` query params with sane bounds. */
export function pageParams(url: string): { limit: number; cursor: Cursor | null } {
  const sp = new URL(url).searchParams;
  const limit = Math.min(Math.max(Number(sp.get("limit") ?? 50) || 50, 1), 200);
  return { limit, cursor: decodeCursor(sp.get("cursor")) };
}
