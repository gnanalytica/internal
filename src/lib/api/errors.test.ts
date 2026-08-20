import { describe, expect, it } from "vitest";

import { ApiInputError, isUniqueViolation } from "./errors";

describe("ApiInputError", () => {
  it("defaults to 400 and carries a caller-safe message", () => {
    const err = new ApiInputError("`title` is required.");
    expect(err.status).toBe(400);
    expect(err.message).toBe("`title` is required.");
    expect(err).toBeInstanceOf(Error);
  });

  it("can carry another 4xx", () => {
    expect(new ApiInputError("Issue not found.", 404).status).toBe(404);
  });
});

describe("isUniqueViolation", () => {
  it("detects a top-level SQLSTATE 23505", () => {
    expect(isUniqueViolation(Object.assign(new Error("dup"), { code: "23505" }))).toBe(true);
  });

  it("detects a driver error wrapped one level down", () => {
    const err = Object.assign(new Error("insert failed"), {
      cause: { code: "23505" },
    });
    expect(isUniqueViolation(err)).toBe(true);
  });

  it("ignores other Postgres errors, so they surface as real failures", () => {
    expect(isUniqueViolation(Object.assign(new Error("fk"), { code: "23503" }))).toBe(false);
    expect(isUniqueViolation(new Error("connection reset"))).toBe(false);
  });

  it("is safe on non-errors", () => {
    expect(isUniqueViolation(null)).toBe(false);
    expect(isUniqueViolation(undefined)).toBe(false);
    expect(isUniqueViolation("23505")).toBe(false);
  });
});
