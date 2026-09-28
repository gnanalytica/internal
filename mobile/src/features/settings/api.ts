import { queryOptions } from "@tanstack/react-query";

import { labelsQuery, type Label } from "@/features/workspace/api";
import { api, type ItemResponse, type ListResponse } from "@/lib/api";
import { queryClient } from "@/lib/query";

export type SignInMethod = { id: string; label: string; connected: boolean };

export const signInMethodsQuery = queryOptions({
  queryKey: ["me", "sign-in-methods"],
  queryFn: async () => api.get<ListResponse<SignInMethod> & { available: boolean }>("/me/sign-in-methods"),
});

// ---- Labels ----

/** The colours the web offers in its label picker. */
export const LABEL_COLORS = ["#6366f1", "#ec4899", "#10b981", "#f59e0b", "#3b82f6", "#a855f7", "#ef4444", "#14b8a6", "#f97316", "#64748b"];

const refreshLabels = () => Promise.all([queryClient.invalidateQueries({ queryKey: labelsQuery.queryKey }), queryClient.invalidateQueries({ queryKey: ["issues"] })]);

export async function createLabel(input: { name: string; color: string }): Promise<Label> {
  const res = await api.post<ItemResponse<Label>>("/labels", input);
  await refreshLabels();
  return res.data;
}

export async function updateLabel(id: string, patch: { name?: string; color?: string }): Promise<void> {
  await api.patch(`/labels/${id}`, patch);
  await refreshLabels();
}

export async function deleteLabel(id: string): Promise<void> {
  await api.del(`/labels/${id}`);
  await refreshLabels();
}

// ---- Integrations (admins) ----

export type ApiKey = {
  id: string;
  name: string;
  prefix: string;
  kind: "key" | "app" | string;
  createdBy: { id: string; name: string | null } | null;
  lastUsedAt: string | null;
  createdAt: string;
  current: boolean;
};

export type Webhook = { id: string; url: string; events: string[]; active: boolean; lastStatus: number | null; lastDeliveryAt: string | null };

export type Integrations = { github: { connected: boolean; repo: string | null }; slack: { connected: boolean } };

export const apiKeysQuery = queryOptions({
  queryKey: ["api-keys"],
  queryFn: async () => (await api.get<ListResponse<ApiKey>>("/api-keys")).data,
});

export const webhooksQuery = queryOptions({
  queryKey: ["webhooks"],
  queryFn: async () => (await api.get<ListResponse<Webhook>>("/webhooks")).data,
});

export const integrationsQuery = queryOptions({
  queryKey: ["integrations"],
  queryFn: async () => (await api.get<ItemResponse<Integrations>>("/integrations")).data,
});

/** Mint an integration key. The returned `key` is shown once and can't be fetched again. */
export async function createApiKey(name: string): Promise<{ id: string; key: string; prefix: string; name: string }> {
  const res = await api.post<ItemResponse<{ id: string; key: string; prefix: string; name: string }>>("/api-keys", { name });
  await queryClient.invalidateQueries({ queryKey: apiKeysQuery.queryKey });
  return res.data;
}

export async function revokeApiKey(id: string): Promise<void> {
  await api.del(`/api-keys/${id}`);
  await queryClient.invalidateQueries({ queryKey: apiKeysQuery.queryKey });
}

export async function setWebhookActive(id: string, active: boolean): Promise<void> {
  queryClient.setQueryData<Webhook[]>(webhooksQuery.queryKey, (list) => list?.map((w) => (w.id === id ? { ...w, active } : w)));
  try {
    await api.patch(`/webhooks/${id}`, { active });
  } finally {
    await queryClient.invalidateQueries({ queryKey: webhooksQuery.queryKey });
  }
}

export async function deleteWebhook(id: string): Promise<void> {
  await api.del(`/webhooks/${id}`);
  await queryClient.invalidateQueries({ queryKey: webhooksQuery.queryKey });
}
