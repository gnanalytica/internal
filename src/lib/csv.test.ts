import { describe, expect, it } from "vitest";

import type { IssueWithRelations } from "@/lib/types";
import { issuesToCsv } from "@/lib/csv";

function issue(p: Partial<IssueWithRelations>): IssueWithRelations {
  return {
    id: "i",
    workspaceId: "w",
    projectId: null,
    cycleId: null,
    parentId: null,
    number: 1,
    title: "Title",
    description: null,
    status: "todo",
    priority: "none",
    assigneeId: null,
    creatorId: null,
    sortKey: "a0",
    dueDate: null,
    estimate: null,
    githubUrl: null,
    githubNumber: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    project: null,
    cycle: null,
    assignee: null,
    labels: [],
    ...p,
  } as IssueWithRelations;
}

describe("issuesToCsv", () => {
  it("starts with a header row", () => {
    const csv = issuesToCsv([]);
    expect(csv.split("\n")[0]).toContain("ID,Title,Status");
  });

  it("emits one row per issue with identifier", () => {
    const csv = issuesToCsv([
      issue({ number: 7, title: "Fix bug", project: { key: "ENG" } as IssueWithRelations["project"] }),
    ]);
    const rows = csv.split("\n");
    expect(rows).toHaveLength(2);
    expect(rows[1]).toContain("ENG-7");
    expect(rows[1]).toContain("Fix bug");
  });

  it("quotes values containing commas", () => {
    const csv = issuesToCsv([issue({ title: "a, b, c" })]);
    expect(csv.split("\n")[1]).toContain('"a, b, c"');
  });
});
