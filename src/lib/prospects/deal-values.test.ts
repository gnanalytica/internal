import { describe, expect, it } from "vitest";

import { dealsByProspect, dealState, openDealTotal } from "./deal-values";

const deal = (prospectRef: string | null, stage: string, value: number, entity = "India") => ({ prospectRef, stage, value, entity });

describe("dealState", () => {
  it("reads won and lost as closed, every other stage as open", () => {
    expect(dealState("won")).toBe("won");
    expect(dealState("lost")).toBe("lost");
    expect(dealState("qualified")).toBe("open");
    expect(dealState("negotiation")).toBe("open");
  });
});

describe("dealsByProspect", () => {
  it("keys deals by prospect ref, with value, currency and state", () => {
    const m = dealsByProspect([deal("valuer:A", "proposal", 50000), deal("bank:B", "won", 200, "Netherlands"), deal(null, "lead", 10)]);
    expect(m.get("valuer:A")).toEqual({ value: 50000, currency: "INR", state: "open" });
    expect(m.get("bank:B")).toEqual({ value: 200, currency: "EUR", state: "won" });
    expect(m.size).toBe(2);
  });

  it("prefers a prospect's open deal over a closed one", () => {
    expect(dealsByProspect([deal("valuer:A", "lost", 1), deal("valuer:A", "qualified", 2)]).get("valuer:A")?.value).toBe(2);
    expect(dealsByProspect([deal("valuer:A", "qualified", 2), deal("valuer:A", "lost", 1)]).get("valuer:A")?.value).toBe(2);
  });
});

describe("openDealTotal", () => {
  it("counts open deals only, in rupees", () => {
    const t = openDealTotal([deal("valuer:A", "proposal", 50000), deal("valuer:B", "won", 90000), deal("bank:C", "qualified", 10, "Netherlands")]);
    expect(t.count).toBe(2);
    expect(t.inr).toBe(50000 + 900);
  });
});
