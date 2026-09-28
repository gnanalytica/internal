import { queryOptions } from "@tanstack/react-query";

import { api, type ItemResponse } from "@/lib/api";
import { queryClient } from "@/lib/query";

import type { ActivityEntry, MyWorkItem, Overview, Period, ProspectKind, ProspectRecord, ProspectRow, TouchBody } from "./model";

export type Scope = "focus" | "all";

export type RowsResponse = {
  data: ProspectRow[];
  count: number;
  kind: ProspectKind;
  scope: Scope;
  /** Rows in scope per kind, for the kind switch. */
  counts: Record<ProspectKind, number>;
  /** Rows per kind before the state filter, for "All India". */
  totals: Record<ProspectKind, number>;
  today: string;
  readAt: string;
  warnings: string[];
  sheetUrl: string;
  me: string;
  team: string[];
};

export type Detail = { record: ProspectRecord; activity: ActivityEntry[] };
export type WriteResult = { written: string[]; message: string };

// The sheet is read through a one-minute server cache; a short client staleTime
// keeps tab switches instant without showing anything older than that.
const STALE = 30_000;

/** Registration numbers carry slashes (IBBI/RV/02/2019/1), so the ID is one encoded path segment. */
const recordPath = (kind: ProspectKind, id: string) => `/prospects/${kind}/${encodeURIComponent(id)}`;

export const rowsQuery = (kind: ProspectKind, scope: Scope) =>
  queryOptions({
    queryKey: ["prospects", "rows", kind, scope],
    queryFn: () => api.get<RowsResponse>("/prospects", { kind, scope }),
    staleTime: STALE,
  });

export const overviewQuery = (kind: ProspectKind, scope: Scope, period: Period, who: "team" | "me") =>
  queryOptions({
    queryKey: ["prospects", "overview", kind, scope, period, who],
    queryFn: () => api.get<{ data: Overview; today: string; readAt: string }>("/prospects/overview", { kind, scope, period, who }),
    staleTime: STALE,
  });

export const myWorkQuery = (scope: Scope) =>
  queryOptions({
    queryKey: ["prospects", "my-work", scope],
    queryFn: () => api.get<{ data: MyWorkItem[]; me: string; today: string; readAt: string }>("/prospects/my-work", { scope }),
    staleTime: STALE,
  });

export const detailQuery = (kind: ProspectKind, id: string) =>
  queryOptions({
    queryKey: ["prospects", "detail", kind, id],
    queryFn: async () => (await api.get<ItemResponse<Detail>>(recordPath(kind, id))).data,
    staleTime: STALE,
  });

/** Every prospects view reads the same sheet, so any write makes all of them stale. */
export async function refreshAll(): Promise<void> {
  await queryClient.invalidateQueries({ queryKey: ["prospects"] });
}

/** Write cells on one row. Only the columns WRITABLE allows for the kind are accepted by the server. */
export async function saveProspect(kind: ProspectKind, id: string, patch: Record<string, string | number | null>): Promise<WriteResult> {
  try {
    return (await api.patch<ItemResponse<WriteResult>>(recordPath(kind, id), patch)).data;
  } finally {
    await refreshAll();
  }
}

/** Log a call, message or meeting as the signed-in member. */
export async function logTouch(kind: ProspectKind, id: string, body: TouchBody): Promise<WriteResult> {
  try {
    return (await api.post<ItemResponse<WriteResult>>(`${recordPath(kind, id)}/touch`, body)).data;
  } finally {
    await refreshAll();
  }
}

export async function assignToMe(kind: ProspectKind, ids: string[]): Promise<WriteResult> {
  try {
    return (await api.post<ItemResponse<WriteResult>>("/prospects/assign-to-me", { kind, ids: ids.slice(0, 50) })).data;
  } finally {
    await refreshAll();
  }
}

/** Ask the server to re-read the sheet now, then reload every view. */
export async function refreshFromSheet(): Promise<void> {
  await api.post("/prospects/refresh");
  await refreshAll();
}

/** "14:05" in India time, as the web shows when the sheet was read. */
export function readTime(iso: string | undefined): string {
  if (!iso) return "";
  const d = new Date(Date.parse(iso) + 5.5 * 3600_000);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}
