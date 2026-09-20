import { describe, expect, it } from "vitest";

import {
  cellString,
  institutionalRole,
  isBlankRow,
  isInstitutionalRow,
  isInstitutionalSpecialisation,
  normalizedNameKey,
  parseSheetDate,
  phonesIn,
  rowHash,
  rowToRecord,
  splitMulti,
  toBool,
  toE164India,
  toInt,
} from "./parse";

describe("multi-values", () => {
  it("splits on ; and newlines and trims", () => {
    expect(splitMulti("a@x.com; b@x.com ;\nc@x.com")).toEqual(["a@x.com", "b@x.com", "c@x.com"]);
    expect(splitMulti("")).toEqual([]);
    expect(splitMulti(null)).toEqual([]);
  });
});

describe("phones", () => {
  it("normalises the formats the sheet actually uses", () => {
    expect(toE164India("9674725053")).toBe("+919674725053");
    expect(toE164India("+919491046739")).toBe("+919491046739");
    expect(toE164India("+91 88797 64119")).toBe("+918879764119");
    expect(toE164India("+91-854-787-8978")).toBe("+918547878978");
    expect(toE164India("09912808720")).toBe("+919912808720");
  });
  it("finds the mobile in a cell that also holds a landline or several numbers", () => {
    // Real cells from the live sheet, where only the second number is reachable.
    expect(toE164India("04552-251038, 9842111177")).toBe("+919842111177");
    expect(toE164India("044-26620241, 09444114972")).toBe("+919444114972");
    expect(toE164India("9812139188 9315447057 9255414430")).toBe("+919812139188");
    // A number written with spaces must survive whole, not be split into pieces.
    expect(toE164India("+91 88797 64119")).toBe("+918879764119");
    expect(toE164India("+91 98765 43210")).toBe("+919876543210");
  });
  it("refuses what is not a mobile-shaped Indian number", () => {
    expect(toE164India("274544")).toBeNull();
    expect(toE164India("1800-2334526")).toBeNull();
    expect(toE164India("0141-6618888")).toBeNull();
    expect(toE164India("No personal professional mobile verified")).toBeNull();
    // A landline split into pieces must not be reassembled into a fake mobile.
    expect(toE164India("0427 4056638")).toBeNull();
    // An email in the phone column is not a phone.
    expect(toE164India("pavanakumar.services@outlook.com; pavankumar.services@gmail.com")).toBeNull();
  });
  it("finds every number in a multi-value cell once", () => {
    expect(phonesIn("9912808720 / 7780766820")).toEqual(["+919912808720", "+917780766820"]);
    expect(phonesIn("8880519265; 9743307500; 8880519265")).toEqual(["+918880519265", "+919743307500"]);
  });
});

describe("dates", () => {
  it("parses the three formats in the workbook", () => {
    expect(parseSheetDate("08 Oct, 2018")).toBe("2018-10-08");
    expect(parseSheetDate("11 August, 2025")).toBe("2025-08-11");
    expect(parseSheetDate("2026-09-19")).toBe("2026-09-19");
    expect(parseSheetDate("13-02-2028")).toBe("2028-02-13");
    expect(parseSheetDate("31.10.2025")).toBe("2025-10-31");
  });
  it("leaves prose alone", () => {
    expect(parseSheetDate("valid through 13-02-2028")).toBeNull();
    expect(parseSheetDate("")).toBeNull();
  });
});

describe("scalars", () => {
  it("ints, bools, enums", () => {
    expect(toInt("1,161")).toBe(1161);
    expect(toInt(85)).toBe(85);
    expect(toInt("")).toBeNull();
    expect(toBool("Yes")).toBe(true);
    expect(toBool("no")).toBe(false);
    expect(toBool("Unknown")).toBeNull();
  });
  it("the INSTITUTIONAL convention is a prefix, case-sensitive", () => {
    expect(isInstitutionalSpecialisation("INSTITUTIONAL — Canara Bank Authorised Officer; not a valuer")).toBe(true);
    expect(isInstitutionalSpecialisation("Institutional valuations for banks")).toBe(false);
    expect(isInstitutionalSpecialisation("")).toBe(false);
  });
  it("the marker is read from either column, because it landed in associations_and_roles", () => {
    // The live sheet, verified 2026-09-20: all four bank-side rows carry it here.
    expect(isInstitutionalRow({ associations_and_roles: "INSTITUTIONAL — Bank recovery / SARFAESI workflow influencer; not a valuer" })).toBe(true);
    expect(isInstitutionalRow({ specialisation: "INSTITUTIONAL — Ex-SBI banker; not a valuer" })).toBe(true);
    // A genuine valuer whose text merely mentions institutional work is not one.
    expect(isInstitutionalRow({ specialisation: "Land & Building; corporate/institutional valuation" })).toBe(false);
    expect(isInstitutionalRow({})).toBe(false);
  });
  it("the role is what follows the marker", () => {
    expect(institutionalRole({ associations_and_roles: "INSTITUTIONAL — Bank recovery / SARFAESI workflow influencer; not a valuer" }))
      .toBe("Bank recovery / SARFAESI workflow influencer; not a valuer");
    expect(institutionalRole({ specialisation: "Land & Building" })).toBeNull();
  });
  it("name key matches the workbook's normalisation", () => {
    expect(normalizedNameKey("A Ahmed Nawaz Mohiddin")).toBe("aahmednawazmohiddin");
    expect(normalizedNameKey("D. Venkateswara-Rao")).toBe("dvenkateswararao");
  });
});

describe("rows", () => {
  it("records keep cells as the sheet shows them", () => {
    const rec = rowToRecord(["a", "b", "", "c"], ["x", 12, "ignored", null]);
    expect(rec).toEqual({ a: "x", b: "12", c: "" });
    expect(cellString(true)).toBe("TRUE");
  });
  it("hash is stable and cell-sensitive", () => {
    expect(rowHash(["a", 1, null])).toBe(rowHash(["a", "1", ""]));
    expect(rowHash(["a", 1])).not.toBe(rowHash(["a", 2]));
  });
  it("blank rows are spacer rows", () => {
    expect(isBlankRow(["", null, "  "])).toBe(true);
    expect(isBlankRow(["", "x"])).toBe(false);
  });
});
