import { describe, expect, it } from "vitest";

import { ApiInputError } from "./errors";
import { apiKeyDto, cleanKeyName, integrationsDto, parseActive, signInMethods } from "./settings-rules";

describe("API key list shape", () => {
  const row = {
    id: "k1",
    name: "Zapier",
    keyPrefix: "int_abcdefgh",
    kind: "key",
    createdBy: "u1",
    createdByName: "Asha",
    lastUsedAt: new Date("2026-09-01T00:00:00Z"),
    createdAt: new Date("2026-08-01T00:00:00Z"),
    keyHash: "never-returned",
  };

  it("never carries the hash, and names who made it", () => {
    const dto = apiKeyDto(row, "other");
    expect(JSON.stringify(dto)).not.toContain("never-returned");
    expect(dto).toEqual({
      id: "k1",
      name: "Zapier",
      prefix: "int_abcdefgh",
      kind: "key",
      createdBy: { id: "u1", name: "Asha" },
      lastUsedAt: "2026-09-01T00:00:00.000Z",
      createdAt: "2026-08-01T00:00:00.000Z",
      current: false,
    });
  });

  it("marks the key making the request", () => {
    expect(apiKeyDto({ ...row, lastUsedAt: null, createdBy: null }, "k1")).toMatchObject({ current: true, lastUsedAt: null, createdBy: null });
  });

  it("names keys like the web does", () => {
    expect(cleanKeyName("  Zapier  ")).toBe("Zapier");
    expect(cleanKeyName("")).toBe("API key");
    expect(cleanKeyName(undefined)).toBe("API key");
    expect(cleanKeyName("x".repeat(80))).toHaveLength(60);
  });
});

describe("webhook toggle", () => {
  it("needs a real boolean", () => {
    expect(parseActive({ active: false })).toBe(false);
    expect(() => parseActive({ active: "false" })).toThrow(ApiInputError);
    expect(() => parseActive({})).toThrow(ApiInputError);
  });
});

describe("integrations and sign-in methods", () => {
  it("reports connection without secrets", () => {
    const dto = integrationsDto({ githubRepo: "acme/app", githubToken: "ghp_secret", slackWebhookUrl: "https://hooks.slack.com/x" });
    expect(dto).toEqual({ github: { connected: true, repo: "acme/app" }, slack: { connected: true } });
    expect(JSON.stringify(dto)).not.toMatch(/ghp_secret|hooks\.slack/);
  });
  it("treats a repo without a token as not connected", () => {
    expect(integrationsDto({ githubRepo: "acme/app", githubToken: null, slackWebhookUrl: null })).toEqual({
      github: { connected: false, repo: null },
      slack: { connected: false },
    });
  });
  it("lists every method, marking the connected ones", () => {
    expect(signInMethods(["google", "credential", "unknown"])).toEqual([
      { id: "google", label: "Google", connected: true },
      { id: "github", label: "GitHub", connected: false },
      { id: "credential", label: "Email & password", connected: true },
    ]);
  });
});
