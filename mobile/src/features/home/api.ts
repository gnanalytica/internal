import { queryOptions } from "@tanstack/react-query";

import { api, type ListResponse } from "@/lib/api";
import { queryClient } from "@/lib/query";

export type Health = "on_track" | "at_risk" | "off_track" | "none";

/** One row of the web Overview (GET /portfolio). */
export type PortfolioRow = {
  id: string;
  name: string;
  key: string;
  color: string;
  kind: "project" | "operation";
  tagline: string | null;
  url: string | null;
  ownerName: string | null;
  health: Health;
  milestoneName: string | null;
  milestoneTarget: string | null;
  doneIssues: number;
  totalIssues: number;
  progress: number;
};

export const HEALTH: Record<Health, { label: string; tone: "success" | "warning" | "danger" | "neutral" }> = {
  on_track: { label: "On track", tone: "success" },
  at_risk: { label: "At risk", tone: "warning" },
  off_track: { label: "Off track", tone: "danger" },
  none: { label: "No update", tone: "neutral" },
};

export const portfolioQuery = queryOptions({
  queryKey: ["portfolio"],
  queryFn: async () => (await api.get<ListResponse<PortfolioRow>>("/portfolio")).data,
});

export const betsQuery = queryOptions({
  queryKey: ["workspace", "bets"],
  queryFn: async () => (await api.get<ListResponse<string>>("/workspace/bets")).data,
});

/** The caller's favourites (GET /favorites): issues, docs and projects, oldest first. */
export type Favorite =
  | { type: "issue"; id: string; title: string; identifier: string; status: string }
  | { type: "page"; id: string; title: string; icon: string }
  | { type: "project"; id: string; title: string; color: string };

export const favoritesQuery = queryOptions({
  queryKey: ["favorites"],
  queryFn: async () => (await api.get<ListResponse<Favorite>>("/favorites")).data,
});

/** Replace the company bets (admins). Blank entries are dropped by the server. */
export async function saveBets(bets: string[]): Promise<string[]> {
  const res = await api.patch<ListResponse<string>>("/workspace/bets", { bets });
  queryClient.setQueryData(betsQuery.queryKey, res.data);
  return res.data;
}
