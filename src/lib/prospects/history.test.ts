import { describe, expect, it } from "vitest";

import { buildHistory, whenLabel } from "./history";
import type { ActivityEntry } from "./parse";

const touch = (id: string, date: string, channel: string, outcome: string, summary = ""): ActivityEntry => ({
  id,
  loggedAt: "",
  date,
  recordType: "Valuer",
  registrationNo: "IBBI/1",
  name: "Asha",
  by: "Sandeep Polavarapu",
  channel,
  direction: "Outbound",
  outcome,
  durationMin: null,
  statusAfter: "Contacted",
  summary,
});

describe("buildHistory", () => {
  it("reads owner and stage lines, and shows each touch once in its note's place", () => {
    const notes = [
      "27-11-2026 — Stage: Contacted → Discovery done by Sandeep",
      "27-11-2026 — Unassigned (was Parv) by Sandeep",
      "26-11-2026 — Call (5 min): Busy — call back. Try evening — Tasleem",
      "25-11-2026 — Assigned to Parv by Sandeep",
      "Met at the IBBI event",
    ].join("\n");
    const items = buildHistory(notes, [touch("A-2", "2026-11-26", "Call", "Busy — call back")]);
    expect(items.map((i) => i.type)).toEqual(["stage", "owner", "touch", "owner", "note"]);
    expect(items[0]).toMatchObject({ from: "Contacted", to: "Discovery done", by: "Sandeep", date: "2026-11-27" });
    expect(items[1]).toMatchObject({ to: "", from: "Parv", by: "Sandeep" });
    expect(items[3]).toMatchObject({ to: "Parv", from: "", by: "Sandeep", date: "2026-11-25" });
    expect(items[4]).toEqual({ type: "note", date: null, text: "Met at the IBBI event" });
  });

  it("keeps a touch's line as a note when no Activity row matches, and places a row with no line by date", () => {
    const notes = ["27-11-2026 — Email: Sent — Sandeep", "20-11-2026 — Asked for a callback"].join("\n");
    const items = buildHistory(notes, [touch("A-9", "2026-11-24", "WhatsApp", "Replied")]);
    expect(items.map((i) => i.type)).toEqual(["note", "touch", "note"]);
  });

  it("puts unmatched touches at the end when every line is newer or undated", () => {
    expect(buildHistory("", [touch("A-1", "2026-11-01", "Call", "Connected")]).map((i) => i.type)).toEqual(["touch"]);
  });
});

describe("whenLabel", () => {
  it("is relative for the last week, then a date", () => {
    expect(whenLabel("2026-11-27", "2026-11-27")).toBe("Today");
    expect(whenLabel("2026-11-26", "2026-11-27")).toBe("Yesterday");
    expect(whenLabel("2026-11-24", "2026-11-27")).toBe("3d ago");
    expect(whenLabel("2026-11-01", "2026-11-27")).toBe("01-11-2026");
    expect(whenLabel(null, "2026-11-27")).toBe("");
  });
});

describe("comments", () => {
  it("writes one signed line and reads it back with its author", async () => {
    const { commentLine } = await import("./history");
    const line = commentLine("2026-11-27", "@parv call him\nThursday ", "Sandeep Polavarapu");
    expect(line).toBe("27-11-2026 — @parv call him Thursday — Sandeep");
    expect(buildHistory(line, [])).toEqual([{ type: "note", date: "2026-11-27", text: "@parv call him Thursday", by: "Sandeep" }]);
  });
  it("leaves an unsigned or undated line unsigned", () => {
    expect(buildHistory("27-11-2026 — Partner prefers mornings", [])[0]).toEqual({ type: "note", date: "2026-11-27", text: "Partner prefers mornings" });
    expect(buildHistory("SBI — Hyderabad zone", [])[0]).toEqual({ type: "note", date: null, text: "SBI — Hyderabad zone" });
  });
});
