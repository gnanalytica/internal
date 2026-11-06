import { describe, expect, it } from "vitest";

import {
  aiConversationKey,
  commentFromWebhook,
  inboundVerdict,
  isAiParticipant,
  isDoneReaction,
  mirrorTargets,
  mirrorText,
  viaSlackLabel,
} from "./sync-rules";

const reply = { isMe: false, isBot: false, isMention: false, text: "on it", ts: "2.0", threadTs: "1.0" };

describe("inboundVerdict (the Slack → app loop guard)", () => {
  it("syncs a person's reply in a thread", () => {
    expect(inboundVerdict(reply)).toBe("sync");
  });

  it("never reads back the bot's own posts or other bots", () => {
    expect(inboundVerdict({ ...reply, isMe: true })).toBe("self");
    expect(inboundVerdict({ ...reply, isBot: true })).toBe("bot");
  });

  it("skips follow-ups to the AI bot from people in its conversation", () => {
    expect(inboundVerdict({ ...reply, inAiConversation: true })).toBe("ai_followup");
    expect(aiConversationKey("slack:C1:1.0")).toBe("ai:conv:slack:C1:1.0");
    expect(isAiParticipant({ participants: ["U1"], startedAt: 1 }, "U1")).toBe(true);
    expect(isAiParticipant({ participants: ["U1"], startedAt: 1 }, "U2")).toBe(false);
    expect(isAiParticipant(null, "U1")).toBe(false);
    expect(isAiParticipant({ participants: "U1" }, "U1")).toBe(false);
  });

  it("skips thread roots, talk to the bot, and empty messages", () => {
    expect(inboundVerdict({ ...reply, ts: "1.0" })).toBe("root");
    expect(inboundVerdict({ ...reply, threadTs: "" })).toBe("root");
    expect(inboundVerdict({ ...reply, isMention: true })).toBe("mention");
    expect(inboundVerdict({ ...reply, text: "  " })).toBe("empty");
  });
});

describe("mirrorTargets (the app → Slack loop guard)", () => {
  const t0 = new Date("2026-11-01T10:00:00Z");
  const later = new Date("2026-11-01T10:05:00Z");
  const threads = [
    { channel: "C1", ts: "1.0", createdAt: t0 },
    { channel: "C2", ts: "5.0", createdAt: t0 },
    { channel: "C3", ts: "9.0", createdAt: later },
  ];
  const commentAt = new Date("2026-11-01T10:01:00Z");

  it("posts a web comment into every thread that existed when it was written", () => {
    expect(mirrorTargets(threads, null, commentAt).map((t) => t.channel)).toEqual(["C1", "C2"]);
  });

  it("doesn't echo a Slack comment into the thread it came from", () => {
    expect(mirrorTargets(threads, { channel: "C1", threadTs: "1.0" }, commentAt).map((t) => t.channel)).toEqual(["C2"]);
  });

  it("matches the origin on channel and thread together", () => {
    expect(mirrorTargets(threads, { channel: "C1", threadTs: "5.0" }, commentAt).map((t) => t.channel)).toEqual(["C1", "C2"]);
  });
});

describe("text", () => {
  it("names the author and escapes the body", () => {
    expect(mirrorText("Priya", "ship it <!channel>")).toBe("*Priya*: ship it &lt;!channel&gt;");
    expect(mirrorText(null, "hi")).toBe("Someone: hi");
  });

  it("labels unlinked Slack authors", () => {
    expect(viaSlackLabel("Priya")).toBe("Priya via Slack");
    expect(viaSlackLabel(null)).toBe("Someone via Slack");
  });
});

describe("commentFromWebhook", () => {
  it("reads issue.commented payloads from the web and the API", () => {
    expect(commentFromWebhook("issue.commented", { issueId: "i", body: "x" })).toEqual({ issueId: "i", commentId: null, body: "x" });
    expect(commentFromWebhook("issue.commented", { issueId: "i", commentId: "c", body: "x" })).toEqual({ issueId: "i", commentId: "c", body: "x" });
  });

  it("ignores everything else", () => {
    expect(commentFromWebhook("issue.updated", { issueId: "i" })).toBeNull();
    expect(commentFromWebhook("issue.commented", {})).toBeNull();
    expect(commentFromWebhook("issue.commented", null)).toBeNull();
  });
});

describe("isDoneReaction", () => {
  it("accepts check marks, with or without a skin tone", () => {
    expect(isDoneReaction("white_check_mark")).toBe(true);
    expect(isDoneReaction("heavy_check_mark::skin-tone-3")).toBe(true);
    expect(isDoneReaction(":white_check_mark:")).toBe(true);
    expect(isDoneReaction("thumbsup")).toBe(false);
  });
});
