import { describe, expect, it } from "vitest";

import { advanceOutreachStatus, impliedOutreachStatus } from "./outreach";

describe("outreach status advances forward only", () => {
  it("an outbound message contacts, an inbound one is a reply, a meeting books or meets", () => {
    expect(impliedOutreachStatus("whatsapp", "out")).toBe("contacted");
    expect(impliedOutreachStatus("email", "in")).toBe("replied");
    expect(impliedOutreachStatus("meeting", "none")).toBe("meeting_booked");
    expect(impliedOutreachStatus("meeting", "none", { held: true })).toBe("met");
    expect(impliedOutreachStatus("note", "none")).toBeNull();
    expect(impliedOutreachStatus("sheet_change", "none")).toBeNull();
  });
  it("never demotes and never reopens a closed person", () => {
    expect(advanceOutreachStatus("not_planned", "contacted")).toBe("contacted");
    expect(advanceOutreachStatus("met", "contacted")).toBeNull();
    expect(advanceOutreachStatus("lost", "replied")).toBeNull();
    expect(advanceOutreachStatus("paying", "meeting_booked")).toBeNull();
    expect(advanceOutreachStatus("garbage", "contacted")).toBe("contacted");
  });
});
