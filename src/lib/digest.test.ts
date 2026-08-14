import { describe, expect, it } from "vitest";

import {
  buildDigest,
  digestSubject,
  digestText,
  type DigestNotification,
} from "@/lib/digest";

function n(
  partial: Partial<Omit<DigestNotification, "createdAt">> & { createdAt: string },
): DigestNotification {
  return {
    type: "commented",
    title: "Someone commented",
    body: null,
    issueId: null,
    pageId: null,
    ...partial,
    createdAt: new Date(partial.createdAt),
  };
}

describe("buildDigest", () => {
  it("collapses several events on one target into a single group", () => {
    const d = buildDigest([
      n({ issueId: "i1", title: "Alex commented on Ship it", createdAt: "2026-08-01T09:00:00Z" }),
      n({ issueId: "i1", title: "Sam commented on Ship it", createdAt: "2026-08-01T10:00:00Z" }),
      n({ issueId: "i1", title: "Jay commented on Ship it", createdAt: "2026-08-01T11:00:00Z" }),
    ]);
    expect(d.groups).toHaveLength(1);
    expect(d.groups[0].count).toBe(3);
    expect(d.total).toBe(3);
    // The newest event is the headline.
    expect(d.groups[0].title).toBe("Jay commented on Ship it");
  });

  it("floats things that name you above things you merely follow", () => {
    const d = buildDigest([
      n({ issueId: "i1", title: "watched", createdAt: "2026-08-01T12:00:00Z" }),
      n({ issueId: "i2", type: "assigned", title: "yours", createdAt: "2026-08-01T08:00:00Z" }),
    ]);
    // "yours" is older but personal, so it leads.
    expect(d.groups.map((g) => g.title)).toEqual(["yours", "watched"]);
    expect(d.personalCount).toBe(1);
  });

  it("marks a group personal when any one event in it names you", () => {
    const d = buildDigest([
      n({ issueId: "i1", title: "a comment", createdAt: "2026-08-01T09:00:00Z" }),
      n({ issueId: "i1", type: "mentioned", title: "a mention", createdAt: "2026-08-01T10:00:00Z" }),
    ]);
    expect(d.groups).toHaveLength(1);
    expect(d.groups[0].personal).toBe(true);
  });

  it("keeps issues and pages apart, and links each correctly", () => {
    const d = buildDigest([
      n({ issueId: "x", title: "task", createdAt: "2026-08-01T09:00:00Z" }),
      n({ pageId: "x", title: "doc", createdAt: "2026-08-01T10:00:00Z" }),
    ]);
    expect(d.groups).toHaveLength(2);
    expect(d.groups.map((g) => g.href).sort()).toEqual(["/issues/x", "/pages/x"]);
  });

  it("does not merge targetless events into one meaningless group", () => {
    const d = buildDigest([
      n({ title: "one", createdAt: "2026-08-01T09:00:00Z" }),
      n({ title: "two", createdAt: "2026-08-01T10:00:00Z" }),
    ]);
    expect(d.groups).toHaveLength(2);
    expect(d.groups.every((g) => g.href === null)).toBe(true);
  });

  it("returns an empty digest for no notifications", () => {
    const d = buildDigest([]);
    expect(d).toEqual({ groups: [], total: 0, personalCount: 0 });
  });
});

describe("digestSubject", () => {
  it("says how much is yours when any of it is", () => {
    const d = buildDigest([
      n({ issueId: "i1", type: "assigned", title: "yours", createdAt: "2026-08-01T09:00:00Z" }),
      n({ issueId: "i2", title: "watched", createdAt: "2026-08-01T10:00:00Z" }),
    ]);
    expect(digestSubject(d, "Acme")).toBe("Acme: 2 updates, 1 for you");
  });

  it("omits the personal count when nothing names you, and singularises", () => {
    const d = buildDigest([n({ issueId: "i1", title: "watched", createdAt: "2026-08-01T09:00:00Z" })]);
    expect(digestSubject(d, "Acme")).toBe("Acme: 1 update");
  });
});

describe("digestText", () => {
  it("marks personal lines and includes absolute links", () => {
    const d = buildDigest([
      n({ issueId: "i1", type: "assigned", title: "yours", createdAt: "2026-08-01T09:00:00Z" }),
      n({ issueId: "i2", title: "watched", createdAt: "2026-08-01T10:00:00Z" }),
      n({ issueId: "i2", title: "watched again", createdAt: "2026-08-01T11:00:00Z" }),
    ]);
    const text = digestText(d, "https://internal.example.com");
    expect(text).toContain("* yours");
    expect(text).toContain("https://internal.example.com/issues/i1");
    expect(text).toContain("(2 updates)");
  });
});
