import { describe, expect, it } from "vitest";

import { assignmentEffects, claimOnStatusChange, withAssignment } from "./plan";

const header = ["name", "registration_no", "status", "assigned", "next_step_date", "notes"];
const row = (status: string, assigned: string, date: string) => ["Asha", "IBBI/1", status, assigned, date, "old note"];
const ctx = { by: "Sandeep Polavarapu", today: "2026-11-18" };

describe("assignmentEffects", () => {
  it("notes who took an unowned record and gives it a follow-up tomorrow", () => {
    expect(assignmentEffects("valuer", header, row("Contacted", "", ""), { assigned: "Parv" }, ctx)).toEqual({
      prependNote: "18-11-2026 — Assigned to Parv by Sandeep",
      next_step_date: "2026-11-19",
    });
  });

  it("names the previous owner on a handover, and keeps an existing follow-up date", () => {
    expect(assignmentEffects("valuer", header, row("Contacted", "Tasleem", "2026-11-25"), { assigned: "Parv" }, ctx)).toEqual({
      prependNote: "18-11-2026 — Assigned to Parv (was Tasleem) by Sandeep",
    });
  });

  it("notes an unassignment without setting a date", () => {
    expect(assignmentEffects("valuer", header, row("Contacted", "Parv", ""), { assigned: null }, ctx)).toEqual({
      prependNote: "18-11-2026 — Unassigned (was Parv) by Sandeep",
    });
  });

  it("does nothing when the owner doesn't really change", () => {
    expect(assignmentEffects("valuer", header, row("Contacted", "Parv Pathak", ""), { assigned: "parv" }, ctx)).toEqual({});
    expect(assignmentEffects("valuer", header, row("Contacted", "", ""), { assigned: "" }, ctx)).toEqual({});
    expect(assignmentEffects("valuer", header, row("Contacted", "", ""), { status: "Lost" }, ctx)).toEqual({});
  });

  it("gives no follow-up to a closed record, or when the same change sets one", () => {
    expect(assignmentEffects("valuer", header, row("Won", "", ""), { assigned: "Parv" }, ctx)).toEqual({ prependNote: "18-11-2026 — Assigned to Parv by Sandeep" });
    expect(assignmentEffects("valuer", header, row("Contacted", "", ""), { assigned: "Parv", status: "Lost" }, ctx)).toEqual({ prependNote: "18-11-2026 — Assigned to Parv by Sandeep" });
    expect(assignmentEffects("valuer", header, row("Contacted", "", ""), { assigned: "Parv", next_step_date: "2026-12-01" }, ctx)).toEqual({ prependNote: "18-11-2026 — Assigned to Parv by Sandeep" });
  });

  it("leaves out the actor when unknown, and skips columns the tab doesn't have", () => {
    expect(assignmentEffects("valuer", header, row("Contacted", "", "2026-11-20"), { assigned: "Parv" }, { by: "", today: ctx.today })).toEqual({ prependNote: "18-11-2026 — Assigned to Parv" });
    const bare = ["name", "registration_no", "status", "assigned"];
    expect(assignmentEffects("valuer", bare, ["Asha", "IBBI/1", "Contacted", ""], { assigned: "Parv" }, ctx)).toEqual({});
  });
});

describe("first contacts", () => {
  const h = [...header, "score_band", "research_notes"];
  const r = (status: string, band: string, research = "") => [...row(status, "", ""), band, research];
  it("gives no date to an A-band record nobody has contacted: Your day already lists it as a first contact", () => {
    expect(assignmentEffects("valuer", h, r("Not contacted", "A"), { assigned: "Parv" }, ctx)).toEqual({ prependNote: "18-11-2026 — Assigned to Parv by Sandeep" });
  });
  it("still dates a B-band one, one already contacted, or one marked do-not-contact", () => {
    expect(assignmentEffects("valuer", h, r("Not contacted", "B"), { assigned: "Parv" }, ctx).next_step_date).toBe("2026-11-19");
    expect(assignmentEffects("valuer", h, r("Contacted", "A"), { assigned: "Parv" }, ctx).next_step_date).toBe("2026-11-19");
    expect(assignmentEffects("valuer", h, r("Not contacted", "A", "DO NOT CONTACT — asked us not to"), { assigned: "Parv" }, ctx).next_step_date).toBe("2026-11-19");
  });
});

describe("withAssignment", () => {
  it("drops an added cell whose column holds a formula, so the owner change still saves", () => {
    expect(withAssignment("valuer", header, row("Contacted", "", ""), { assigned: "Parv" }, ctx, new Set([4, 5]))).toEqual({ assigned: "Parv" });
  });

  it("keeps the caller's own note first and is a no-op without a change context", () => {
    const patch = { assigned: "Parv", prependNote: "first" };
    expect(withAssignment("valuer", header, row("Contacted", "", ""), patch, undefined)).toBe(patch);
    expect(withAssignment("valuer", header, row("Contacted", "", ""), patch, ctx)).toEqual({
      assigned: "Parv",
      next_step_date: "2026-11-19",
      prependNote: "first\n18-11-2026 — Assigned to Parv by Sandeep",
    });
  });
});

describe("a status change on an unowned record", () => {
  it("assigns it to whoever changed the status, with the usual note and follow-up", () => {
    expect(withAssignment("valuer", header, row("Not contacted", "", ""), { status: "Contacted" }, ctx)).toEqual({
      status: "Contacted",
      assigned: "Sandeep",
      prependNote: "18-11-2026 — Assigned to Sandeep by Sandeep",
      next_step_date: "2026-11-19",
    });
  });

  it("keeps a touch's own note line first", () => {
    const out = withAssignment("valuer", header, row("Not contacted", "", ""), { status: "Contacted", prependNote: "18-11-2026 — Call: Connected — Sandeep" }, ctx);
    expect(out.assigned).toBe("Sandeep");
    expect(out.prependNote).toBe("18-11-2026 — Call: Connected — Sandeep\n18-11-2026 — Assigned to Sandeep by Sandeep");
  });

  it("leaves an owned record, an unchanged status, an explicit owner, or an unknown actor alone", () => {
    expect(claimOnStatusChange("valuer", header, row("Not contacted", "Parv", ""), { status: "Contacted" }, ctx)).toBeNull();
    expect(claimOnStatusChange("valuer", header, row("Contacted", "", ""), { status: "contacted" }, ctx)).toBeNull();
    expect(claimOnStatusChange("valuer", header, row("Not contacted", "", ""), { status: "Contacted", assigned: "Parv" }, ctx)).toBeNull();
    expect(claimOnStatusChange("valuer", header, row("Not contacted", "", ""), { status: "Contacted" }, { by: " ", today: ctx.today })).toBeNull();
    expect(claimOnStatusChange("valuer", header, row("Not contacted", "", ""), { city: "Pune" }, ctx)).toBeNull();
  });

  it("doesn't write over a formula in the owner column", () => {
    expect(withAssignment("valuer", header, row("Not contacted", "", ""), { status: "Contacted" }, ctx, new Set([3]))).toEqual({ status: "Contacted" });
  });
});
