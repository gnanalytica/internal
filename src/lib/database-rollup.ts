import type {
  DatabaseField,
  DatabaseRow,
  RelatedDatabase,
  RollupConfig,
} from "@/lib/types";

function values(row: DatabaseRow): Record<string, unknown> {
  return (row.values as Record<string, unknown>) ?? {};
}

/** The display label for a related row (its primary field, falling back to id). */
export function rowLabel(row: DatabaseRow, primaryFieldId: string | null): string {
  if (primaryFieldId) {
    const v = values(row)[primaryFieldId];
    if (v != null && v !== "") return String(v);
  }
  return "Untitled";
}

/** The target row ids stored in a relation cell. */
export function relationCellIds(row: DatabaseRow, relationFieldId: string): string[] {
  const v = values(row)[relationFieldId];
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

/** Compute a rollup value for one row. Returns a display string ("—" when empty). */
export function computeRollup(
  config: RollupConfig,
  row: DatabaseRow,
  fields: DatabaseField[],
  related: Record<string, RelatedDatabase>,
): string {
  const relField = fields.find((f) => f.id === config.relationFieldId);
  if (!relField?.relationDatabaseId) return "—";
  const target = related[relField.relationDatabaseId];
  if (!target) return "—";

  const ids = new Set(relationCellIds(row, config.relationFieldId));
  const rows = target.rows.filter((r) => ids.has(r.id));

  if (config.fn === "count") return String(rows.length);

  if (!config.targetFieldId) return "—";
  const nums = rows
    .map((r) => Number(values(r)[config.targetFieldId as string]))
    .filter((n) => Number.isFinite(n));
  if (nums.length === 0) return "—";

  switch (config.fn) {
    case "sum":
      return String(nums.reduce((a, b) => a + b, 0));
    case "min":
      return String(Math.min(...nums));
    case "max":
      return String(Math.max(...nums));
    case "avg":
      return String(
        Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 100) / 100,
      );
    default:
      return "—";
  }
}
