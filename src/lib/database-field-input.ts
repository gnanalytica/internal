/**
 * Validation for database fields written through the API, mirroring what the
 * web's field editor can produce (`addField` / `updateField` in actions.ts).
 * Pure: the caller loads the database's fields and the workspace's databases
 * and passes them in, so every rule here is testable without a database.
 */
import { ApiInputError } from "@/lib/api/errors";
import { FIELD_TYPES, SELECT_COLORS, type RollupConfig, type RollupFn, type SelectOption } from "@/lib/types";

export const FIELD_TYPE_IDS: readonly string[] = FIELD_TYPES.map((t) => t.id);
export const ROLLUP_FNS: readonly RollupFn[] = ["count", "sum", "avg", "min", "max"];

const HAS_OPTIONS = new Set(["select", "multiSelect"]);
const MAX_OPTIONS = 100;

export type FieldShape = { id: string; type: string; relationDatabaseId: string | null };
export type FieldContext = {
  /** The fields of the database being changed. */
  fields: FieldShape[];
  /** Every database id in the workspace (relation targets). */
  databaseIds: ReadonlySet<string>;
  /** The fields of each database a relation field here points at. */
  relatedFields: Record<string, { id: string; type: string }[]>;
};

export type FieldValues = {
  name: string;
  type: string;
  options: SelectOption[] | null;
  relationDatabaseId: string | null;
  config: RollupConfig | null;
};

/** A field option as the client sends it; `previousLabel` marks a rename. */
export type OptionInput = SelectOption & { previousLabel?: string };

export function parseFieldName(raw: unknown): string {
  const name = typeof raw === "string" ? raw.trim() : "";
  if (!name) throw new ApiInputError("`name` is required.");
  return name.slice(0, 120);
}

export function parseFieldType(raw: unknown): string {
  const type = raw == null ? "text" : String(raw);
  if (!FIELD_TYPE_IDS.includes(type)) throw new ApiInputError(`\`type\` must be one of: ${FIELD_TYPE_IDS.join(", ")}.`);
  return type;
}

/** Options for a select field. Labels are what cells store, so they must be unique. */
export function parseSelectOptions(raw: unknown): { options: SelectOption[]; renames: Map<string, string> } {
  if (!Array.isArray(raw)) throw new ApiInputError("`options` must be a list of { label, color }.");
  if (raw.length > MAX_OPTIONS) throw new ApiInputError(`A field can have at most ${MAX_OPTIONS} options.`);
  const seen = new Set<string>();
  const renames = new Map<string, string>();
  const options = raw.map((o, i) => {
    const item = (o ?? {}) as Partial<OptionInput>;
    const label = typeof item.label === "string" ? item.label.trim().slice(0, 60) : "";
    if (!label) throw new ApiInputError(`Option ${i + 1} needs a label.`);
    if (seen.has(label)) throw new ApiInputError(`There are two options called "${label}".`);
    seen.add(label);
    const color = typeof item.color === "string" && /^#[0-9a-f]{3,8}$/i.test(item.color) ? item.color : SELECT_COLORS[i % SELECT_COLORS.length];
    if (typeof item.previousLabel === "string" && item.previousLabel && item.previousLabel !== label) renames.set(item.previousLabel, label);
    return { label, color };
  });
  return { options, renames };
}

/** What the web gives a new select field. */
export const defaultOptions = (): SelectOption[] => [{ label: "Option 1", color: "#6366f1" }];

export function parseRelationTarget(raw: unknown, ctx: FieldContext): string {
  const id = typeof raw === "string" ? raw : "";
  if (!id) throw new ApiInputError("A relation field needs `relationDatabaseId` — the database its rows link to.");
  if (!ctx.databaseIds.has(id)) throw new ApiInputError("`relationDatabaseId`: database not found in this workspace.", 404);
  return id;
}

