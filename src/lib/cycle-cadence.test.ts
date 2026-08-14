import { describe, expect, it } from "vitest";

import {
  ceremonyTasksFor,
  isCadenceEmpty,
  normalizeCadence,
  type CycleCadence,
} from "@/lib/cycle-cadence";

// A cycle running Friday → Thursday, matching the documented cadence.
const CYCLE = {
  startDate: new Date("2026-09-25T00:00:00Z"),
  endDate: new Date("2026-10-01T00:00:00Z"),
};

const CADENCE: CycleCadence = {
  ceremonies: [
    { title: "Fri: sprint planning", dayOffset: 0, estimate: 1 },
    { title: "Daily 15-min standup", dayOffset: null },
    { title: "Thu: demo + metrics review + retro", dayOffset: 6, estimate: 2 },
  ],
};

describe("isCadenceEmpty", () => {
  it("treats null and an empty ceremony list alike", () => {
    expect(isCadenceEmpty(null)).toBe(true);
    expect(isCadenceEmpty({ ceremonies: [] })).toBe(true);
    expect(isCadenceEmpty(CADENCE)).toBe(false);
  });
});

describe("normalizeCadence", () => {
  it("drops blank titles and trims the rest", () => {
    const n = normalizeCadence({
      ceremonies: [{ title: "  Retro  " }, { title: "   " }, { title: "" }],
    });
    expect(n.ceremonies).toHaveLength(1);
    expect(n.ceremonies[0].title).toBe("Retro");
  });

  it("falls back to safe defaults for unknown type and priority", () => {
    const n = normalizeCadence({
      ceremonies: [{ title: "Planning", type: "wizardry", priority: "critical" as never }],
    });
    expect(n.ceremonies[0].type).toBe("engineering");
    expect(n.ceremonies[0].priority).toBe("none");
  });

  it("rejects negative and non-finite numbers rather than passing them to the DB", () => {
    const n = normalizeCadence({
      ceremonies: [{ title: "Planning", estimate: -3, dayOffset: Number.NaN }],
    });
    expect(n.ceremonies[0].estimate).toBeNull();
    expect(n.ceremonies[0].dayOffset).toBeNull();
  });
});

describe("ceremonyTasksFor", () => {
  it("dates each ceremony from the cycle start, leaving spanning ones undated", () => {
    const tasks = ceremonyTasksFor(CADENCE, CYCLE, []);
    expect(tasks.map((t) => t.title)).toEqual([
      "Fri: sprint planning",
      "Daily 15-min standup",
      "Thu: demo + metrics review + retro",
    ]);
    expect(tasks[0].dueDate?.toISOString().slice(0, 10)).toBe("2026-09-25");
    // A standup runs all cycle, so a single due date would be a lie.
    expect(tasks[1].dueDate).toBeNull();
    expect(tasks[2].dueDate?.toISOString().slice(0, 10)).toBe("2026-10-01");
  });

  it("skips ceremonies the cycle already has, case- and space-insensitively", () => {
    const tasks = ceremonyTasksFor(CADENCE, CYCLE, ["  fri: SPRINT planning "]);
    expect(tasks.map((t) => t.title)).toEqual([
      "Daily 15-min standup",
      "Thu: demo + metrics review + retro",
    ]);
  });

  it("is idempotent — a second application over its own output adds nothing", () => {
    const first = ceremonyTasksFor(CADENCE, CYCLE, []);
    const second = ceremonyTasksFor(
      CADENCE,
      CYCLE,
      first.map((t) => t.title),
    );
    expect(second).toEqual([]);
  });

  it("adds nothing when the rolled-over work is already the cadence", () => {
    // The invariant rollover depends on: it moves unfinished ceremonies into
    // the new cycle *before* stamping, so stamping sees them and adds none.
    // Stamping first duplicated every one — a cycle with two standups.
    const rolledOver = CADENCE.ceremonies.map((c) => c.title);
    expect(ceremonyTasksFor(CADENCE, CYCLE, rolledOver)).toEqual([]);
  });

  it("fills only the ceremonies that did not roll over", () => {
    // Planning was finished last cycle, so it stayed behind; the new cycle
    // still needs its own.
    const rolledOver = ["Daily 15-min standup", "Thu: demo + metrics review + retro"];
    const added = ceremonyTasksFor(CADENCE, CYCLE, rolledOver);
    expect(added.map((t) => t.title)).toEqual(["Fri: sprint planning"]);
  });

  it("keeps a ceremony inside its cycle when the offset overshoots the end", () => {
    const tasks = ceremonyTasksFor(
      { ceremonies: [{ title: "Retro", dayOffset: 99 }] },
      CYCLE,
      [],
    );
    expect(tasks[0].dueDate?.toISOString().slice(0, 10)).toBe("2026-10-01");
  });

  it("produces nothing for a project with no cadence", () => {
    expect(ceremonyTasksFor(null, CYCLE, [])).toEqual([]);
  });
});
