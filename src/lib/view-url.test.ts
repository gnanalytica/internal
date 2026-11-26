import { describe, expect, it } from "vitest";

import { readViewFromUrl, writeViewToUrl, type UrlView } from "./view-url";

const empty: UrlView = { status: [], priority: [], type: [], assignee: [], label: [], cycle: [], milestone: [], blocked: [], sort: "", group: "", view: "" };

describe("view in the URL", () => {
  it("writes only what is set, keeps other params, and reads it back", () => {
    const s = writeViewToUrl("?project=abc", { ...empty, status: ["todo", "in_progress"], assignee: ["u1"], sort: "due", view: "board" });
    expect(s).toBe("project=abc&status=in_progress,todo&assignee=u1&sort=due&view=board");
    expect(readViewFromUrl(`?${s}`)).toMatchObject({ status: ["in_progress", "todo"], assignee: ["u1"], sort: "due", view: "board", group: "" });
  });

  it("clears params when the view goes back to defaults", () => {
    expect(writeViewToUrl("?project=abc&status=todo&sort=due", empty)).toBe("project=abc");
  });

  it("reads nothing from a URL without view params, so the remembered view applies", () => {
    expect(readViewFromUrl("?project=abc")).toBeNull();
    expect(readViewFromUrl("")).toBeNull();
  });
});
