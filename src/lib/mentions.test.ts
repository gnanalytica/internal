import { describe, expect, it } from "vitest";

import {
  extractMentionTokens,
  findMentionedMemberIds,
  isMentionToken,
  mentionKeysForMember,
} from "@/lib/mentions";

const members = [
  { id: "u1", name: "Alex Rivera", email: "alex@acme.com" },
  { id: "u2", name: "Priya Singh", email: "priya.s@acme.com" },
  { id: "u3", name: "Sam", email: "sam@acme.com" },
];

describe("mentionKeysForMember", () => {
  it("derives first-name and email-prefix tokens", () => {
    expect(mentionKeysForMember(members[0])).toEqual(["alex", "alex"]);
    expect(mentionKeysForMember(members[1])).toEqual(["priya", "priya.s"]);
  });
});

describe("extractMentionTokens", () => {
  it("pulls @tokens out of a body", () => {
    expect(extractMentionTokens("hey @alex and @priya.s look")).toEqual([
      "alex",
      "priya.s",
    ]);
  });

  it("returns an empty array when there are no mentions", () => {
    expect(extractMentionTokens("no mentions here")).toEqual([]);
  });
});

describe("findMentionedMemberIds", () => {
  it("resolves first-name mentions", () => {
    expect(findMentionedMemberIds("ping @alex", members)).toEqual(["u1"]);
  });

  it("resolves email-prefix mentions", () => {
    expect(findMentionedMemberIds("ping @priya.s", members)).toEqual(["u2"]);
  });

  it("resolves multiple distinct members", () => {
    expect(findMentionedMemberIds("@alex @sam ship it", members).sort()).toEqual([
      "u1",
      "u3",
    ]);
  });

  it("ignores tokens that match nobody", () => {
    expect(findMentionedMemberIds("@nobody here", members)).toEqual([]);
  });
});

describe("isMentionToken", () => {
  it("is true for a resolvable token", () => {
    expect(isMentionToken("alex", members)).toBe(true);
    expect(isMentionToken("ALEX", members)).toBe(true);
  });

  it("is false for an unknown token", () => {
    expect(isMentionToken("ghost", members)).toBe(false);
  });
});
