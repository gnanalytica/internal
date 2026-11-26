import { describe, expect, it } from "vitest";

import { memberFor, planPings } from "./pings";

const members = [
  { id: "u-sandeep", name: "Sandeep Polavarapu", email: "s@x.in" },
  { id: "u-parv", name: "Parv Pathak", email: "p@x.in" },
  { id: "u-tas", name: "Tasleem", email: "t@x.in" },
];
const row = (name: string, assigned = "", city = "Hyderabad") => ({ name, assigned, city });
const actor = { userId: "u-sandeep", name: "Sandeep Polavarapu" };

describe("planPings", () => {
  it("pings the new owner of one record, with a link to it", () => {
    expect(planPings("valuer", [{ id: "IBBI/1", before: row("Asha"), owner: "Parv" }], members, actor)).toEqual([
      { userId: "u-parv", title: "Sandeep assigned you Asha", body: "Registered valuer · Hyderabad", href: "/prospects?rec=valuer%3AIBBI%2F1" },
    ]);
  });

  it("sends one ping per owner for a batch", () => {
    const changes = ["A", "B", "C", "D"].map((n, i) => ({ id: `IBBI/${i}`, before: row(n), owner: "Parv" }));
    const [p, ...rest] = planPings("valuer", changes, members, actor);
    expect(rest).toEqual([]);
    expect(p).toEqual({ userId: "u-parv", title: "Sandeep assigned you 4 valuers", body: "A, B, C and 1 more", href: "/prospects?tab=list&owner=me" });
  });

  it("skips taking it yourself, unassigning, no real change, and names that match nobody or several", () => {
    expect(planPings("valuer", [{ id: "1", before: row("A"), owner: "Sandeep" }], members, actor)).toEqual([]);
    expect(planPings("valuer", [{ id: "1", before: row("A", "Parv"), owner: "" }], members, actor)).toEqual([]);
    expect(planPings("valuer", [{ id: "1", before: row("A", "Parv Pathak"), owner: "parv" }], members, actor)).toEqual([]);
    expect(planPings("valuer", [{ id: "1", before: row("A"), owner: "Ravi" }], members, actor)).toEqual([]);
    expect(memberFor("Parv", [...members, { id: "u-p2", name: "Parv Shah", email: null }])).toBeNull();
  });

  it("names a bank contact by institution when it has no name", () => {
    const before = { name: "", institution: "SBI", contact_person: "R. Rao", assigned: "" };
    expect(planPings("bank", [{ id: "B-1", before, owner: "Tasleem" }], members, actor)[0].title).toBe("Sandeep assigned you SBI · R. Rao");
  });
});
