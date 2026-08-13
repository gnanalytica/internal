import {
  apiListNotifications,
  apiMarkNotificationsRead,
} from "@/lib/api/collab-ops";
import { ok, readJson, withApiAuth } from "@/lib/api/http";

/** Notifications belong to the member this key acts as (see /me). */
export const GET = withApiAuth(async (req, auth) => {
  const unreadOnly = new URL(req.url).searchParams.get("unread") === "true";
  const data = await apiListNotifications(auth.workspaceId, auth.userId, { unreadOnly });
  return ok({ data, count: data.length });
});

/** Mark one notification read, or all of them when `id` is omitted. */
export const POST = withApiAuth(async (req, auth) => {
  const { id } = await readJson<{ id?: string }>(req);
  const marked = await apiMarkNotificationsRead(auth.workspaceId, auth.userId, id);
  return ok({ data: { marked } });
});
