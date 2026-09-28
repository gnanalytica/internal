import { queryOptions } from "@tanstack/react-query";

import { api, type ListResponse } from "@/lib/api";
import { queryClient } from "@/lib/query";

export type Notification = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  issueId: string | null;
  pageId?: string | null;
  projectId?: string | null;
  actor?: { id: string; name: string } | null;
  read: boolean;
  createdAt: string;
};

export const notificationsQuery = queryOptions({
  queryKey: ["notifications"],
  queryFn: async () => (await api.get<ListResponse<Notification>>("/notifications")).data,
  refetchInterval: 60_000,
});

export const unreadCountQuery = queryOptions({
  queryKey: ["notifications", "unread"],
  queryFn: async () => (await api.get<ListResponse<Notification>>("/notifications", { unread: true })).data.length,
  refetchInterval: 60_000,
});

/** Mark one notification read, or all of them. */
export async function markRead(id?: string): Promise<void> {
  queryClient.setQueryData<Notification[]>(notificationsQuery.queryKey, (list) => list?.map((n) => (!id || n.id === id ? { ...n, read: true } : n)));
  await api.post("/notifications", id ? { id } : {});
  await queryClient.invalidateQueries({ queryKey: ["notifications"] });
}
