import { describe, expect, it } from "vitest";

import { matchesExclusion, parseExclusions, projectCompany, projectPerson } from "./projection";

const person = (over: Record<string, string> = {}) => ({
  person_id: "P00145",
  full_name: "Paleti Surendra",
  ibbi_reg_no: "IBBI/RV/02/2022/15089",
  rvo: "IOV Registered Valuers Foundation",
  email: "",
  phone: "",
  city: "Guntur",
  state: "Andhra Pradesh",
  lead_score: "63",
  sources: "IBBI; PNB",
  specialisation: "",
  ...over,
});

describe("projectPerson", () => {
  it("takes contactability from People first, then Prospect Intelligence", () => {
    const p = projectPerson(person(), {
      prospect: { "Public Phone": "9912808720 / 7780766820", "Public Email": "s@x.com", Priority: "a", "Opportunity Score /100": "85", "Score Band": "A", "Research Status": "Deep dive complete", "Best First Channel": "WhatsApp first" },
    });
    expect(p.externalId).toBe("P00145");
    expect(p.phone).toBe("9912808720 / 7780766820");
    expect(p.phoneE164).toBe("+919912808720");
    expect(p.email).toBe("s@x.com");
    expect(p.priority).toBe("A");
    expect(p.opportunityScore).toBe(85);
    expect(p.scoreBand).toBe("A");
    expect(p.persona).toBeNull();
    expect(p.channel).toBe("direct");
  });
  it("People's own phone wins over the prospect row", () => {
    const p = projectPerson(person({ phone: "9674725053", email: "a@x.com; b@x.com" }), { prospect: { "Public Phone": "111" } });
    expect(p.phone).toBe("9674725053");
    expect(p.email).toBe("a@x.com");
  });
  it("INSTITUTIONAL prefix makes the row institutional whatever else is blank", () => {
    const p = projectPerson(person({ ibbi_reg_no: "", rvo: "", specialisation: "INSTITUTIONAL — Canara Bank Authorised Officer; not a valuer" }));
    expect(p.persona).toBe("institutional");
    expect(p.channel).toBe("lender");
    const q = projectPerson(person({ ibbi_reg_no: "", rvo: "" }));
    expect(q.persona).toBeNull();
  });
  it("reads the marker from associations_and_roles, which is where it actually is", () => {
    // P05675 Rohit Kumar as the live sheet holds him: every other column blank.
    const p = projectPerson(person({
      person_id: "P05675", full_name: "Rohit Kumar", ibbi_reg_no: "", rvo: "", specialisation: "", sources: "", lead_score: "",
      associations_and_roles: "INSTITUTIONAL — Bank recovery / SARFAESI workflow influencer; not a valuer",
    }), { dossier: { "Persona / GTM Role": "Bank recovery / SARFAESI workflow influencer, Canara Hyderabad North" } });
    // The dossier's persona text must NOT win over the marker, or he is counted as a valuer.
    expect(p.persona).toBe("institutional");
    expect(p.channel).toBe("lender");
    expect(p.title).toBe("Bank recovery / SARFAESI workflow influencer; not a valuer");
  });
  it("carries the sheet's duplicate_flag", () => {
    expect(projectPerson(person({ duplicate_flag: "DUPLICATE" })).sheetDuplicate).toBe(true);
    expect(projectPerson(person({ duplicate_flag: "UNIQUE" })).sheetDuplicate).toBe(false);
    expect(projectPerson(person()).sheetDuplicate).toBe(false);
  });
  it("reads the owner's outreach columns when present", () => {
    const p = projectPerson(person({ outreach_status: "Contacted", last_contacted_at: "2026-09-21" }));
    expect(p.outreachStatus).toBe("contacted");
    expect(p.lastContactedAt?.toISOString()).toBe("2026-09-21T12:00:00.000Z");
    expect(projectPerson(person()).outreachStatus).toBeNull();
  });
});

describe("projectCompany", () => {
  it("keeps only well-formed person ids from linked_person_ids", () => {
    const c = projectCompany({ company_id: "C0011", company_name: "DesCon", linked_person_ids: "P00593; P00267; junk; P1", pnb_category: "c", research_confidence: "High" });
    expect(c.linkedPersonIds).toEqual(["P00593", "P00267"]);
    expect(c.pnbCategory).toBe("C");
    expect(c.researchConfidence).toBe("high");
  });
});

describe("exclusions", () => {
  const entries = parseExclusions([
    { "Entity / Person": "Madhu Pagolu", Type: "Person", "Aliases / Related Names": "Pogolu Madhu", Action: "Do not contact", Reason: "User-requested" },
    { "Entity / Person": "INN Tech Global Valuers Private Limited", Type: "Organisation", "Aliases / Related Names": "IGVPL; M/S INNTECH GLOBAL VALUERS PRIVATE LIMITED", Action: "Do not contact", Reason: "" },
  ]);
  it("people match exactly, including aliases", () => {
    expect(matchesExclusion("Pogolu Madhu", entries)?.name).toBe("Madhu Pagolu");
    expect(matchesExclusion("madhu pagolu", entries)?.name).toBe("Madhu Pagolu");
    expect(matchesExclusion("Madhu Pagolu Reddy", entries)).toBeNull();
  });
  it("organisations match on containment either way", () => {
    expect(matchesExclusion("Inntech Global Valuers Pvt Ltd", entries)).toBeNull();
    expect(matchesExclusion("M/S INNTECH GLOBAL VALUERS PRIVATE LIMITED", entries)?.type).toBe("organisation");
    expect(matchesExclusion("IGVPL", entries)?.type).toBe("organisation");
  });
});
