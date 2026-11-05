import { describe, expect, it } from "vitest";

import { fillTemplate, GENERAL_ANGLE, TEMPLATE_ANGLES } from "@/components/prospects-dashboard/templates";
import type { ProspectRecord, ProspectsWorkbook } from "./parse";
import { relatedRecords, sameLender } from "./related";
import { dealOut } from "./share";
import { PITCH_ANGLES } from "./schema";

const blank: ProspectRecord = {
  kind: "valuer", id: "", name: "", status: "", stage: 0, state: "", city: "", address: "", email: "", phone: "", website: "", rvo: "", registeredOn: "", firmRegNo: "", firmStatus: "", keyContact: "", people: "", lenders: [], software: "", casesPerMonth: null, assigned: "", outreachRoute: "", lastContacted: null, nextStep: "", nextStepDate: null,
  drafts: { email: "", whatsapp: "", call: "", meeting: "" }, notes: "", scores: [], switchingBarrier: null, disqualified: "", opportunityScore: null, band: "", bandLabel: "", scoreReason: "", scoreGaps: "", researchStatus: "", researchSources: [], researchNotes: "", lastResearched: null, pitchAngle: "", objections: "", referredBy: "", practice: "",
  bank: { institution: "", type: "", office: "", department: "", contactPerson: "", designation: "", empanelmentPage: "", empanelmentWindow: "", howToReach: "" },
};
const rec = (p: Partial<ProspectRecord> & { id: string }): ProspectRecord => ({ ...blank, name: p.id, ...p });

const wb: ProspectsWorkbook = {
  valuers: [
    rec({ id: "IBBI/RV/02/2019/10034", name: "Obula Reddy", firmRegNo: "IBBI/RV-E/02/2019/101", lenders: ["PNB", "Canara Bank"], rvo: "IOV Registered Valuers Foundation" }),
    rec({ id: "IBBI/RV/02/2019/10035", name: "Srinivas", firmRegNo: "IBBI/RV-E/02/2019/101" }),
    rec({ id: "IBBI/RV/02/2019/13385", name: "Nirmalarani" }),
    rec({ id: "IBBI/RV/05/2018/10002", name: "Sachin Goel", lenders: ["SBI"] }),
  ],
  firms: [rec({ kind: "firm", id: "IBBI/RV-E/02/2019/101", name: "ANVI Technical Advisors", people: "- Mr. Mummadi Obula Reddy (10034)\n- Srinivas (10035)\n- Nirmalarani Mullapudi (13385)" })],
  rvos: [rec({ kind: "rvo", id: "IBBI/RVO/2017/003", name: "IOV Registered Valuers Foundation" })],
  panels: [rec({ kind: "panel", id: "BPV-001", name: "Chella Manasa", lenders: ["PNB", "Canara Bank"] })],
  banks: [
    rec({ kind: "bank", id: "BC-0002", name: "PNB Hyderabad", bank: { ...blank.bank, institution: "Punjab National Bank" } }),
    rec({ kind: "bank", id: "BC-0003", name: "Canara Hyderabad", bank: { ...blank.bank, institution: "Canara Bank" } }),
    rec({ kind: "bank", id: "BC-0001", name: "Anantpur DCCB", bank: { ...blank.bank, institution: "Anantpur District Cooperative Central Bank Ltd." } }),
  ],
  activity: [],
  warnings: [],
  readAt: "",
};

const ids = (r: ProspectRecord) => relatedRecords(wb, r).items.map((x) => `${x.relation}:${x.id}`);

describe("matching lenders across tabs", () => {
  it("matches short names and full names", () => {
    expect(sameLender("PNB", "Punjab National Bank")).toBe(true);
    expect(sameLender("Canara Bank", "Canara Bank")).toBe(true);
    expect(sameLender("Canara", "Canara Bank")).toBe(true);
    expect(sameLender("SBI", "State Bank of India")).toBe(true);
  });
  it("does not match a bank whose name merely contains a short lender", () => {
    expect(sameLender("PNB", "Anantpur District Cooperative Central Bank Ltd.")).toBe(false);
    expect(sameLender("Bank of India", "Central Bank of India Ltd")).toBe(false);
  });
});

describe("related records", () => {
  it("links a valuer to their firm, its other valuers and their lenders' contacts", () => {
    expect(ids(wb.valuers[0])).toEqual(["Their firm:IBBI/RV-E/02/2019/101", "Same firm:IBBI/RV/02/2019/10035", "Lender contact:BC-0002", "Lender contact:BC-0003"]);
  });
  it("finds a valuer named as a partner even without a firm number on their row", () => {
    expect(ids(wb.valuers[2])).toEqual(["Partner in:IBBI/RV-E/02/2019/101"]);
  });
  it("links a firm to every partner and valuer", () => {
    expect(ids(wb.firms[0]).sort()).toEqual(["Partner or valuer:IBBI/RV/02/2019/10034", "Partner or valuer:IBBI/RV/02/2019/10035", "Partner or valuer:IBBI/RV/02/2019/13385"]);
  });
  it("links a bank to the valuers on its panel", () => {
    expect(ids(wb.banks[0])).toEqual(["On their panel:BPV-001", "On their panel:IBBI/RV/02/2019/10034"]);
    expect(ids(wb.banks[2])).toEqual([]);
  });
  it("links an RVO to its members", () => {
    expect(ids(wb.rvos[0])).toEqual(["Member:IBBI/RV/02/2019/10034"]);
  });
});

describe("message templates", () => {
  it("has one for every pitch angle", () => {
    for (const a of PITCH_ANGLES) expect(TEMPLATE_ANGLES).toContain(a);
  });
  it("fills every placeholder", () => {
    for (const a of TEMPLATE_ANGLES)
      for (const ch of ["whatsapp", "email", "call"] as const) {
        const t = fillTemplate(a, ch, { kind: "valuer", name: "Mr. Sachin Goel", city: "", lenders: [] }, "Parv Pathak");
        expect(t).not.toMatch(/\{\w+\}/);
      }
  });
  it("addresses firms as a team and names the sender", () => {
    const t = fillTemplate(GENERAL_ANGLE, "whatsapp", { kind: "firm", name: "ANVI", city: "Hyderabad", lenders: [] }, "Parv Pathak");
    expect(t).toMatch(/^Hello team, I'm Parv from Gnanalytica/);
    expect(t).toContain("in Hyderabad");
  });
});

describe("sharing out", () => {
  it("deals best-first in turn and stops at the cap", () => {
    const plan = dealOut([1, 2, 3, 4, 5], ["A", "B"], 2);
    expect(plan.get("A")).toEqual([1, 3]);
    expect(plan.get("B")).toEqual([2, 4]);
  });
  it("gives the rest to whoever still has room when the pool is short", () => {
    const plan = dealOut([1, 2, 3], ["A", "B"], 5);
    expect([...plan.values()].flat().sort()).toEqual([1, 2, 3]);
  });
});
