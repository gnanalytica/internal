import "server-only";

import { and, asc, eq, inArray, max, sql } from "drizzle-orm";

import { db } from "@/db";
import { databaseFields, databaseRows, databases } from "@/db/schema";
import { ApiInputError } from "@/lib/api/errors";
import { apiInvalidate } from "@/lib/api/invalidate";
import { planFieldPatch, planNewField, renameOptionValue, type FieldContext } from "@/lib/database-field-input";

/**
 * Database schema and row operations for the API, mirroring the web's server
 * actions (createDatabase, addField, updateField, duplicateRow). Databases are
 * workspace-wide on the web, so there is no per-project visibility to apply;
 * deleting a database stays admin-only at the route.
 */

/**
 * A sort key after every existing one. The web writes `a<timestamp>` and the API
 * `<max>a`; appending to the max is the only form that always sorts last.
 */
const after = (last: string | null): string => `${last ?? "a"}a`;

export async function apiListDatabasesSummary(workspaceId: string) {
  return db
    .select({
      id: databases.id,
      name: databases.name,
      icon: databases.icon,
      createdAt: databases.createdAt,
      fieldCount: sql<number>`(select count(*)::int from ${databaseFields} where ${databaseFields.databaseId} = ${databases.id})`,
      rowCount: sql<number>`(select count(*)::int from ${databaseRows} where ${databaseRows.databaseId} = ${databases.id})`,
    })
    .from(databases)
    .where(eq(databases.workspaceId, workspaceId))
    .orderBy(asc(databases.name));
}

/** A new database with the web's starter schema: Name, Status and three empty rows. */
export async function apiCreateStarterDatabase(workspaceId: string, input: { name?: unknown; icon?: unknown }): Promise<string> {
  const [created] = await db
    .insert(databases)
    .values({
      workspaceId,
      name: (typeof input.name === "string" && input.name.trim().slice(0, 120)) || "Untitled database",
      icon: (typeof input.icon === "string" && input.icon.trim().slice(0, 16)) || "🗃️",
    })
    .returning({ id: databases.id });
  await db.insert(databaseFields).values([
    { databaseId: created.id, name: "Name", type: "text", position: "a0" },
    {
      databaseId: created.id,
      name: "Status",
      type: "select",
      position: "a1",
      options: [
        { label: "Todo", color: "#64748b" },
        { label: "In progress", color: "#f59e0b" },
        { label: "Done", color: "#10b981" },
      ],
    },
  ]);
  await db.insert(databaseRows).values([0, 1, 2].map((i) => ({ databaseId: created.id, values: {}, position: `a${i}` })));
  apiInvalidate(workspaceId, "databases");
  return created.id;
}

/** This database's fields plus what relation and rollup settings are checked against. */
async function fieldContext(workspaceId: string, databaseId: string) {
  const all = await db.select({ id: databases.id }).from(databases).where(eq(databases.workspaceId, workspaceId));
  if (!all.some((d) => d.id === databaseId)) throw new ApiInputError("Database not found.", 404);
  const fields = await db
    .select({ id: databaseFields.id, type: databaseFields.type, relationDatabaseId: databaseFields.relationDatabaseId, options: databaseFields.options })
    .from(databaseFields)
    .where(eq(databaseFields.databaseId, databaseId));
  const targets = [...new Set(fields.map((f) => f.relationDatabaseId).filter((x): x is string => !!x))];
  const relatedRows = targets.length
    ? await db.select({ id: databaseFields.id, type: databaseFields.type, databaseId: databaseFields.databaseId }).from(databaseFields).where(inArray(databaseFields.databaseId, targets))
    : [];
  const relatedFields: FieldContext["relatedFields"] = {};
  for (const f of relatedRows) (relatedFields[f.databaseId] ??= []).push({ id: f.id, type: f.type });
  const ctx: FieldContext = { fields, databaseIds: new Set(all.map((d) => d.id)), relatedFields };
  return { ctx, fields };
}

/** Add a field of any type the web offers, including relation targets and rollup settings. */
export async function apiAddField(workspaceId: string, databaseId: string, input: Record<string, unknown>): Promise<string> {
  const { ctx } = await fieldContext(workspaceId, databaseId);
  const v = planNewField(input, ctx);
  const [{ last }] = await db.select({ last: max(databaseFields.position) }).from(databaseFields).where(eq(databaseFields.databaseId, databaseId));
  const [created] = await db
    .insert(databaseFields)
    .values({ databaseId, name: v.name, type: v.type, options: v.options, relationDatabaseId: v.relationDatabaseId, config: v.config, position: after(last) })
    .returning({ id: databaseFields.id });
  apiInvalidate(workspaceId, "databases");
  return created.id;
}

/**
 * Rename a field, change its type, or edit its options. Cells store a select
 * option by its label, so renamed options (sent with `previousLabel`) are
 * carried into every row.
 */
export async function apiUpdateField(workspaceId: string, databaseId: string, fieldId: string, patch: Record<string, unknown>): Promise<boolean> {
  const { ctx, fields } = await fieldContext(workspaceId, databaseId);
  const current = fields.find((f) => f.id === fieldId);
  if (!current) return false;
  const { values, renames } = planFieldPatch(current, patch, ctx);
  if (Object.keys(values).length > 0)
    await db.update(databaseFields).set(values).where(and(eq(databaseFields.databaseId, databaseId), eq(databaseFields.id, fieldId)));

  if (renames.size > 0) {
    const type = values.type ?? current.type;
    const rows = await db.select({ id: databaseRows.id, values: databaseRows.values }).from(databaseRows).where(eq(databaseRows.databaseId, databaseId));
    for (const row of rows) {
      const cells = (row.values as Record<string, unknown>) ?? {};
      const next = renameOptionValue(cells[fieldId], type, renames);
      if (next !== cells[fieldId]) await db.update(databaseRows).set({ values: { ...cells, [fieldId]: next } }).where(eq(databaseRows.id, row.id));
    }
  }
  apiInvalidate(workspaceId, "databases");
  return true;
}

/** Copy a row's cells into a new row at the end, as the web's "Duplicate" does. */
export async function apiDuplicateRow(workspaceId: string, databaseId: string, rowId: string): Promise<string | null> {
  const [row] = await db
    .select({ values: databaseRows.values })
    .from(databaseRows)
    .innerJoin(databases, eq(databaseRows.databaseId, databases.id))
    .where(and(eq(databases.workspaceId, workspaceId), eq(databaseRows.databaseId, databaseId), eq(databaseRows.id, rowId)))
    .limit(1);
  if (!row) return null;
  const [{ last }] = await db.select({ last: max(databaseRows.position) }).from(databaseRows).where(eq(databaseRows.databaseId, databaseId));
  const [created] = await db
    .insert(databaseRows)
    .values({ databaseId, values: row.values ?? {}, position: after(last) })
    .returning({ id: databaseRows.id });
  apiInvalidate(workspaceId, "databases");
  return created.id;
}
