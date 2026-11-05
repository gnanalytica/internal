import { describe, expect, it } from "vitest";

import { DEAL_STAGES } from "@/lib/departments";
import { DEAL_STAGE_FOR, dealStageForChange, planDealStep, prospectDealName, prospectRef } from "./deal-plan";
import { STAGES } from "./schema";

describe("which prospect stages imply a deal", () => {
  it("starts at Demo done and maps onto real deal stages", () => {
    expect(DEAL_STAGE_FOR).toEqual({ "Demo done": "qualified", "Pilot running": "proposal", Won: "won", Lost: "lost" });
    const ids = DEAL_STAGES.map((s) => s.id as string);
    for (const v of Object.values(DEAL_STAGE_FOR)) expect(ids).toContain(v);
    for (const k of Object.keys(DEAL_STAGE_FOR)) expect(STAGES).toContain(k);
  });
});

describe("dealStageForChange", () => {
  it("asks for a deal stage when the prospect reaches Demo done or later", () => {
    expect(dealStageForChange("Discovery done", "Demo done")).toBe("qualified");
    expect(dealStageForChange("Demo done", "Pilot running")).toBe("proposal");
    expect(dealStageForChange("Pilot running", "Won")).toBe("won");
    expect(dealStageForChange("Pilot running", "Lost")).toBe("lost");
  });

  it("asks for nothing below Demo done", () => {
    for (const s of ["Not contacted", "Contacted", "Discovery done"]) expect(dealStageForChange("", s)).toBeNull();
    expect(dealStageForChange("Demo done", "Discovery done")).toBeNull();
  });

  it("asks for nothing when the stage didn't change, matching as the sheet reads", () => {
    expect(dealStageForChange("Demo done", "Demo done")).toBeNull();
    expect(dealStageForChange("demo done ", "Demo done")).toBeNull();
    expect(dealStageForChange("Won", "won")).toBeNull();
  });

  it("treats a blank, unknown or missing previous status as Not contacted", () => {
    expect(dealStageForChange("", "Demo done")).toBe("qualified");
    expect(dealStageForChange("Hot lead", "Pilot running")).toBe("proposal");
    expect(dealStageForChange(undefined, "Won")).toBe("won");
    expect(dealStageForChange(null, "Demo done")).toBe("qualified");
  });

  it("accepts a jump straight past Demo done", () => {
    expect(dealStageForChange("Contacted", "Won")).toBe("won");
  });
});

describe("planDealStep", () => {
  it("opens a deal at the implied stage when there is none", () => {
    expect(planDealStep("qualified", null)).toEqual({ action: "create", stage: "qualified" });
    expect(planDealStep("proposal", null)).toEqual({ action: "create", stage: "proposal" });
    expect(planDealStep("won", null)).toEqual({ action: "create", stage: "won" });
  });

  it("never opens a deal for a lost prospect", () => {
    expect(planDealStep("lost", null)).toEqual({ action: "none" });
  });

  it("leaves a deal already at the stage alone", () => {
    expect(planDealStep("qualified", { stage: "qualified" })).toEqual({ action: "none" });
    expect(planDealStep("lost", { stage: "lost" })).toEqual({ action: "none" });
  });

  it("moves an open deal forward", () => {
    expect(planDealStep("qualified", { stage: "lead" })).toEqual({ action: "move", stage: "qualified" });
    expect(planDealStep("proposal", { stage: "qualified" })).toEqual({ action: "move", stage: "proposal" });
  });

  it("never pulls an open deal back", () => {
    expect(planDealStep("qualified", { stage: "proposal" })).toEqual({ action: "none" });
    expect(planDealStep("proposal", { stage: "negotiation" })).toEqual({ action: "none" });
  });

  it("closes an open deal as won or lost, from any stage", () => {
    expect(planDealStep("won", { stage: "negotiation" })).toEqual({ action: "move", stage: "won" });
    expect(planDealStep("lost", { stage: "qualified" })).toEqual({ action: "move", stage: "lost" });
    expect(planDealStep("won", { stage: "lost" })).toEqual({ action: "move", stage: "won" });
  });

  it("reopens a closed deal when the prospect is back in play", () => {
    expect(planDealStep("proposal", { stage: "lost" })).toEqual({ action: "move", stage: "proposal" });
    expect(planDealStep("qualified", { stage: "won" })).toEqual({ action: "move", stage: "qualified" });
  });

  it("puts a deal with an unrecognised stage back on the board", () => {
    expect(planDealStep("qualified", { stage: "archived" })).toEqual({ action: "move", stage: "qualified" });
  });
});

describe("naming and keying the deal", () => {
  it("keys by kind and record id", () => {
    expect(prospectRef("valuer", "IBBI/RV/02/2019/1")).toBe("valuer:IBBI/RV/02/2019/1");
    expect(prospectRef("bank", "BC-7")).not.toBe(prospectRef("valuer", "BC-7"));
  });

  it("is named as the dashboard names the prospect", () => {
    expect(prospectDealName({ name: " Asha Rao " }, "IBBI/RV/1")).toBe("Asha Rao");
    expect(prospectDealName({ institution: "SBI", contact_person: "R. Kumar" }, "BC-1")).toBe("SBI · R. Kumar");
    expect(prospectDealName({ institution: "SBI", contact_person: "" }, "BC-1")).toBe("SBI");
    expect(prospectDealName({}, "IBBI/RV/1")).toBe("IBBI/RV/1");
  });
});