/** A rollup reads through one of this database's relation fields. */
export function parseRollupConfig(raw: unknown, ctx: FieldContext): RollupConfig {
  const c = (raw ?? {}) as Partial<RollupConfig>;
  const rel = ctx.fields.find((f) => f.id === c.relationFieldId);
  if (!rel || rel.type !== "relation" || !rel.relationDatabaseId)
    throw new ApiInputError("A rollup needs `config.relationFieldId` — one of this database's relation fields.");
  const fn = (c.fn ?? "count") as RollupFn;
  if (!ROLLUP_FNS.includes(fn)) throw new ApiInputError(`\`config.fn\` must be one of: ${ROLLUP_FNS.join(", ")}.`);
  if (fn === "count") return { relationFieldId: rel.id, targetFieldId: null, fn };
  const target = (ctx.relatedFields[rel.relationDatabaseId] ?? []).find((f) => f.id === c.targetFieldId);
  if (!target) throw new ApiInputError("`config.targetFieldId` must be a field of the related database.");
  if (target.type !== "number") throw new ApiInputError(`Only number fields can be summed, averaged or compared — pick a number field, or count instead.`);
  return { relationFieldId: rel.id, targetFieldId: target.id, fn };
}

/** A new field, as `addField` would store it. */
export function planNewField(input: Record<string, unknown>, ctx: FieldContext): FieldValues {
  const name = parseFieldName(input.name);
  const type = parseFieldType(input.type);
  return {
    name,
    type,
    options: HAS_OPTIONS.has(type) ? (input.options !== undefined ? parseSelectOptions(input.options).options : defaultOptions()) : null,
    relationDatabaseId: type === "relation" ? parseRelationTarget(input.relationDatabaseId, ctx) : null,
    config: type === "rollup" ? parseRollupConfig(input.config, ctx) : null,
  };
}

/**
 * A change to an existing field. Returns the columns to write and the option
 * renames to carry into the rows (cells store an option by its label).
 */
export function planFieldPatch(
  current: FieldShape & { options: unknown },
  patch: Record<string, unknown>,
  ctx: FieldContext,
): { values: Partial<FieldValues>; renames: Map<string, string> } {
  const values: Partial<FieldValues> = {};
  let renames = new Map<string, string>();
  if (patch.name !== undefined) values.name = parseFieldName(patch.name);
  const type = patch.type !== undefined ? parseFieldType(patch.type) : current.type;
  if (type !== current.type) values.type = type;

  if (patch.options !== undefined) {
    if (!HAS_OPTIONS.has(type)) throw new ApiInputError("Only select and multi-select fields have options.");
    const parsed = parseSelectOptions(patch.options);
    values.options = parsed.options;
    renames = parsed.renames;
  } else if (values.type && HAS_OPTIONS.has(type) && !(Array.isArray(current.options) && current.options.length)) {
    values.options = defaultOptions();
  }

  if (type === "relation" && (values.type || patch.relationDatabaseId !== undefined)) {
    values.relationDatabaseId = parseRelationTarget(patch.relationDatabaseId ?? current.relationDatabaseId, ctx);
  } else if (values.type && current.type === "relation") values.relationDatabaseId = null;

  if (type === "rollup" && (values.type || patch.config !== undefined)) {
    // A field can't roll up through itself.
    values.config = parseRollupConfig(patch.config, { ...ctx, fields: ctx.fields.filter((f) => f.id !== current.id) });
  } else if (values.type && current.type === "rollup") values.config = null;

  return { values, renames };
}

/** A cell value after its options were renamed. Unchanged values come back as-is. */
export function renameOptionValue(value: unknown, type: string, renames: ReadonlyMap<string, string>): unknown {
  if (renames.size === 0) return value;
  if (type === "select" && typeof value === "string") return renames.get(value) ?? value;
  if (type === "multiSelect" && Array.isArray(value)) return value.map((v) => (typeof v === "string" ? (renames.get(v) ?? v) : v));
  return value;
}
