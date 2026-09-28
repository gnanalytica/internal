import { api } from "@/lib/api";
import { queryClient } from "@/lib/query";

/** Send a picked file to the server, which stores it and attaches it to the issue. */
export async function uploadAttachment(issueId: string, file: { uri: string; name: string; mimeType?: string | null }): Promise<void> {
  const form = new FormData();
  form.append("file", { uri: file.uri, name: file.name, type: file.mimeType ?? "application/octet-stream" } as unknown as Blob);
  await api.upload(`/issues/${issueId}/attachments/upload`, form);
  await queryClient.invalidateQueries({ queryKey: ["issue", issueId] });
}

export async function deleteAttachment(issueId: string, attachmentId: string): Promise<void> {
  await api.del(`/attachments/${attachmentId}`);
  await queryClient.invalidateQueries({ queryKey: ["issue", issueId] });
}

export type Watchable = "issue" | "page" | "project";

export async function setFavorite(type: Watchable, id: string, on: boolean): Promise<void> {
  await api.post("/favorites", { type, id, on });
  await Promise.all([queryClient.invalidateQueries({ queryKey: [type, id] }), queryClient.invalidateQueries({ queryKey: ["favorites"] })]);
}

export async function setWatching(type: Watchable, id: string, on: boolean): Promise<void> {
  await api.post("/subscriptions", { type, id, on });
  await queryClient.invalidateQueries({ queryKey: [type, id] });
}
