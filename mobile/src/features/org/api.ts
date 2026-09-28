import { queryOptions } from "@tanstack/react-query";

import { api, type ItemResponse, type ListResponse } from "@/lib/api";
import { queryClient } from "@/lib/query";

export type OrgPerson = { id: string; name: string; email: string; avatarColor?: string | null };

/** A position on the org chart (GET /org-roles returns the roots, children nested). */
export type OrgRole = { id: string; title: string; sortKey: string; user: OrgPerson | null; children: OrgRole[] };

/** The People & HR directory (admins). */
export type DirectoryEntry = {
  id: string;
  name: string;
  email: string;
  role: string;
  title: string | null;
  entity: string;
  employment: string;
  startDate: string | null;
  manager: { id: string; name: string | null } | null;
};

export const orgRolesQuery = queryOptions({
  queryKey: ["org-roles"],
  queryFn: async () => (await api.get<ListResponse<OrgRole>>("/org-roles")).data,
});

export const directoryQuery = queryOptions({
  queryKey: ["directory"],
  queryFn: async () => (await api.get<ListResponse<DirectoryEntry>>("/directory")).data,
});

const refresh = () => queryClient.invalidateQueries({ queryKey: ["org-roles"] });

export async function createRole(input: { title: string; userId: string | null; parentId: string | null }): Promise<void> {
  await api.post<ItemResponse<{ id: string }>>("/org-roles", input);
  await refresh();
}

export async function updateRole(id: string, patch: { title?: string; userId?: string | null; parentId?: string | null }): Promise<void> {
  await api.patch(`/org-roles/${id}`, patch);
  await refresh();
}

export async function deleteRole(id: string): Promise<void> {
  await api.del(`/org-roles/${id}`);
  await refresh();
}
