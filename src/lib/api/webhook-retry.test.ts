import { describe, expect, it } from "vitest";

import { MAX_ATTEMPTS, backoffMs, shouldRetry } from "./webhook-retry";

describe("shouldRetry", () => {
  it("retries a transport failure", () => {
    expect(shouldRetry(null, 0)).toBe(true);
    expect(shouldRetry(null, 1)).toBe(true);
  });

  it("retries 5xx", () => {
    expect(shouldRetry(500, 0)).toBe(true);
    expect(shouldRetry(503, 0)).toBe(true);
  });

  it("never retries 4xx — the receiver understood and rejected it", () => {
    expect(shouldRetry(400, 0)).toBe(false);
    expect(shouldRetry(401, 0)).toBe(false);
    expect(shouldRetry(410, 0)).toBe(false);
    expect(shouldRetry(429, 0)).toBe(false);
  });

  it("does not retry a success", () => {
    expect(shouldRetry(200, 0)).toBe(false);
    expect(shouldRetry(204, 0)).toBe(false);
  });

  it("stops at the attempt cap even for a retryable status", () => {
    expect(shouldRetry(500, MAX_ATTEMPTS - 1)).toBe(false);
    expect(shouldRetry(null, MAX_ATTEMPTS - 1)).toBe(false);
  });

  it("makes at most MAX_ATTEMPTS deliveries for a permanently broken receiver", () => {
    let attempts = 0;
    for (let i = 0; i < 10; i++) {
      attempts++;
      if (!shouldRetry(500, i)) break;
    }
    expect(attempts).toBe(MAX_ATTEMPTS);
  });
});

describe("backoffMs", () => {
  it("backs off progressively and stays bounded", () => {
    expect(backoffMs(0)).toBe(1000);
    expect(backoffMs(1)).toBe(4000);
    expect(backoffMs(99)).toBe(4000);
  });
});
