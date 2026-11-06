import { describe, expect, it } from "vitest";

import { canSendTouch, feedbackHref, requestQuote, sentByRef, ticketSourceRef, touchContact, touchKey, touchSource, touchSourceRef } from "./send-to-product";

const touch = (p: Partial<{ id: string; date: string | null; loggedAt: string; summary: string }> = {}) => ({ id: "A12", date: "2026-11-02", loggedAt: "02-11-2026 10:15", summary: "The SBI format takes longest.", ...p });

describe("where a remark came from", () => {
  it("is a prospect until Pilot running, then a customer", () => {
    expect(touchSource(0)).toBe("sales");
    expect(touchSource(3)).toBe("sales"); // Demo done
    expect(touchSource(4)).toBe("customer"); // Pilot running
    expect(touchSource(5)).toBe("customer"); // Won
    expect(touchSource(6)).toBe("sales"); // Lost
  });
  it("names who said it with their stage", () => {
    expect(touchContact(" Mr. Sachin Goel ", 4)).toBe("Mr. Sachin Goel · Pilot running");
    expect(touchContact("", 1)).toBe("Contacted");
  });
  it("sends only touches where they said something", () => {
    expect(canSendTouch(touch())).toBe(true);
    expect(canSendTouch(touch({ summary: "  " }))).toBe(false);
  });
  it("reads a request's body, or its subject when it has none", () => {
    expect(requestQuote({ subject: "Export to Word", body: " Can I get it as .docx? " })).toBe("Can I get it as .docx?");
    expect(requestQuote({ subject: "Export to Word", body: null })).toBe("Export to Word");
  });
});

describe("source refs", () => {
  it("keys a touch by its activity id", () => {
    expect(touchSourceRef("valuer", "IBBI/RV/02/2019/1", touch())).toBe("touch:valuer:IBBI/RV/02/2019/1:A12");
    expect(ticketSourceRef("t-1")).toBe("ticket:t-1");
  });
  it("keys a touch without an id by its date and words, the same however the list is sorted", () => {
    const a = touch({ id: "" });
    expect(touchKey(a)).toBe(touchKey({ ...a }));
    expect(touchKey(a)).toMatch(/^2026-11-02~[0-9a-z]+$/);
    expect(touchKey(a)).not.toBe(touchKey(touch({ id: "", summary: "Something else." })));
    expect(touchKey(touch({ id: "", date: null }))).toMatch(/^02-11-2026 10:15~/);
  });
  it("looks up what was already sent, first item winning", () => {
    expect(
      sentByRef([
        { id: "f1", sourceRef: "ticket:t-1" },
        { id: "f2", sourceRef: null },
        { id: "f3", sourceRef: "ticket:t-1" },
        { id: "f4", sourceRef: "touch:valuer:X:A1" },
      ]),
    ).toEqual({ "ticket:t-1": "f1", "touch:valuer:X:A1": "f4" });
  });
  it("links to the project's Feedback tab", () => {
    expect(feedbackHref("p1")).toBe("/projects/p1/product?tab=feedback");
  });
});
