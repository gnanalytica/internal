import { describe, expect, it } from "vitest";

import { appHosts, isConfidentialLink, parseAppLink, parseProspectRef, unfurlDetail } from "./links";

const HOSTS = appHosts("https://internal.gnanalytica.com");
const ID = "0f8fad5b-d9cb-469f-a165-70867728950e";
const P = "7c9e6679-7425-40de-944b-e07fc1f90ae7";
const at = (path: string) => parseAppLink(`https://internal.gnanalytica.com${path}`, HOSTS);

describe("parseAppLink", () => {
  it("reads tasks by id or key", () => {
    expect(at(`/issues/${ID}`)).toEqual({ type: "issue", id: ID });
    expect(at(`/issues/${ID.toUpperCase()}`)).toEqual({ type: "issue", id: ID });
    expect(at("/issues/val-12")).toEqual({ type: "issue_key", key: { projectKey: "VAL", number: 12 } });
    expect(at("/issues")).toBeNull();
    expect(at("/issues/whatever")).toBeNull();
  });

  it("reads projects and their tabs", () => {
    expect(at(`/projects/${P}`)).toEqual({ type: "project", id: P, area: null });
    expect(at(`/projects/${P}/engineering?tab=board`)).toEqual({ type: "project", id: P, area: "engineering" });
  });

  it("reads prospects (both URLs) and deals", () => {
    const rec = encodeURIComponent("valuer:IBBI/RV/02/2019/1");
    const prospect = { type: "prospect", ref: "valuer:IBBI/RV/02/2019/1", kind: "valuer", id: "IBBI/RV/02/2019/1" };
    expect(at(`/prospects?rec=${rec}`)).toEqual(prospect);
    expect(at(`/projects/${P}/sales?rec=${rec}`)).toEqual(prospect);
    expect(at(`/projects/${P}/sales?deal=${ID}`)).toEqual({ type: "deal", id: ID });
    expect(at("/prospects?rec=nonsense:1")).toBeNull();
  });

  it("reads doc pages", () => {
    expect(at(`/pages/${ID}`)).toEqual({ type: "page", id: ID });
    expect(at("/pages/not-an-id")).toBeNull();
  });

  it("ignores other hosts, schemes and pages", () => {
    expect(parseAppLink(`https://evil.example/issues/${ID}`, HOSTS)).toBeNull();
    expect(parseAppLink(`ftp://internal.gnanalytica.com/issues/${ID}`, HOSTS)).toBeNull();
    expect(parseAppLink("not a url", HOSTS)).toBeNull();
    expect(at("/settings/slack")).toBeNull();
  });

  it("also accepts the deployment's own host", () => {
    const hosts = appHosts("https://preview-123.vercel.app");
    expect(parseAppLink(`https://preview-123.vercel.app/issues/${ID}`, hosts)).toEqual({ type: "issue", id: ID });
    expect(hosts).toContain("internal.gnanalytica.com");
  });
});

describe("parseProspectRef", () => {
  it("splits on the first colon only", () => {
    expect(parseProspectRef("bank:a:b")).toEqual({ kind: "bank", id: "a:b" });
    expect(parseProspectRef("valuer:")).toBeNull();
    expect(parseProspectRef(":x")).toBeNull();
  });
});

describe("what a preview shows", () => {
  const admin = { linked: true, isAdmin: true } as const;
  const member = { linked: true, isAdmin: false } as const;
  const stranger = { linked: false } as const;

  it("treats Finance and confidential projects as confidential, but not Sales", () => {
    expect(isConfidentialLink({ type: "deal", id: ID }, false)).toBe(false);
    expect(isConfidentialLink({ type: "prospect", ref: "valuer:1", kind: "valuer", id: "1" }, false)).toBe(false);
    expect(isConfidentialLink({ type: "deal", id: ID }, true)).toBe(true);
    expect(isConfidentialLink({ type: "project", id: P, area: "sales" }, false)).toBe(false);
    expect(isConfidentialLink({ type: "project", id: P, area: "finance" }, false)).toBe(true);
    expect(isConfidentialLink({ type: "project", id: P, area: "engineering" }, false)).toBe(false);
    expect(isConfidentialLink({ type: "issue", id: ID }, false)).toBe(false);
    expect(isConfidentialLink({ type: "issue", id: ID }, true)).toBe(true);
  });

  it("gives strangers the title only", () => {
    expect(unfurlDetail(stranger, false)).toBe("title");
    expect(unfurlDetail(stranger, true)).toBe("title");
  });

  it("gives members everything but confidential records", () => {
    expect(unfurlDetail(member, false)).toBe("full");
    expect(unfurlDetail(member, true)).toBe("title");
  });

  it("gives admins everything", () => {
    expect(unfurlDetail(admin, true)).toBe("full");
  });
});
