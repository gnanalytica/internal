import { describe, expect, it } from "vitest";

import { featureProgress } from "./feature-progress";

describe("featureProgress", () => {
  it("counts done vs total and a percentage", () => {
    expect(featureProgress([{ status: "done" }, { status: "backlog" }])).toEqual({
      done: 1,
      total: 2,
      pct: 50,
    });
  });
  it("treats canceled as neither done nor counted toward total", () => {
    expect(featureProgress([{ status: "done" }, { status: "canceled" }])).toEqual({
      done: 1,
      total: 1,
      pct: 100,
    });
  });
  it("is zero for no issues", () => {
    expect(featureProgress([])).toEqual({ done: 0, total: 0, pct: 0 });
  });
});
