import { describe, expect, it } from "vitest";
import {
  DEFAULT_CIRCUIT_CONFIG,
  createCircuitBreaker,
  isCircuitBlocking,
  maybeHalfOpen,
  recordCircuitFailure,
  recordCircuitSuccess,
} from "../src/policy/index.js";

describe("circuit breaker", () => {
  it("opens after consecutive failures reach threshold", () => {
    let snap = createCircuitBreaker();
    const now = "2026-09-24T10:00:00.000Z";
    snap = recordCircuitFailure(snap, DEFAULT_CIRCUIT_CONFIG, now);
    expect(snap.state).toBe("closed");
    snap = recordCircuitFailure(snap, DEFAULT_CIRCUIT_CONFIG, now);
    expect(snap.state).toBe("closed");
    snap = recordCircuitFailure(snap, DEFAULT_CIRCUIT_CONFIG, now);
    expect(snap.state).toBe("open");
    expect(isCircuitBlocking(snap)).toBe(true);
  });

  it("resets on success", () => {
    let snap = createCircuitBreaker();
    const now = "2026-09-24T10:00:00.000Z";
    snap = recordCircuitFailure(snap, DEFAULT_CIRCUIT_CONFIG, now);
    snap = recordCircuitFailure(snap, DEFAULT_CIRCUIT_CONFIG, now);
    snap = recordCircuitSuccess(snap);
    expect(snap.state).toBe("closed");
    expect(snap.consecutiveErrors).toBe(0);
  });

  it("half-opens after pause duration", () => {
    let snap = createCircuitBreaker();
    const openedAt = "2026-09-24T10:00:00.000Z";
    snap = { state: "open", consecutiveErrors: 3, openedAt };
    const stillPaused = maybeHalfOpen(snap, DEFAULT_CIRCUIT_CONFIG, Date.parse(openedAt) + 1000);
    expect(stillPaused.state).toBe("open");
    const eligible = maybeHalfOpen(
      snap,
      DEFAULT_CIRCUIT_CONFIG,
      Date.parse(openedAt) + DEFAULT_CIRCUIT_CONFIG.pauseDurationMs + 1,
    );
    expect(eligible.state).toBe("half_open");
    expect(isCircuitBlocking(eligible)).toBe(false);
  });
});
