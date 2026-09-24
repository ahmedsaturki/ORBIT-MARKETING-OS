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
        contentIds: ["content-1"],
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
    expect(tasks.map((task) => task.id)).toEqual(["camp-1:task:facebook:publish:acc-1:content-1", "camp-1:task:facebook:publish:acc-2:content-1"]);
    expect(tasks.every((task) => task.maxAttempts === 4)).toBe(true);
    expect(tasks.every((task) => task.priority === 5)).toBe(true);
  });

  it("binds the only campaign content item automatically", () => {
    const tasks = buildCampaignTasks(
      {
        id: "camp-content",
        workspaceId: "workspace-1",
        name: "Content launch",
        status: "scheduled",
        accountIds: ["acc-1"],
        contentIds: ["content-1"],
        taskCount: 1,
        createdAt: "2026-09-24T00:00:00.000Z",
      },
      "facebook",
      { taskKind: "publish" },
    );

    expect(tasks[0]?.contentId).toBe("content-1");
  });

  it("requires an explicit content id when a campaign targets multiple content items", () => {
    expect(() =>
      buildCampaignTasks(
        {
          id: "camp-multi",
          workspaceId: "workspace-1",
          name: "Multi content launch",
          status: "scheduled",
          accountIds: ["acc-1"],
          contentIds: ["content-1", "content-2"],
          taskCount: 1,
          createdAt: "2026-09-24T00:00:00.000Z",
        },
        "facebook",
        { taskKind: "publish" },
      ),
    ).toThrow("contentId is required when a campaign targets multiple content items");
  });

  it("keeps task identities distinct when content differs", () => {
    const first = buildCampaignTasks(
      {
        id: "camp-multi",
        workspaceId: "workspace-1",
        name: "Multi content launch",
        status: "scheduled",
        accountIds: ["acc-1"],
        contentIds: ["content-1", "content-2"],
        taskCount: 2,
        createdAt: "2026-09-24T00:00:00.000Z",
      },
      "facebook",
      { taskKind: "publish", contentId: "content-1" },
    )[0];
    const second = buildCampaignTasks(
      {
        id: "camp-multi",
        workspaceId: "workspace-1",
        name: "Multi content launch",
        status: "scheduled",
        accountIds: ["acc-1"],
        contentIds: ["content-1", "content-2"],
        taskCount: 2,
        createdAt: "2026-09-24T00:00:00.000Z",
      },
      "facebook",
      { taskKind: "publish", contentId: "content-2" },
    )[0];

    expect(first?.contentId).toBe("content-1");
    expect(second?.contentId).toBe("content-2");
    expect(first?.idempotencyKey).not.toBe(second?.idempotencyKey);
  });

  it("rejects duplicate campaign account ids", () => {
    expect(() =>
      buildCampaignTasks(
        {
          id: "camp-1",
          workspaceId: "workspace-1",
          name: "Launch",
          status: "draft",
          accountIds: ["acc-1", "acc-1"],
          contentIds: ["content-1"],
          taskCount: 2,
          createdAt: "2026-09-24T00:00:00.000Z",
        },
        "facebook",
        { taskKind: "publish" },
      ),
    ).toThrow("Campaign account ids must be unique");
  });

  it("rejects an invalid retry budget", () => {
    expect(() =>
      buildCampaignTasks(
        {
          id: "camp-1",
          workspaceId: "workspace-1",
          name: "Launch",
          status: "draft",
          accountIds: ["acc-1"],
          contentIds: ["content-1"],
          taskCount: 1,
          createdAt: "2026-09-24T00:00:00.000Z",
        },
        "facebook",
        { taskKind: "publish", maxAttempts: 0 },
      ),
    ).toThrow("maxAttempts must be a positive integer");
  });
});
