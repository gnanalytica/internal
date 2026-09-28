import { shortDate } from "@/lib/format";

import type { Database, DbRow, Field, RelatedDatabase, RollupConfig } from "./api";

/** The field that names a row: the first text field, as on the web. */
export const primaryField = (fields: Field[]): Field | undefined => fields.find((f) => f.type === "text") ?? fields[0];

export function rowLabel(row: DbRow, primaryFieldId: string | null | undefined): string {
  const v = primaryFieldId ? row.values?.[primaryFieldId] : null;
  return v != null && v !== "" ? String(v) : "Untitled";
}

export function relationIds(row: DbRow, fieldId: string): string[] {
  const v = row.values?.[fieldId];
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

export function multiValues(row: DbRow, fieldId: string): string[] {
  const v = row.values?.[fieldId];
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

/** Port of the web's computeRollup (src/lib/database-rollup.ts). "—" when there's nothing to show. */
export function computeRollup(config: RollupConfig | null, row: DbRow, fields: Field[], related: Record<string, RelatedDatabase>): string {
  if (!config) return "—";
  const rel = fields.find((f) => f.id === config.relationFieldId);
  const target = rel?.relationDatabaseId ? related[rel.relationDatabaseId] : undefined;
  if (!target) return "—";
  const ids = new Set(relationIds(row, config.relationFieldId));
  const rows = target.rows.filter((r) => ids.has(r.id));
  if (config.fn === "count") return String(rows.length);
  if (!config.targetFieldId) return "—";
  const nums = rows.map((r) => Number(r.values?.[config.targetFieldId as string])).filter((n) => Number.isFinite(n));
  if (!nums.length) return "—";
  const sum = nums.reduce((a, b) => a + b, 0);
  switch (config.fn) {
    case "sum":
      return String(sum);
    case "min":
      return String(Math.min(...nums));
    case "max":
      return String(Math.max(...nums));
    case "avg":
      return String(Math.round((sum / nums.length) * 100) / 100);
    default:
      return "—";
  }
}

/** A cell as plain text, for the table and list views. Empty string when unset. */
export function cellText(field: Field, row: DbRow, db: Pick<Database, "fields" | "related">): string {
  const v = row.values?.[field.id];
  switch (field.type) {
    case "checkbox":
      return v ? "✓" : "";
    case "date":
      return typeof v === "string" && v ? shortDate(v) || v : "";
    case "multiSelect":
      return multiValues(row, field.id).join(", ");
    case "relation": {
      const target = field.relationDatabaseId ? db.related[field.relationDatabaseId] : undefined;
      if (!target) return "";
      const ids = relationIds(row, field.id);
      return target.rows
        .filter((r) => ids.includes(r.id))
        .map((r) => rowLabel(r, target.primaryFieldId))
        .join(", ");
    }
    case "rollup": {
      const out = computeRollup(field.config, row, db.fields, db.related);
      return out === "—" ? "" : out;
    }
    default:
      return v == null ? "" : String(v);
  }
}

export const optionColor = (field: Field, label: string): string => field.options?.find((o) => o.label === label)?.color ?? "#64748b";

/** Column width in the table view: the web's saved width, clamped for a phone. */
export const columnWidth = (field: Field): number => Math.max(110, Math.min(260, field.width ?? (field.type === "checkbox" ? 90 : 160)));
