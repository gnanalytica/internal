import { describe, expect, it } from "vitest";

import type {
  DatabaseField,
  DatabaseRow,
  RelatedDatabase,
  RollupConfig,
} from "@/lib/types";
import {
  computeRollup,
  relationCellIds,
  rowLabel,
} from "@/lib/database-rollup";

function field(id: string, type: string, extra: Partial<DatabaseField> = {}): DatabaseField {
  return {
    id,
    name: id,
    type,
    databaseId: "d",
    options: null,
    relationDatabaseId: null,
    config: null,
    position: "a0",
    ...extra,
  } as unknown as DatabaseField;
}

function row(id: string, values: Record<string, unknown>): DatabaseRow {
  return { id, databaseId: "d", values, position: "a0" } as unknown as DatabaseRow;
}

// Tasks DB has a relation "proj" -> Projects, and a number field "pts".
const relationField = field("proj", "relation", { relationDatabaseId: "projects" });
const fields = [field("name", "text"), relationField];

const target: RelatedDatabase = {
  id: "projects",
  name: "Projects",
  primaryFieldId: "pname",
  fields: [field("pname", "text"), field("pts", "number")],
  rows: [
    row("p1", { pname: "Website", pts: 5 }),
    row("p2", { pname: "Mobile", pts: 8 }),
    row("p3", { pname: "Billing", pts: 3 }),
  ],
};
const related = { projects: target };

describe("relationCellIds", () => {
  it("reads the id array from a relation cell", () => {
    expect(relationCellIds(row("r", { proj: ["p1", "p2"] }), "proj")).toEqual(["p1", "p2"]);
  });

  it("returns an empty array for non-array cells", () => {
    expect(relationCellIds(row("r", { proj: "nope" }), "proj")).toEqual([]);
    expect(relationCellIds(row("r", {}), "proj")).toEqual([]);
  });
});

describe("rowLabel", () => {
  it("uses the primary field value", () => {
    expect(rowLabel(row("p1", { pname: "Website" }), "pname")).toBe("Website");
  });

  it("falls back to Untitled when empty", () => {
    expect(rowLabel(row("p1", {}), "pname")).toBe("Untitled");
    expect(rowLabel(row("p1", { pname: "" }), "pname")).toBe("Untitled");
  });
});

describe("computeRollup", () => {
  const subject = row("t1", { name: "Big task", proj: ["p1", "p2"] });

  it("counts related rows", () => {
    const cfg: RollupConfig = { relationFieldId: "proj", targetFieldId: null, fn: "count" };
    expect(computeRollup(cfg, subject, fields, related)).toBe("2");
  });

  it("sums a numeric target field", () => {
    const cfg: RollupConfig = { relationFieldId: "proj", targetFieldId: "pts", fn: "sum" };
    expect(computeRollup(cfg, subject, fields, related)).toBe("13");
  });

  it("computes min, max, and average", () => {
    const base = { relationFieldId: "proj", targetFieldId: "pts" } as const;
    expect(computeRollup({ ...base, fn: "min" }, subject, fields, related)).toBe("5");
    expect(computeRollup({ ...base, fn: "max" }, subject, fields, related)).toBe("8");
    expect(computeRollup({ ...base, fn: "avg" }, subject, fields, related)).toBe("6.5");
  });

  it("returns a dash when nothing is related", () => {
    const empty = row("t2", { proj: [] });
    const cfg: RollupConfig = { relationFieldId: "proj", targetFieldId: "pts", fn: "sum" };
    expect(computeRollup(cfg, empty, fields, related)).toBe("—");
  });
});
