import { describe, expect, it } from "vitest";

import { dateInputValue, formatDate, formatMoney } from "@/lib/matrix-format";

describe("formatMoney", () => {
  it("formats with thousands separators and a $ prefix", () => {
    expect(formatMoney(0)).toBe("$0");
    expect(formatMoney(12000)).toBe("$12,000");
    expect(formatMoney(1500000)).toBe("$1,500,000");
  });

  it("treats null/undefined as zero", () => {
    expect(formatMoney(null)).toBe("$0");
    expect(formatMoney(undefined)).toBe("$0");
  });
});

describe("formatDate", () => {
  it("returns an em dash for empty/invalid input", () => {
    expect(formatDate(null)).toBe("—");
    expect(formatDate(undefined)).toBe("—");
    expect(formatDate("not-a-date")).toBe("—");
  });

  it("formats a date as 'Mon D, YYYY'", () => {
    expect(formatDate("2026-08-15T00:00:00.000Z")).toBe("Aug 15, 2026");
  });
});

describe("dateInputValue", () => {
  it("returns a yyyy-mm-dd string for a date", () => {
    expect(dateInputValue("2026-08-15T10:30:00.000Z")).toBe("2026-08-15");
  });

  it("returns an empty string for empty/invalid input", () => {
    expect(dateInputValue(null)).toBe("");
    expect(dateInputValue(undefined)).toBe("");
    expect(dateInputValue("nope")).toBe("");
  });
});
