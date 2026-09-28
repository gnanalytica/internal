import { queryOptions } from "@tanstack/react-query";
import type { Href } from "expo-router";

import type { IconName } from "@/components/ui";
import { api, type ListResponse } from "@/lib/api";

export type SearchType = "issue" | "page" | "project" | "database" | "cycle" | "milestone" | "feature" | "ticket" | "deal" | "account" | "contact";

export type SearchHit = {
  type: SearchType;
  id: string;
  title: string;
  subtitle: string | null;
  projectId: string | null;
  fields: { label: string; value: string }[];
  url: string;
};

export const searchQuery = (q: string) =>
  queryOptions({
    queryKey: ["search", q],
    queryFn: async () => (await api.get<ListResponse<SearchHit>>("/search", { q })).data,
    enabled: q.trim().length > 0,
    staleTime: 15_000,
  });

/** Display order and labels for the groups on the Search screen. */
export const GROUPS: { type: SearchType; label: string; icon: IconName }[] = [
  { type: "issue", label: "Issues", icon: "check-circle" },
  { type: "page", label: "Docs", icon: "file-text" },
  { type: "project", label: "Projects", icon: "folder" },
  { type: "database", label: "Databases", icon: "grid" },
  { type: "cycle", label: "Cycles", icon: "refresh-cw" },
  { type: "milestone", label: "Milestones", icon: "flag" },
  { type: "feature", label: "Features", icon: "box" },
  { type: "ticket", label: "Tickets", icon: "life-buoy" },
  { type: "deal", label: "Deals", icon: "dollar-sign" },
  { type: "account", label: "Accounts", icon: "briefcase" },
  { type: "contact", label: "Contacts", icon: "user" },
];

export const GROUP_OF = Object.fromEntries(GROUPS.map((g) => [g.type, g])) as Record<SearchType, (typeof GROUPS)[number]>;

/** Hits grouped in display order, empty groups dropped. */
export function groupHits(hits: SearchHit[]): { type: SearchType; label: string; icon: IconName; data: SearchHit[] }[] {
  return GROUPS.map((g) => ({ ...g, data: hits.filter((h) => h.type === g.type) })).filter((g) => g.data.length > 0);
}

/**
 * Where a hit opens in the app. Records with a screen of their own open it;
 * tickets and deals open inside their project when they have one; the rest
 * open the record screen, which shows the hit's facts and its project.
 */
export function hrefFor(hit: SearchHit): Href {
  switch (hit.type) {
    case "issue":
      return `/issues/${hit.id}`;
    case "page":
      return `/pages/${hit.id}`;
    case "project":
      return `/projects/${hit.id}`;
    case "database":
      return `/databases/${hit.id}`;
    case "ticket":
      if (hit.projectId) return `/projects/${hit.projectId}/tickets/${hit.id}`;
      break;
    case "deal":
      if (hit.projectId) return `/projects/${hit.projectId}/deals/${hit.id}`;
      break;
  }
  return { pathname: "/record/[type]/[id]", params: { type: hit.type, id: hit.id, hit: JSON.stringify(hit) } };
}
