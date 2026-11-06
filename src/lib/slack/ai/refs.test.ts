import { describe, expect, it } from "vitest";

import { matchLabels, matchMember, matchProject, parseTaskRef } from "./refs";

const ID = "3f2b8c1e-1d2a-4c3b-9e8f-0a1b2c3d4e5f";

describe("parseTaskRef", () => {
  it("reads keys the way people write them", () => {
    expect(parseTaskRef("VAL-12")).toEqual({ kind: "key", projectKey: "VAL", number: 12 });
    expect(parseTaskRef("val 12")).toEqual({ kind: "key", projectKey: "VAL", number: 12 });
    expect(parseTaskRef("ENG12")).toEqual({ kind: "key", projectKey: "ENG", number: 12 });
    expect(parseTaskRef("#7")).toEqual({ kind: "key", projectKey: null, number: 7 });
  });

  it("reads ids, app links and Slack-wrapped links", () => {
    expect(parseTaskRef(ID.toUpperCase())).toEqual({ kind: "id", id: ID });
    expect(parseTaskRef(`https://internal.gnanalytica.com/issues/${ID}`)).toEqual({ kind: "id", id: ID });
    expect(parseTaskRef(`<https://internal.gnanalytica.com/issues/${ID}|VAL-3>`)).toEqual({ kind: "id", id: ID });
  });

  it("refuses anything else", () => {
    expect(parseTaskRef("the login bug")).toBeNull();
    expect(parseTaskRef("")).toBeNull();
  });
});

const members = [
  { id: "1", name: "Priya Sharma", email: "priya@gnanalytica.com" },
  { id: "2", name: "Priya Rao", email: "prao@gnanalytica.com" },
  { id: "3", name: "Sandeep Polavarapu", email: "sandeep@gnanalytica.com" },
];

describe("matchMember", () => {
  it('resolves "me" to the caller, or says they must link first', () => {
    expect(matchMember(members, "me", "3")).toEqual({ ok: true, value: members[2] });
    expect(matchMember(members, "me", null)).toMatchObject({ ok: false, error: expect.stringContaining("link") });
  });

  it("prefers an exact name or email over a partial match", () => {
    expect(matchMember(members, "Priya Rao", null)).toEqual({ ok: true, value: members[1] });
    expect(matchMember(members, "@sandeep", null)).toEqual({ ok: true, value: members[2] });
    expect(matchMember(members, "prao@gnanalytica.com", null)).toEqual({ ok: true, value: members[1] });
    expect(matchMember(members, "polava", null)).toEqual({ ok: true, value: members[2] });
  });

  it("asks rather than guesses when two people match", () => {
    expect(matchMember(members, "priya", null)).toMatchObject({ ok: false, error: expect.stringContaining("Priya Sharma, Priya Rao") });
  });

  it("says when nobody matches", () => {
    expect(matchMember(members, "Ravi", null)).toMatchObject({ ok: false, error: expect.stringContaining("Nobody") });
  });
});

describe("matchProject", () => {
  const projects = [
    { id: "a", key: "VAL", name: "Valytica" },
    { id: "b", key: "REA", name: "Realytica" },
  ];

  it("takes a key or a name, case-insensitively", () => {
    expect(matchProject(projects, "val")).toEqual({ ok: true, value: projects[0] });
    expect(matchProject(projects, "Realytica")).toEqual({ ok: true, value: projects[1] });
  });

  it("lists the choices when ambiguous or unknown", () => {
    expect(matchProject(projects, "lytica")).toMatchObject({ ok: false, error: expect.stringContaining("Valytica (VAL), Realytica (REA)") });
    expect(matchProject(projects, "Propalance")).toMatchObject({ ok: false, error: expect.stringContaining("Projects:") });
  });
});

describe("matchLabels", () => {
  const labels = [
    { id: "l1", name: "Bug" },
    { id: "l2", name: "Customer" },
  ];

  it("maps names to ids, once each", () => {
    expect(matchLabels(labels, ["bug", "Customer", "BUG"])).toEqual({ ok: true, value: ["l1", "l2"] });
  });

  it("names the labels that don't exist instead of dropping them", () => {
    expect(matchLabels(labels, ["bug", "urgent"])).toMatchObject({ ok: false, error: expect.stringContaining('"urgent"') });
  });
});
