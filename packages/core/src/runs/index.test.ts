import { describe, expect, it } from "vitest";
import {
  buildMarketingRunBlueprint,
  deriveMarketingRunStatus,
  getRunnableRunSteps,
  updateMarketingRunStep,
} from "./index.js";

const context = {
  workspaceId: "ws-1",
  strategyId: "strategy-1",
  audienceId: "aud-1",
  offerId: "offer-1",
};

describe("marketing runs", () => {
  it("builds the canonical operating chain deterministically", () => {
    const run = buildMarketingRunBlueprint({
      id: "run-1",
      now: "2026-09-26T00:00:00Z",
      context,
    });

    expect(run.status).toBe("ready");
    expect(run.steps.map((step) => step.stage)).toEqual([
      "strategy",
      "campaign",
      "content",
      "approval",
      "execution",
      "engagement",
      "conversion",
      "measurement",
      "learning",
    ]);
    expect(run.steps.at(-1)?.dependsOn).toEqual(["run-1:measurement"]);
  });

  it("only exposes dependency-satisfied work as runnable", () => {
    const run = buildMarketingRunBlueprint({
      id: "run-2",
      now: "2026-09-26T00:00:00Z",
      context,
    });

    expect(getRunnableRunSteps(run).map((step) => step.stage)).toEqual([
      "strategy",
    ]);

    const campaignReady = updateMarketingRunStep(
      run,
      "run-2:strategy",
      "succeeded",
      "2026-09-26T00:01:00Z",
      "strategy-result",
    );

    expect(getRunnableRunSteps(campaignReady).map((step) => step.stage)).toEqual([
      "campaign",
    ]);
  });

  it("blocks execution until dependencies are satisfied", () => {
    const run = buildMarketingRunBlueprint({
      id: "run-3",
      now: "2026-09-26T00:00:00Z",
      context,
    });

    expect(() =>
      updateMarketingRunStep(run, "run-3:campaign", "running", "2026-09-26T00:01:00Z"),
    ).toThrow("marketing_run_dependencies_not_satisfied");
  });

  it("derives approval state without executing anything", () => {
    const run = buildMarketingRunBlueprint({
      id: "run-4",
      now: "2026-09-26T00:00:00Z",
      context,
    });

    let next = updateMarketingRunStep(
      run,
      "run-4:strategy",
      "succeeded",
      "2026-09-26T00:01:00Z",
    );
    next = updateMarketingRunStep(
      next,
      "run-4:campaign",
      "succeeded",
      "2026-09-26T00:02:00Z",
    );
    next = updateMarketingRunStep(
      next,
      "run-4:content",
      "succeeded",
      "2026-09-26T00:03:00Z",
    );
    next = updateMarketingRunStep(
      next,
      "run-4:approval",
      "awaiting_approval",
      "2026-09-26T00:04:00Z",
    );

    expect(deriveMarketingRunStatus(next)).toBe("awaiting_approval");
  });

  it("never lets a succeeded step be downgraded", () => {
    const run = buildMarketingRunBlueprint({
      id: "run-5",
      now: "2026-09-26T00:00:00Z",
      context,
    });

    const succeeded = updateMarketingRunStep(
      run,
      "run-5:strategy",
      "succeeded",
      "2026-09-26T00:01:00Z",
    );

    expect(() =>
      updateMarketingRunStep(
        succeeded,
        "run-5:strategy",
        "pending",
        "2026-09-26T00:02:00Z",
      ),
    ).toThrow("marketing_run_terminal_step");
  });
});
