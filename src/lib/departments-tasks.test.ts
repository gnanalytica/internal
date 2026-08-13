import { describe, expect, it } from "vitest";

import {
  DEPARTMENT_LABELS,
  countOpenByDepartment,
  issueBelongsToDepartment,
  type LabelledIssueRow,
} from "@/lib/departments";

const labels = (...names: string[]) => names.map((name) => ({ name }));

describe("issueBelongsToDepartment", () => {
  it("routes engineering tracks to engineering", () => {
    expect(issueBelongsToDepartment(labels("ai-ml"), "engineering")).toBe(true);
    expect(issueBelongsToDepartment(labels("qa"), "engineering")).toBe(true);
    expect(issueBelongsToDepartment(labels("sales"), "engineering")).toBe(false);
  });

  it("separates the ops bucket that issues.type cannot", () => {
    // account-mgmt, maintenance and setup-pm are all type "ops" but answer to
    // different departments.
    expect(issueBelongsToDepartment(labels("account-mgmt"), "customer-success")).toBe(true);
    expect(issueBelongsToDepartment(labels("maintenance"), "customer-success")).toBe(true);
    expect(issueBelongsToDepartment(labels("setup-pm"), "product")).toBe(true);
    expect(issueBelongsToDepartment(labels("setup-pm"), "customer-success")).toBe(false);
  });

  it("matches on any label, so a task can sit on two surfaces", () => {
    expect(issueBelongsToDepartment(labels("qa", "sales"), "engineering")).toBe(true);
    expect(issueBelongsToDepartment(labels("qa", "sales"), "sales")).toBe(true);
  });

  it("is false for no labels, unknown labels, or a department with no tracks", () => {
    expect(issueBelongsToDepartment([], "engineering")).toBe(false);
    expect(issueBelongsToDepartment(labels("nonsense"), "engineering")).toBe(false);
    expect(issueBelongsToDepartment(labels("app"), "finance")).toBe(false);
  });

  it("assigns every mapped label to exactly one department", () => {
    const seen = new Map<string, string>();
    for (const [slug, names] of Object.entries(DEPARTMENT_LABELS))
      for (const n of names ?? []) {
        expect(seen.has(n), `${n} is claimed by ${seen.get(n)} and ${slug}`).toBe(false);
        seen.set(n, slug);
      }
  });
});

describe("countOpenByDepartment", () => {
  const row = (o: Partial<LabelledIssueRow> & { id: string; label: string }): LabelledIssueRow => ({
    projectId: "p1",
    status: "todo",
    parentId: null,
    ...o,
  });

  it("counts each department's own tasks, not the project's", () => {
    const counts = countOpenByDepartment(
      [row({ id: "1", label: "app" }), row({ id: "2", label: "qa" }), row({ id: "3", label: "sales" })],
      "p1",
    );
    expect(counts.engineering).toBe(2);
    expect(counts.sales).toBe(1);
  });

  it("counts a task once even with two labels from the same department", () => {
    const counts = countOpenByDepartment(
      [row({ id: "1", label: "app" }), row({ id: "1", label: "qa" })],
      "p1",
    );
    expect(counts.engineering).toBe(1);
  });

  it("excludes done, canceled, sub-issues and other projects", () => {
    const counts = countOpenByDepartment(
      [
        row({ id: "1", label: "app", status: "done" }),
        row({ id: "2", label: "app", status: "canceled" }),
        row({ id: "3", label: "app", parentId: "1" }),
        row({ id: "4", label: "app", projectId: "other" }),
      ],
      "p1",
    );
    expect(counts.engineering).toBeUndefined();
  });
});
