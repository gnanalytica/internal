import { describe, expect, it } from "vitest";

import { ApiInputError } from "./api/errors";
import { parseSelectOptions, planFieldPatch, planNewField, renameOptionValue, type FieldContext } from "./database-field-input";

const ctx: FieldContext = {
  fields: [
    { id: "name", type: "text", relationDatabaseId: null },
    { id: "rel", type: "relation", relationDatabaseId: "db2" },
  ],
  databaseIds: new Set(["db1", "db2"]),
  relatedFields: { db2: [{ id: "title", type: "text" }, { id: "amount", type: "number" }] },
};

describe("planNewField", () => {
  it("gives select and multi-select fields the web's starter option", () => {
    expect(planNewField({ name: "Stage", type: "select" }, ctx).options).toEqual([{ label: "Option 1", color: "#6366f1" }]);
    expect(planNewField({ name: "Tags", type: "multiSelect" }, ctx).options).toHaveLength(1);
    expect(planNewField({ name: "Site", type: "url" }, ctx)).toMatchObject({ type: "url", options: null, relationDatabaseId: null, config: null });
  });

  it("accepts every type the web offers and nothing else", () => {
    for (const type of ["text", "number", "checkbox", "date", "url", "email"]) expect(planNewField({ name: "F", type }, ctx).type).toBe(type);
    expect(() => planNewField({ name: "F", type: "formula" }, ctx)).toThrow(ApiInputError);
    expect(() => planNewField({ name: "  ", type: "text" }, ctx)).toThrow(/name/);
  });

  it("needs a relation target in this workspace", () => {
    expect(planNewField({ name: "Link", type: "relation", relationDatabaseId: "db2" }, ctx).relationDatabaseId).toBe("db2");
    expect(() => planNewField({ name: "Link", type: "relation" }, ctx)).toThrow(/relationDatabaseId/);
    expect(() => planNewField({ name: "Link", type: "relation", relationDatabaseId: "elsewhere" }, ctx)).toThrow(/not found/);
  });

  it("validates a rollup against the relation it reads through", () => {
    expect(planNewField({ name: "N", type: "rollup", config: { relationFieldId: "rel", fn: "count" } }, ctx).config).toEqual({ relationFieldId: "rel", targetFieldId: null, fn: "count" });
    expect(planNewField({ name: "Total", type: "rollup", config: { relationFieldId: "rel", targetFieldId: "amount", fn: "sum" } }, ctx).config).toEqual({ relationFieldId: "rel", targetFieldId: "amount", fn: "sum" });
    expect(() => planNewField({ name: "X", type: "rollup", config: { relationFieldId: "name", fn: "count" } }, ctx)).toThrow(/relation fields/);
    expect(() => planNewField({ name: "X", type: "rollup", config: { relationFieldId: "rel", targetFieldId: "title", fn: "sum" } }, ctx)).toThrow(/number/);
    expect(() => planNewField({ name: "X", type: "rollup", config: { relationFieldId: "rel", targetFieldId: "nope", fn: "max" } }, ctx)).toThrow(/related database/);
    expect(() => planNewField({ name: "X", type: "rollup", config: { relationFieldId: "rel", fn: "median" } }, ctx)).toThrow(/fn/);
  });
});

describe("parseSelectOptions", () => {
  it("rejects blank and duplicate labels, and fills a missing colour", () => {
    expect(() => parseSelectOptions([{ label: " " }])).toThrow(/label/);
    expect(() => parseSelectOptions([{ label: "A" }, { label: "A" }])).toThrow(/two options/);
    expect(parseSelectOptions([{ label: "A", color: "nope" }]).options[0].color).toMatch(/^#/);
  });

  it("records renames so cells can follow them", () => {
    const { renames } = parseSelectOptions([{ label: "Doing", color: "#f59e0b", previousLabel: "In progress" }, { label: "Done", color: "#10b981", previousLabel: "Done" }]);
    expect([...renames]).toEqual([["In progress", "Doing"]]);
  });
});

describe("planFieldPatch", () => {
  const text = { id: "name", type: "text", relationDatabaseId: null, options: null };

  it("renames without touching anything else", () => {
    expect(planFieldPatch(text, { name: "Title" }, ctx).values).toEqual({ name: "Title" });
  });

  it("gives a field turned into a select a starter option", () => {
    expect(planFieldPatch(text, { type: "select" }, ctx).values).toEqual({ type: "select", options: [{ label: "Option 1", color: "#6366f1" }] });
  });

  it("refuses options on a field that has none", () => {
    expect(() => planFieldPatch(text, { options: [{ label: "A" }] }, ctx)).toThrow(/Only select/);
  });

  it("clears relation settings when a relation becomes plain text", () => {
    const rel = { id: "rel", type: "relation", relationDatabaseId: "db2", options: null };
    expect(planFieldPatch(rel, { type: "text" }, ctx).values).toEqual({ type: "text", relationDatabaseId: null });
  });

  it("won't let a rollup read through itself", () => {
    const self = { id: "rel", type: "relation", relationDatabaseId: "db2", options: null };
    expect(() => planFieldPatch(self, { type: "rollup", config: { relationFieldId: "rel", fn: "count" } }, ctx)).toThrow(/relation fields/);
  });
});

describe("renameOptionValue", () => {
  const renames = new Map([["Old", "New"]]);
  it("follows a rename in select and multi-select cells only", () => {
    expect(renameOptionValue("Old", "select", renames)).toBe("New");
    expect(renameOptionValue(["Old", "Keep"], "multiSelect", renames)).toEqual(["New", "Keep"]);
    expect(renameOptionValue("Old", "text", renames)).toBe("Old");
    expect(renameOptionValue(null, "select", renames)).toBeNull();
  });
});
