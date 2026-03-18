import { describe, expect, it } from "vitest";
import { getOpenRouterCircuitBreaker } from "@/lib/circuit-breaker";

describe("OpenRouter circuit breaker", () => {
  it("opens after repeated failures", () => {
    const breaker = getOpenRouterCircuitBreaker();
    breaker.recordSuccess();
    breaker.recordFailure("one");
    breaker.recordFailure("two");
    const state = breaker.recordFailure("three");

    expect(state.status).toBe("open");
    expect(breaker.canRequest().ok).toBe(false);
  });
});
