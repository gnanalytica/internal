import { queryOptions } from "@tanstack/react-query";

import { api, type ListResponse } from "@/lib/api";

export type Member = { id: string; name: string; email: string; avatarColor: string | null; role: string | null; title: string | null; entity: string | null };
export type Project = { id: string; name: string; key: string; color: string | null; description: string | null; startDate: string | null; targetDate: string | null; kind?: string; confidential?: boolean; ownerId?: string | null; tagline?: string | null };
export type Label = { id: string; name: string; color: string };
export type Cycle = { id: string; name: string; number: number; startDate: string; endDate: string; projectId?: string | null };

const HOUR = 60 * 60_000;

export const membersQuery = queryOptions({
  queryKey: ["members"],
  queryFn: async () => (await api.get<ListResponse<Member>>("/users")).data,
  staleTime: HOUR,
});

export const projectsQuery = queryOptions({
  queryKey: ["projects"],
  queryFn: async () => (await api.get<ListResponse<Project>>("/projects")).data,
  staleTime: 5 * 60_000,
});

export const labelsQuery = queryOptions({
  queryKey: ["labels"],
  queryFn: async () => (await api.get<ListResponse<Label>>("/labels")).data,
  staleTime: HOUR,
});

export const cyclesQuery = queryOptions({
  queryKey: ["cycles"],
  queryFn: async () => (await api.get<ListResponse<Cycle>>("/cycles")).data,
  staleTime: 5 * 60_000,
});
