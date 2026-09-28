import { describe, expect, it } from "vitest";

import crypto from "node:crypto";

import {
  findClient,
  isValidCodeChallenge,
  MOBILE_CLIENT_ID,
  MOBILE_REDIRECT_URI,
  pkceMatches,
  redirectUriAllowed,
  registeredClients,
  secretMatches,
} from "./oauth-clients";

const confidential = (env: NodeJS.ProcessEnv) => registeredClients(env).filter((c) => c.type === "confidential");

const ENV = {
  OAUTH_CLIENT_STANDUP_ID: "standup-ai",
  OAUTH_CLIENT_STANDUP_SECRET: "s3cret-value",
  OAUTH_CLIENT_STANDUP_REDIRECT_URIS:
    "https://standup.gnanalytica.com/api/integrations/internal/callback",
} as unknown as NodeJS.ProcessEnv;

describe("registeredClients", () => {
  it("is empty until fully configured", () => {
    expect(confidential({} as NodeJS.ProcessEnv)).toEqual([]);
    // A partial config must NOT half-open the flow.
    expect(
      confidential({ OAUTH_CLIENT_STANDUP_ID: "x" } as unknown as NodeJS.ProcessEnv),
    ).toEqual([]);
    expect(
      confidential({
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
  const client = confidential(ENV)[0];

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

describe("mobile app client", () => {
  const verifier = crypto.randomBytes(48).toString("base64url");
  const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");

  it("is always registered, public, and only returns to the app scheme", () => {
    const c = findClient(MOBILE_CLIENT_ID, {} as NodeJS.ProcessEnv)!;
    expect(c.type).toBe("public");
    expect(c.secret).toBe("");
    expect(redirectUriAllowed(c, MOBILE_REDIRECT_URI)).toBe(true);
    expect(redirectUriAllowed(c, "internal://oauth/../evil")).toBe(false);
    expect(redirectUriAllowed(c, "https://evil.test/oauth")).toBe(false);
  });
  it("accepts extra development callbacks only when configured", () => {
    const env = { OAUTH_MOBILE_DEV_REDIRECT_URIS: "exp://192.168.1.4:8081/--/oauth" } as unknown as NodeJS.ProcessEnv;
    expect(redirectUriAllowed(findClient(MOBILE_CLIENT_ID, env)!, "exp://192.168.1.4:8081/--/oauth")).toBe(true);
    expect(redirectUriAllowed(findClient(MOBILE_CLIENT_ID, {} as NodeJS.ProcessEnv)!, "exp://192.168.1.4:8081/--/oauth")).toBe(false);
  });
  it("requires an S256 challenge of the right shape", () => {
    expect(isValidCodeChallenge(challenge, "S256")).toBe(true);
    expect(isValidCodeChallenge(challenge, "plain")).toBe(false);
    expect(isValidCodeChallenge("short", "S256")).toBe(false);
    expect(isValidCodeChallenge("", "")).toBe(false);
  });
  it("matches the verifier to its challenge and nothing else", () => {
    expect(pkceMatches(challenge, verifier)).toBe(true);
    expect(pkceMatches(challenge, verifier + "x")).toBe(false);
    expect(pkceMatches(challenge, "")).toBe(false);
    expect(pkceMatches(null, verifier)).toBe(false);
    // A leaked challenge is not a verifier.
    expect(pkceMatches(challenge, challenge)).toBe(false);
  });
});
