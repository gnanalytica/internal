import { describe, expect, it } from "vitest";

import type { DatabaseField, DatabaseRow } from "@/lib/types";
import { compareRows, filterRows, sortRows } from "@/lib/database-filters";

function field(id: string, type: string): DatabaseField {
  return { id, name: id, type, databaseId: "d", options: null, position: "a0" } as unknown as DatabaseField;
}

function row(id: string, values: Record<string, unknown>): DatabaseRow {
  return { id, databaseId: "d", values, position: "a0" } as unknown as DatabaseRow;
}

const nameField = field("name", "text");
const ageField = field("age", "number");
const doneField = field("done", "checkbox");

const rows = [
  row("r1", { name: "Banana", age: 30, done: true }),
  row("r2", { name: "Apple", age: 10, done: false }),
  row("r3", { name: "Cherry", age: null, done: true }),
];

describe("filterRows", () => {
  it("returns all rows for an empty query", () => {
    expect(filterRows(rows, "")).toHaveLength(3);
  });

  it("matches across any field value (case-insensitive)", () => {
    expect(filterRows(rows, "apple").map((r) => r.id)).toEqual(["r2"]);
    expect(filterRows(rows, "10").map((r) => r.id)).toEqual(["r2"]);
  });

  it("returns nothing when no row matches", () => {
    expect(filterRows(rows, "zzz")).toEqual([]);
  });
});

describe("sortRows", () => {
  it("returns the input unchanged when no field is given", () => {
    expect(sortRows(rows, null, "asc").map((r) => r.id)).toEqual(["r1", "r2", "r3"]);
  });

  it("sorts text ascending and descending", () => {
    expect(sortRows(rows, nameField, "asc").map((r) => r.id)).toEqual(["r2", "r1", "r3"]);
    expect(sortRows(rows, nameField, "desc").map((r) => r.id)).toEqual(["r3", "r1", "r2"]);
  });

  it("sorts numbers numerically, not lexically", () => {
    expect(sortRows(rows, ageField, "asc").map((r) => r.id)).toEqual(["r2", "r1", "r3"]);
  });

  it("keeps empty values last regardless of direction", () => {
    expect(sortRows(rows, ageField, "asc").at(-1)?.id).toBe("r3");
    expect(sortRows(rows, ageField, "desc").at(-1)?.id).toBe("r3");
  });

  it("does not mutate the input array", () => {
    const before = rows.map((r) => r.id);
    sortRows(rows, nameField, "asc");
    expect(rows.map((r) => r.id)).toEqual(before);
  });
});

describe("compareRows", () => {
  it("orders checkbox true before false when descending", () => {
    const cmp = compareRows(doneField, "desc");
    expect(cmp(rows[0], rows[1])).toBeLessThan(0);
  });
});
