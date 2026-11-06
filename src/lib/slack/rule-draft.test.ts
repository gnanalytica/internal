import { describe, expect, it } from "vitest";

import { draftFromPreset, draftFromRule, draftProblem, emptyDraft, toggleEvent, type RuleDraft } from "./rule-draft";

const channels = [
  { id: "C1", name: "engineering" },
  { id: "C2", name: "product-and-business" },
];
const projects = [{ id: "p-val", key: "VAL" }];

describe("presets", () => {
  it("resolves the engineering preset to its channel and Valytica", () => {
    expect(draftFromPreset("engineering", channels, projects)).toEqual({
      channelId: "C1",
      projectId: "p-val",
      events: ["issue.created", "issue.status_changed", "issue.assigned", "issue.commented"],
      minProspectStage: null,
    });
  });

  it("keeps prospects from Demo done on for #product-and-business", () => {
    const d = draftFromPreset("product-and-business", channels, projects)!;
    expect(d.channelId).toBe("C2");
    expect(d.projectId).toBeNull();
    expect(d.minProspectStage).toBe("Demo done");
    expect(d.events).toContain("prospect.stage_changed");
  });

  it("leaves the channel to pick, and the project open, when they don't exist", () => {
    const d = draftFromPreset("engineering", [], [])!;
    expect(d.channelId).toBe("");
    expect(d.projectId).toBeNull();
    expect(draftFromPreset("nope", channels, projects)).toBeNull();
  });
});

describe("editing", () => {
  it("loads a saved rule, dropping events this build doesn't know", () => {
    expect(
      draftFromRule({ id: "r", slackChannelId: "C1", projectId: null, events: ["deal.won", "deal.lost"], filters: null }),
    ).toEqual({ id: "r", channelId: "C1", projectId: null, events: ["deal.won"], minProspectStage: null });
  });

  it("drops the stage filter with the prospect event", () => {
    let d: RuleDraft = { ...emptyDraft(), events: ["prospect.stage_changed"], minProspectStage: "Won" };
    d = toggleEvent(d, "deal.won");
    expect(d.minProspectStage).toBe("Won");
    d = toggleEvent(d, "prospect.stage_changed");
    expect(d.events).toEqual(["deal.won"]);
    expect(d.minProspectStage).toBeNull();
  });

  it("explains what's missing", () => {
    expect(draftProblem(emptyDraft())).toBe("Pick a channel.");
    expect(draftProblem({ ...emptyDraft(), channelId: "C1" })).toBe("Pick at least one event.");
    expect(draftProblem({ ...emptyDraft(), channelId: "C1", events: ["deal.won"] })).toBeNull();
  });
});
