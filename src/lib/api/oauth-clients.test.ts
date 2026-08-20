import { describe, expect, it } from "vitest";

import {
  findClient,
  redirectUriAllowed,
  registeredClients,
  secretMatches,
} from "./oauth-clients";

const ENV = {
  OAUTH_CLIENT_STANDUP_ID: "standup-ai",
  OAUTH_CLIENT_STANDUP_SECRET: "s3cret-value",
  OAUTH_CLIENT_STANDUP_REDIRECT_URIS:
    "https://standup.gnanalytica.com/api/integrations/internal/callback",
} as unknown as NodeJS.ProcessEnv;

describe("registeredClients", () => {
  it("is empty until fully configured", () => {
    expect(registeredClients({} as NodeJS.ProcessEnv)).toEqual([]);
    // A partial config must NOT half-open the flow.
    expect(
      registeredClients({ OAUTH_CLIENT_STANDUP_ID: "x" } as unknown as NodeJS.ProcessEnv),
    ).toEqual([]);
    expect(
      registeredClients({
        OAUTH_CLIENT_STANDUP_ID: "x",
        OAUTH_CLIENT_STANDUP_SECRET: "y",
      } as unknown as NodeJS.ProcessEnv),
    ).toEqual([]);
  });

  it("parses a comma-separated redirect list", () => {
    const [c] = registeredClients({
      ...ENV,
      OAUTH_CLIENT_STANDUP_REDIRECT_URIS: "https://a.test/cb , https://b.test/cb",
    } as unknown as NodeJS.ProcessEnv);
    expect(c.redirectUris).toEqual(["https://a.test/cb", "https://b.test/cb"]);
  });
});

describe("findClient", () => {
  it("matches only the exact configured id", () => {
    expect(findClient("standup-ai", ENV)?.name).toBe("Standup AI");
    expect(findClient("standup-a", ENV)).toBeNull();
    expect(findClient("standup-ai ", ENV)?.id).toBe("standup-ai"); // trimmed
    expect(findClient("", ENV)).toBeNull();
    expect(findClient(null, ENV)).toBeNull();
  });
});

describe("redirectUriAllowed", () => {
  const client = registeredClients(ENV)[0];

  it("accepts the registered callback", () => {
    expect(
      redirectUriAllowed(
        client,
        "https://standup.gnanalytica.com/api/integrations/internal/callback",
      ),
    ).toBe(true);
  });

  it("rejects a lookalike host that a prefix check would allow", () => {
    // This is the attack the exact match exists to stop: `startsWith` on the
    // registered origin would happily match an attacker-controlled suffix
    // domain and hand them the authorization code.
    expect(
      redirectUriAllowed(
        client,
        "https://standup.gnanalytica.com.evil.test/api/integrations/internal/callback",
      ),
    ).toBe(false);
  });

  it("rejects extra path, query or a different scheme", () => {
    expect(
      redirectUriAllowed(
        client,
        "https://standup.gnanalytica.com/api/integrations/internal/callback/../../evil",
      ),
    ).toBe(false);
    expect(
      redirectUriAllowed(
        client,
        "https://standup.gnanalytica.com/api/integrations/internal/callback?next=//evil.test",
      ),
    ).toBe(false);
    expect(
      redirectUriAllowed(
        client,
        "http://standup.gnanalytica.com/api/integrations/internal/callback",
      ),
    ).toBe(false);
  });
});

describe("secretMatches", () => {
  it("accepts the exact secret and nothing else", () => {
    expect(secretMatches("s3cret-value", "s3cret-value")).toBe(true);
    expect(secretMatches("s3cret-value", "s3cret-valuE")).toBe(false);
    expect(secretMatches("s3cret-value", "s3cret-valu")).toBe(false);
    expect(secretMatches("s3cret-value", "")).toBe(false);
  });

  it("does not throw on a length mismatch", () => {
    // timingSafeEqual throws on unequal lengths; the guard must catch that
    // rather than turning a wrong password into a 500.
    expect(() => secretMatches("short", "a-much-longer-secret")).not.toThrow();
    expect(secretMatches("short", "a-much-longer-secret")).toBe(false);
  });
});
