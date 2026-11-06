import { describe, expect, it } from "vitest";

import { isToolName, parseToolInput, TOOL_NAMES, TOOL_SPECS, toolDefinitions } from "./tools";

describe("tool definitions", () => {
  it("are strict, closed objects whose properties match the server-side schema", () => {
    for (const def of toolDefinitions(TOOL_NAMES)) {
      expect(def.strict).toBe(true);
      expect(def.input_schema.additionalProperties).toBe(false);
      const spec = TOOL_SPECS[def.name as keyof typeof TOOL_SPECS];
      const zodShape = Object.keys((spec.schema as unknown as { shape?: object }).shape ?? (spec.schema as unknown as { _def: { schema?: { shape: object } } })._def.schema?.shape ?? {});
      const jsonProps = Object.keys(def.input_schema.properties ?? {});
      expect(jsonProps.sort(), def.name).toEqual(zodShape.sort());
      for (const r of def.input_schema.required ?? []) expect(jsonProps).toContain(r);
    }
  });

  it("keep a fixed order whatever subset is asked for (the order is part of the cached prefix)", () => {
    const a = toolDefinitions(["project_status", "search_tasks", "get_task"]).map((t) => t.name);
    expect(a).toEqual(["search_tasks", "get_task", "project_status"]);
  });

  it("use no schema keywords strict mode rejects", () => {
    const json = JSON.stringify(toolDefinitions(TOOL_NAMES));
    for (const k of ["minLength", "maxLength", "minimum", "maximum", "pattern", "$schema"]) expect(json).not.toContain(`"${k}"`);
  });

  it("recognises its own names only", () => {
    expect(isToolName("get_task")).toBe(true);
    expect(isToolName("delete_task")).toBe(false);
    expect(isToolName("toString")).toBe(false);
  });
});

describe("parseToolInput", () => {
  it("accepts a well-formed call and trims text", () => {
    expect(parseToolInput("create_task", { title: "  Fix login  ", priority: "high" })).toEqual({
      ok: true,
      value: { title: "Fix login", priority: "high" },
    });
  });

  it("rejects unknown fields, bad enums and malformed dates with a reason", () => {
    expect(parseToolInput("create_task", { title: "x", owner: "me" }).ok).toBe(false);
    const status = parseToolInput("update_task", { task: "VAL-1", status: "finished" });
    expect(status.ok).toBe(false);
    const date = parseToolInput("create_task", { title: "x", due_date: "next friday" });
    expect(date).toMatchObject({ ok: false, error: expect.stringContaining("due_date") });
  });

  it("needs a title for a task and something to change for an update", () => {
    expect(parseToolInput("create_task", { title: "   " }).ok).toBe(false);
    expect(parseToolInput("update_task", { task: "VAL-1" })).toMatchObject({ ok: false, error: expect.stringContaining("Say what to change") });
    expect(parseToolInput("update_task", { task: "VAL-1", due_date: "none" }).ok).toBe(true);
  });

  it("checks touches against the sheet's own vocabularies", () => {
    const touch = { prospect: "IBBI/RV/1", channel: "Call", outcome: "Connected", what_they_said: "Wants a demo" };
    expect(parseToolInput("log_touch", touch).ok).toBe(true);
    expect(parseToolInput("log_touch", { ...touch, channel: "Carrier pigeon" }).ok).toBe(false);
    expect(parseToolInput("log_touch", { ...touch, duration_min: 9000 }).ok).toBe(false);
  });

  it("takes an empty object for get_my_work and nothing else", () => {
    expect(parseToolInput("get_my_work", {}).ok).toBe(true);
    expect(parseToolInput("get_my_work", { user: "x" }).ok).toBe(false);
  });
});
