import { queryOptions } from "@tanstack/react-query";

import type { IconName } from "@/components/ui";
import { api, type ItemResponse, type ListResponse } from "@/lib/api";
import { queryClient } from "@/lib/query";

export type SelectOption = { label: string; color: string };
export type RollupFn = "count" | "sum" | "avg" | "min" | "max";
export type RollupConfig = { relationFieldId: string; targetFieldId: string | null; fn: RollupFn };

export type Field = {
  id: string;
  databaseId: string;
  name: string;
  type: string;
  options: SelectOption[] | null;
  relationDatabaseId: string | null;
  config: RollupConfig | null;
  width: number | null;
  position: string;
};
export type DbRow = { id: string; databaseId: string; values: Record<string, unknown>; position: string; createdAt: string };
export type RelatedDatabase = { id: string; name: string; primaryFieldId: string | null; fields: Field[]; rows: DbRow[] };
export type Database = { id: string; name: string; icon: string; createdAt: string; fields: Field[]; rows: DbRow[]; related: Record<string, RelatedDatabase> };
export type DatabaseSummary = { id: string; name: string; icon: string; createdAt: string; fieldCount: number; rowCount: number };

/** Mirrors the web's FIELD_TYPES (src/lib/types.ts). */
export const FIELD_TYPES = [
  { id: "text", label: "Text", icon: "type" },
  { id: "number", label: "Number", icon: "hash" },
  { id: "select", label: "Select", icon: "chevron-down" },
  { id: "multiSelect", label: "Multi-select", icon: "list" },
  { id: "checkbox", label: "Checkbox", icon: "check-square" },
  { id: "date", label: "Date", icon: "calendar" },
  { id: "url", label: "URL", icon: "link" },
  { id: "email", label: "Email", icon: "at-sign" },
  { id: "relation", label: "Relation", icon: "git-merge" },
  { id: "rollup", label: "Rollup", icon: "bar-chart-2" },
] as const satisfies readonly { id: string; label: string; icon: IconName }[];

export const ROLLUP_FNS: { id: RollupFn; label: string }[] = [
  { id: "count", label: "Count" },
  { id: "sum", label: "Sum" },
  { id: "avg", label: "Average" },
  { id: "min", label: "Min" },
  { id: "max", label: "Max" },
];

export const SELECT_COLORS = ["#6366f1", "#ec4899", "#10b981", "#f59e0b", "#3b82f6", "#a855f7", "#ef4444", "#14b8a6", "#f97316", "#64748b"];

export const databasesQuery = queryOptions({
  queryKey: ["databases"],
  queryFn: async () => (await api.get<ListResponse<DatabaseSummary>>("/databases")).data,
});

export const databaseQuery = (id: string) =>
  queryOptions({
    queryKey: ["database", id],
    queryFn: async () => (await api.get<ItemResponse<Database>>(`/databases/${id}`)).data,
  });

async function refresh(id?: string): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ["databases"] }),
    // Other databases' relation chips and rollups read this one's rows.
    id ? queryClient.invalidateQueries({ queryKey: ["database"] }) : null,
  ]);
}

export async function createDatabase(name: string): Promise<string> {
  const res = await api.post<ItemResponse<{ id: string }>>("/databases", { name, template: "starter" });
  await refresh();
  return res.data.id;
}

export async function updateDatabase(id: string, patch: { name?: string; icon?: string }): Promise<void> {
  queryClient.setQueryData<Database>(["database", id], (old) => (old ? { ...old, ...patch } : old));
  try {
    await api.patch(`/databases/${id}`, patch);
  } finally {
    await refresh(id);
  }
}

export async function deleteDatabase(id: string): Promise<void> {
  await api.del(`/databases/${id}`);
  queryClient.removeQueries({ queryKey: ["database", id] });
  await refresh(id);
}

export async function addRow(databaseId: string, values: Record<string, unknown> = {}): Promise<string> {
  const res = await api.post<ItemResponse<{ id: string }>>(`/databases/${databaseId}/rows`, values);
  await refresh(databaseId);
  return res.data.id;
}

export async function setCell(databaseId: string, rowId: string, fieldId: string, value: unknown): Promise<void> {
  queryClient.setQueryData<Database>(["database", databaseId], (old) =>
    old ? { ...old, rows: old.rows.map((r) => (r.id === rowId ? { ...r, values: { ...r.values, [fieldId]: value } } : r)) } : old,
  );
  try {
    await api.patch(`/databases/${databaseId}/rows/${rowId}`, { [fieldId]: value });
  } finally {
    await refresh(databaseId);
  }
}

export async function duplicateRow(databaseId: string, rowId: string): Promise<void> {
  await api.post(`/databases/${databaseId}/rows/${rowId}/duplicate`);
  await refresh(databaseId);
}

export async function deleteRow(databaseId: string, rowId: string): Promise<void> {
  queryClient.setQueryData<Database>(["database", databaseId], (old) => (old ? { ...old, rows: old.rows.filter((r) => r.id !== rowId) } : old));
  try {
    await api.del(`/databases/${databaseId}/rows/${rowId}`);
  } finally {
    await refresh(databaseId);
  }
}

export type FieldInput = {
  name?: string;
  type?: string;
  options?: (SelectOption & { previousLabel?: string })[];
  relationDatabaseId?: string | null;
  config?: RollupConfig | null;
};

export async function addField(databaseId: string, input: FieldInput): Promise<void> {
  await api.post(`/databases/${databaseId}/fields`, input);
  await refresh(databaseId);
}

export async function updateField(databaseId: string, fieldId: string, patch: FieldInput): Promise<void> {
  await api.patch(`/databases/${databaseId}/fields/${fieldId}`, patch);
  await refresh(databaseId);
}

export async function deleteField(databaseId: string, fieldId: string): Promise<void> {
  await api.del(`/databases/${databaseId}/fields/${fieldId}`);
  await refresh(databaseId);
}
