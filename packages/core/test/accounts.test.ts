import { describe, expect, it } from "vitest";
import {
  calculateHealthScore,
  calculateWarmupBudget,
} from "../src/accounts/safety.js";

describe("account safety", () => {
  it("starts with a conservative budget and grows weekly", () => {
    expect(calculateWarmupBudget(0).dailyLimit).toBe(3);
    expect(calculateWarmupBudget(7).dailyLimit).toBe(3);
    expect(calculateWarmupBudget(14).dailyLimit).toBe(4);
  });

  it("caps the local budget", () => {
    expect(calculateWarmupBudget(365, 3, 0.2, 20).dailyLimit).toBe(20);
  });

  it("computes a bounded health score from recorded activity", () => {
    const score = calculateHealthScore({
      tasksAttempted: 10,
      tasksSucceeded: 9,
      tasksFailed: 1,
      challenges: 0,
      daysActive: 14,
    });
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
    expect(score).toBeGreaterThan(70);
  });

  it("returns a neutral starting score with no activity", () => {
    expect(
      calculateHealthScore({
        tasksAttempted: 0,
        tasksSucceeded: 0,
        tasksFailed: 0,
        challenges: 0,
        daysActive: 0,
      }),
    ).toBe(100);
  });
});
