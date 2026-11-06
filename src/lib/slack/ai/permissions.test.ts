import { describe, expect, it } from "vitest";

import { toolAccessError, toolsFor, visibleTo, type Caller } from "./permissions";
import { TOOL_NAMES, TOOL_SPECS } from "./tools";

const unlinked: Caller = { userId: null, name: null, isAdmin: false };
const member: Caller = { userId: "u1", name: "Priya", isAdmin: false };
const admin: Caller = { userId: "u2", name: "Sandeep", isAdmin: true };

describe("toolsFor", () => {
  it("gives unlinked people read-only, non-sales tools", () => {
    const tools = toolsFor(unlinked);
    expect(tools).toEqual(["search_tasks", "get_task", "project_status"]);
    for (const t of tools) expect(TOOL_SPECS[t].effect).toBe("read");
  });

  it("gives members every task tool but no prospects", () => {
    const tools = toolsFor(member);
    expect(tools).toContain("create_task");
    expect(tools).toContain("update_task");
    expect(tools).toContain("summarize_thread_to_task");
    expect(tools).toContain("get_my_work");
    expect(tools.some((t) => t.includes("prospect") || t === "log_touch")).toBe(false);
  });

  it("gives admins everything", () => {
    expect(toolsFor(admin)).toEqual(TOOL_NAMES);
  });
});

describe("toolAccessError", () => {
  it("refuses writes to unlinked people with the way to fix it", () => {
    expect(toolAccessError("create_task", unlinked)).toMatch(/Settings › Slack/);
    expect(toolAccessError("get_my_work", unlinked)).not.toBeNull();
    expect(toolAccessError("search_tasks", unlinked)).toBeNull();
  });

  it("keeps sales data to admins, even if the model calls the tool anyway", () => {
    expect(toolAccessError("search_prospects", member)).toMatch(/admins/);
    expect(toolAccessError("log_touch", member)).toMatch(/admins/);
    expect(toolAccessError("log_touch", admin)).toBeNull();
  });
});

describe("visibleTo", () => {
  const scope = { restricted: true, hiddenProjectIds: new Set(["finance"]), ownedProjectIds: new Set<string>() };
  const rows = [{ p: "eng" }, { p: "finance" }, { p: null }];

  it("drops confidential projects for restricted callers and keeps work with no project", () => {
    expect(visibleTo(scope, rows, (r) => r.p)).toEqual([{ p: "eng" }, { p: null }]);
  });

  it("leaves admins' rows alone", () => {
    expect(visibleTo({ ...scope, restricted: false }, rows, (r) => r.p)).toHaveLength(3);
  });
});
