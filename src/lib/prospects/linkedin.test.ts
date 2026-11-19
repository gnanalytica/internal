import { describe, expect, it } from "vitest";

import { canonicalLinkedInUrl, findDuplicates, leadRow, newLeadSchema, nextLeadId } from "./linkedin";
import type { ProspectRecord } from "./parse";
import { LINKEDIN_COLUMNS } from "./schema";

describe("nextLeadId", () => {
  it("starts at LI-0001 and goes one past the highest", () => {
    expect(nextLeadId([])).toBe("LI-0001");
    expect(nextLeadId(["LI-0002", "LI-0007", "", "junk"])).toBe("LI-0008");
  });
});

describe("canonicalLinkedInUrl", () => {
  it("treats the forms people paste as one profile", () => {
    const want = "https://linkedin.com/in/ravi-kumar-123";
    expect(canonicalLinkedInUrl("https://www.linkedin.com/in/Ravi-Kumar-123/")).toBe(want);
    expect(canonicalLinkedInUrl("linkedin.com/in/ravi-kumar-123?utm_source=share")).toBe(want);
    expect(canonicalLinkedInUrl("https://in.linkedin.com/in/ravi-kumar-123/details/experience")).toBe(want);
  });
  it("rejects what isn't a LinkedIn profile", () => {
    expect(canonicalLinkedInUrl("https://example.com/in/x")).toBe("");
    expect(canonicalLinkedInUrl("https://linkedin.com/feed/")).toBe("");
    expect(canonicalLinkedInUrl("")).toBe("");
  });
});

const rec = (p: Partial<ProspectRecord>): ProspectRecord =>
  ({ kind: "valuer", id: "x", name: "", email: "", phone: "", linkedin: { url: "", headline: "", company: "", howMet: "", addedBy: "", addedOn: null }, ...p }) as ProspectRecord;

describe("findDuplicates", () => {
  const records = [
    rec({ kind: "valuer", id: "IBBI/RV/1", name: "Ravi", phone: "+91 98480 12345" }),
    rec({ kind: "linkedin", id: "LI-0001", name: "Asha", linkedin: { url: "https://linkedin.com/in/asha", headline: "", company: "", howMet: "", addedBy: "", addedOn: null } }),
    rec({ kind: "bank", id: "B1", name: "Bank", email: "Ops@Bank.in" }),
  ];
  it("matches on profile, email or phone across tabs", () => {
    expect(findDuplicates({ linkedinUrl: "www.linkedin.com/in/Asha/", email: "", phone: "" }, records).map((d) => d.id)).toEqual(["LI-0001"]);
    expect(findDuplicates({ linkedinUrl: "", email: "ops@bank.in", phone: "" }, records)[0].why).toBe("same email");
    expect(findDuplicates({ linkedinUrl: "", email: "", phone: "09848012345" }, records)[0].id).toBe("IBBI/RV/1");
  });
  it("finds nothing for a new person", () => {
    expect(findDuplicates({ linkedinUrl: "linkedin.com/in/new", email: "n@x.in", phone: "123" }, records)).toEqual([]);
  });
});

describe("leadRow", () => {
  it("lays the row out by header and defaults owner and status", () => {
    const lead = newLeadSchema.parse({ name: "Asha", linkedinUrl: "https://www.linkedin.com/in/asha/", company: "SBI" });
    const header = ["lead_id", "name", "extra", ...LINKEDIN_COLUMNS.slice(2)];
    const row = leadRow("LI-0003", lead, "Raunak", "2026-11-19", header);
    const at = (c: string) => row[header.indexOf(c)];
    expect(at("lead_id")).toBe("LI-0003");
    expect(at("extra")).toBe("");
    expect(at("linkedin_url")).toBe("https://linkedin.com/in/asha");
    expect(at("status")).toBe("Not contacted");
    expect(at("assigned")).toBe("Raunak");
    expect(at("added_on")).toBe("2026-11-19");
  });
});
