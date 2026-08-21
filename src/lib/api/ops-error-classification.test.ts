import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import { ApiInputError } from "./errors";

/**
 * Caller-fixable validation must reach the caller.
 *
 * `withApiAuth` reflects an `ApiInputError` (message + status) and turns
 * anything else into a generic 500 — deliberately, so constraint text and
 * connection detail never leak. But `ops.ts` threw plain `Error` for every
 * validation, so messages written FOR the caller ("`body` is required.",
 * "`endDate` must be on or after `startDate`.") were replaced by:
 *
 *     500 {"error":"Internal error."}
 *
 * Standup AI hit this filing an action item whose deadline was the spoken word
 * "tomorrow": `toDate` threw "Expected an ISO date.", the caller got an opaque
 * 500, and Standup surfaced it as a bare 502 on Approve. Diagnosing it needed a
 * Vercel log dive for a message the API already knew and could have returned.
 */

vi.mock("./auth", () => ({
  authenticateApiKey: async () => ({ workspaceId: "ws-1", memberId: "m-1" }),
}));

const OPS = readFileSync(join(__dirname, "ops.ts"), "utf8");

describe("withApiAuth error mapping", () => {
  it("reflects an ApiInputError's message and status", async () => {
    const { withApiAuth } = await import("./http");
    const handler = withApiAuth(async () => {
      throw new ApiInputError("Expected an ISO date.");
    });
    const res = await handler(new Request("https://x/api/v1/issues", { method: "POST" }),
                              { params: Promise.resolve({}) });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Expected an ISO date." });
  });

  it("still hides a genuine server fault behind a generic 500", async () => {
    const { withApiAuth } = await import("./http");
    const handler = withApiAuth(async () => {
      throw new Error('duplicate key value violates unique constraint "issues_pkey"');
    });
    const res = await handler(new Request("https://x/api/v1/issues", { method: "POST" }),
                              { params: Promise.resolve({}) });
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Internal error." });
  });
});

describe("ops.ts classifies its own validation", () => {
  it("throws ApiInputError for the bad-date case that caused the 502", () => {
    expect(OPS).toContain('throw new ApiInputError("Expected an ISO date.")');
  });

  it("has no plain Error carrying a caller-facing message", () => {
    /* A message naming a request field, or telling the caller what to send, is
     * by definition caller-fixable — it must not become a 500. */
    const offenders = OPS.split("\n")
      .map((line, i) => [i + 1, line] as const)
      .filter(([, line]) => line.includes("throw new Error("))
      .filter(([, line]) =>
        /`\w+`/.test(line) || /is required|must be one of|must be|not in this workspace|not found/i.test(line),
      )
      .map(([n, line]) => `${n}: ${line.trim()}`);

    expect(offenders, "these are caller-fixable and must throw ApiInputError").toEqual([]);
  });

  it("keeps a true server fault as a plain Error", () => {
    /* Not everything is the caller's fault: an insert that returns no row is
     * our bug, and must stay a 500 rather than blaming the request. */
    expect(OPS).toContain('throw new Error("Issue insert produced no row.")');
  });
});
