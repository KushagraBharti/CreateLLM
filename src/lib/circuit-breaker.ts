import { CircuitBreakerState } from "@/types";

const FAILURE_WINDOW_MS = 30_000;
const OPEN_COOLDOWN_MS = 20_000;
const FAILURE_THRESHOLD = 3;

class OpenRouterCircuitBreaker {
  private failures: number[] = [];
  private state: CircuitBreakerState = {
    status: "closed",
    failureCount: 0,
  };

  canRequest(): { ok: boolean; state: CircuitBreakerState } {
    const now = Date.now();
    this.pruneFailures(now);

    if (
      this.state.status === "open" &&
      this.state.cooldownUntil &&
      new Date(this.state.cooldownUntil).getTime() <= now
    ) {
      this.state = {
        ...this.state,
        status: "half_open",
      };
    }

    return {
      ok: this.state.status !== "open",
      state: this.snapshot(),
    };
  }

  recordSuccess(): CircuitBreakerState {
    this.failures = [];
    this.state = {
      status: "closed",
      failureCount: 0,
    };
    return this.snapshot();
  }

  recordFailure(reason: string): CircuitBreakerState {
    const now = Date.now();
    this.failures.push(now);
    this.pruneFailures(now);

    const shouldOpen = this.failures.length >= FAILURE_THRESHOLD;
    this.state = {
      status: shouldOpen ? "open" : this.state.status === "half_open" ? "open" : "closed",
      failureCount: this.failures.length,
      lastFailureAt: new Date(now).toISOString(),
      reason,
      openedAt: shouldOpen ? new Date(now).toISOString() : this.state.openedAt,
      cooldownUntil: shouldOpen ? new Date(now + OPEN_COOLDOWN_MS).toISOString() : this.state.cooldownUntil,
    };

    return this.snapshot();
  }

  snapshot(): CircuitBreakerState {
    return { ...this.state };
  }

  private pruneFailures(now: number) {
    this.failures = this.failures.filter((timestamp) => now - timestamp <= FAILURE_WINDOW_MS);
    if (this.failures.length === 0 && this.state.status === "closed") {
      this.state = {
        status: "closed",
        failureCount: 0,
      };
    }
  }
}

declare global {
  // eslint-disable-next-line no-var
  var __novelBenchCircuitBreaker: OpenRouterCircuitBreaker | undefined;
}

export function getOpenRouterCircuitBreaker(): OpenRouterCircuitBreaker {
  if (!globalThis.__novelBenchCircuitBreaker) {
    globalThis.__novelBenchCircuitBreaker = new OpenRouterCircuitBreaker();
  }
  return globalThis.__novelBenchCircuitBreaker;
}
