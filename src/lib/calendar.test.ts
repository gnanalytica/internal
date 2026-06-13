import { describe, expect, it } from "vitest";

import { monthMatrix, ymd } from "@/lib/calendar";

describe("ymd", () => {
  it("zero-pads month and day", () => {
    expect(ymd(new Date(Date.UTC(2024, 0, 5)))).toBe("2024-01-05");
    expect(ymd(new Date(Date.UTC(2024, 11, 31)))).toBe("2024-12-31");
  });
});

describe("monthMatrix", () => {
  it("always returns 6 weeks of 7 days", () => {
    const m = monthMatrix(2024, 2); // March 2024
    expect(m).toHaveLength(6);
    expect(m.every((w) => w.length === 7)).toBe(true);
  });

  it("starts on the Sunday on/before the 1st", () => {
    // March 1, 2024 is a Friday → grid starts Sunday Feb 25.
    const m = monthMatrix(2024, 2);
    expect(m[0][0].key).toBe("2024-02-25");
    expect(m[0][0].inMonth).toBe(false);
  });

  it("marks in-month days correctly", () => {
    const m = monthMatrix(2024, 2);
    const first = m.flat().find((d) => d.key === "2024-03-01");
    expect(first?.inMonth).toBe(true);
    const prev = m.flat().find((d) => d.key === "2024-02-29");
    expect(prev?.inMonth).toBe(false);
  });
});
