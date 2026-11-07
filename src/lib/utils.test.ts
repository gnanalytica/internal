import { describe, expect, it } from "vitest";

import { cn } from "@/lib/utils";

describe("cn", () => {
  it("keeps the app's own type sizes beside a text colour", () => {
    expect(cn("text-ui", "text-muted-foreground")).toBe("text-ui text-muted-foreground");
    expect(cn("text-2xs text-brand")).toBe("text-2xs text-brand");
  });

  it("still lets a later size win over an earlier one", () => {
    expect(cn("text-sm", "text-ui")).toBe("text-ui");
    expect(cn("text-ui", "text-xs")).toBe("text-xs");
  });
});
