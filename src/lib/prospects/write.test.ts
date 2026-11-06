import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `writeRecord` reads the header and the key column in one call using where
 * the key column was last seen. The rule that matters: a stale hint may cost
 * an extra read, never a write into the wrong row. These run it against an
 * in-memory sheet whose columns and rows move between writes.
 */

type Grid = unknown[][];
const sheet: { tabs: Record<string, Grid>; calls: string[] } = { tabs: {}, calls: [] };

const colIndex = (letters: string) => [...letters].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0) - 1;

/** Resolve `'Tab'!1:1`, `'Tab'!C2:C` or `'Tab'!7:7` against the fake sheet. */
function read(a1: string): Grid {
  const [, tab, ref] = /^'(.+)'!(.+)$/.exec(a1)!;
  const grid = sheet.tabs[tab.replace(/''/g, "'")] ?? [];
  const rowRange = /^(\d+):(\d+)$/.exec(ref);
  if (rowRange) return grid.slice(Number(rowRange[1]) - 1, Number(rowRange[2]));
  const col = /^([A-Z]+)(\d+):([A-Z]+)$/.exec(ref)!;
  const c = colIndex(col[1]);
  return grid.slice(Number(col[2]) - 1).map((r) => [r[c]]);
}

vi.mock("server-only", () => ({}));
vi.mock("./sheets-api", () => ({
  readRange: async (_id: string, a1: string) => {
    sheet.calls.push("readRange");
    return read(a1);
  },
  readRanges: async (_id: string, ranges: string[]) => {
    sheet.calls.push("readRanges");
    return ranges.map(read);
  },
  formulaColumnsInRows: async () => {
    sheet.calls.push("formulaColumnsInRows");
    return new Set<number>();
  },
  writeCells: async (_id: string, cells: { range: string; value: unknown }[]) => {
    sheet.calls.push("writeCells");
    for (const { range, value } of cells) {
      const [, tab, letters, row] = /^'(.+)'!([A-Z]+)(\d+)$/.exec(range)!;
      sheet.tabs[tab][Number(row) - 1][colIndex(letters)] = value;
    }
  },
  appendRows: async () => {
    sheet.calls.push("appendRows");
  },
}));

const TAB = "Registered Valuers";

beforeEach(() => {
  sheet.calls = [];
  sheet.tabs[TAB] = [
    ["name", "registration_no", "city"],
    ["Asha", "IBBI/1", "Pune"],
    ["Ravi", "IBBI/2", "Delhi"],
  ];
});

describe("writeRecord", () => {
  it("writes the row the id is on, and reads header + ids in one call once the column is known", async () => {
    const { writeRecord } = await import("./write");
    const first = await writeRecord("valuer", "IBBI/2", { city: "Mumbai" });
    expect(first.row).toBe(3);
    expect(sheet.tabs[TAB][2]).toEqual(["Ravi", "IBBI/2", "Mumbai"]);

    sheet.calls = [];
    const second = await writeRecord("valuer", "IBBI/1", { city: "Nagpur" });
    expect(second.row).toBe(2);
    expect(sheet.tabs[TAB][1]).toEqual(["Asha", "IBBI/1", "Nagpur"]);
    // header + ids together, then the row and its formula check together.
    expect(sheet.calls.slice(0, 1)).toEqual(["readRanges"]);
    expect(sheet.calls.filter((c) => c.startsWith("read"))).toEqual(["readRanges", "readRange"]);
  });

  it("follows the key column when it moves, instead of trusting where it was", async () => {
    const { writeRecord } = await import("./write");
    await writeRecord("valuer", "IBBI/1", { city: "Pune" });

    // Someone inserts a column before registration_no and re-sorts the rows.
    sheet.tabs[TAB] = [
      ["name", "phone", "registration_no", "city"],
      ["Ravi", "", "IBBI/2", "Delhi"],
      ["Asha", "", "IBBI/1", "Pune"],
    ];
    const res = await writeRecord("valuer", "IBBI/2", { city: "Chennai" });
    expect(res.row).toBe(2);
    expect(sheet.tabs[TAB][1]).toEqual(["Ravi", "", "IBBI/2", "Chennai"]);
    expect(sheet.tabs[TAB][2]).toEqual(["Asha", "", "IBBI/1", "Pune"]);
  });

  it("still refuses an id that is missing or on two rows", async () => {
    const { writeRecord } = await import("./write");
    await expect(writeRecord("valuer", "IBBI/9", { city: "X" })).rejects.toThrow("no longer in");
    sheet.tabs[TAB].push(["Dup", "IBBI/1", ""]);
    await expect(writeRecord("valuer", "IBBI/1", { city: "X" })).rejects.toThrow("on 2 rows");
  });
});
