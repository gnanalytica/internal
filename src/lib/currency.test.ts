import { describe, expect, it } from "vitest";

import { convert, currencySymbol, entityCurrency, formatCurrency } from "@/lib/currency";

describe("currency conversion", () => {
  it("is identity when currencies match", () => {
    expect(convert(1000, "INR", "INR")).toBe(1000);
  });

  it("converts via the INR base", () => {
    // 1 USD = ₹83, so ₹8,300 → $100
    expect(convert(8300, "INR", "USD")).toBeCloseTo(100);
    // and back
    expect(convert(100, "USD", "INR")).toBeCloseTo(8300);
    // cross rate USD→EUR via INR (83/90)
    expect(convert(90, "USD", "EUR")).toBeCloseTo(83);
  });

  it("treats unknown currencies as INR (rate 1)", () => {
    expect(convert(500, "XYZ", "INR")).toBe(500);
  });
});

describe("entityCurrency", () => {
  it("maps entities to their stored currency", () => {
    expect(entityCurrency("India")).toBe("INR");
    expect(entityCurrency("Netherlands")).toBe("EUR");
    expect(entityCurrency("Global")).toBe("USD");
  });

  it("defaults to INR for unknown/empty", () => {
    expect(entityCurrency(null)).toBe("INR");
    expect(entityCurrency("Mars")).toBe("INR");
  });
});

describe("formatCurrency", () => {
  it("prefixes the symbol and rounds", () => {
    expect(formatCurrency(2780.4, "INR")).toBe("₹2,780");
    expect(formatCurrency(1200, "USD")).toBe("$1,200");
  });

  it("exposes symbols", () => {
    expect(currencySymbol("EUR")).toBe("€");
  });
});
