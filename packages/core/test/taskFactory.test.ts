import { describe, expect, it } from "vitest";
import { buildCampaignTasks } from "../src/campaigns/taskFactory.js";

describe("buildCampaignTasks", () => {
  it("creates deterministic task identities for all campaign accounts", () => {
    const tasks = buildCampaignTasks(
      {
        id: "camp-1",
        workspaceId: "workspace-1",
        name: "Launch",
        status: "scheduled",
        accountIds: ["acc-1", "acc-2"],
        taskCount: 2,
        createdAt: "2026-09-24T00:00:00.000Z",
      },
      "facebook",
      {
        taskKind: "publish",
        priority: 5,
        maxAttempts: 4,
        availableAt: "2026-09-24T12:00:00.000Z",
      },
    );

    expect(tasks).toHaveLength(2);
    expect(tasks.map((task) => task.id)).toEqual(["camp-1:task:1", "camp-1:task:2"]);
    expect(tasks.every((task) => task.maxAttempts === 4)).toBe(true);
    expect(tasks.every((task) => task.priority === 5)).toBe(true);
  });

  it("rejects an invalid retry budget", () => {
    expect(() =>
      buildCampaignTasks(
        {
          id: "camp-1",
          name: "Launch",
          status: "draft",
          accountIds: ["acc-1"],
          taskCount: 1,
          createdAt: "2026-09-24T00:00:00.000Z",
        },
        "facebook",
        { taskKind: "publish", maxAttempts: 0 },
      ),
    ).toThrow("maxAttempts must be a positive integer");
  });
});
