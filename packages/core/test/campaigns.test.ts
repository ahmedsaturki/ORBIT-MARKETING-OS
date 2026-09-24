import { describe, expect, it } from "vitest";
import { PersistentQueue, createMemoryQueueStore } from "../src/queue/persistence.js";
import {
  activateCampaign,
  addCampaignMember,
  CampaignError,
  createCampaign,
  enqueueCampaignTask,
  isCampaignMember,
  type Campaign,
  type CampaignMember,
} from "../src/workflows/campaigns.js";

const NOW = "2026-09-24T10:00:00.000Z";

function makeCampaign(status: Campaign["status"] = "draft"): Campaign {
  const draft = createCampaign({
    id: "camp1",
    workspaceId: "ws1",
    name: "Ramadan launch",
    createdAt: NOW,
  });
  return status === "draft" ? draft : { ...draft, status };
}

function makeMembers(...accountIds: string[]): readonly CampaignMember[] {
  const campaign = makeCampaign();
  let members: readonly CampaignMember[] = [];
  for (const accountId of accountIds) {
    members = addCampaignMember(campaign, members, {
      campaignId: campaign.id,
      workspaceId: campaign.workspaceId,
      accountId,
      addedAt: NOW,
    });
  }
  return members;
}

describe("campaign → task integration (CAMP-01)", () => {
  it("creates a campaign, activates it, and enqueues a task into the real queue", async () => {
    const queue = await PersistentQueue.open(createMemoryQueueStore(), NOW);
    let campaign = createCampaign({
      id: "camp1",
      workspaceId: "ws1",
      name: "Ramadan launch",
      createdAt: NOW,
    });
    expect(campaign.status).toBe("draft");
    campaign = activateCampaign(campaign);
    expect(campaign.status).toBe("active");

    let members = addCampaignMember(campaign, [], {
      campaignId: campaign.id,
      workspaceId: campaign.workspaceId,
      accountId: "acc-1",
      addedAt: NOW,
    });

    const task = await enqueueCampaignTask(
      campaign,
      members,
      {
        id: "task-1",
        platform: "facebook",
        accountId: "acc-1",
        actionType: "post_page",
        target: "page-42",
        scheduledTime: NOW,
        text: "Launch offer 50%",
      },
      { enqueue: (t) => queue.enqueue(t, NOW) },
    );

    const listed = queue.list();
    expect(listed).toHaveLength(1);
    const persisted = listed[0];
    expect(persisted?.id).toBe("task-1");
    expect(persisted?.campaignId).toBe("camp1");
    expect(persisted?.workspaceId).toBe("ws1");
    expect(persisted?.accountId).toBe("acc-1");
    expect(persisted?.platform).toBe("facebook");
    expect(persisted?.actionType).toBe("post_page");
    expect(persisted?.target).toBe("page-42");
    expect(persisted?.payload.text).toBe("Launch offer 50%");
    expect(persisted?.status).toBe("queued");
    expect(persisted?.retries).toBe(0);
    expect(task.campaignId).toBe("camp1");

    // Membership list survives the add → check → enqueue round trip.
    expect(
      isCampaignMember(members, campaign.id, campaign.workspaceId, "acc-1"),
    ).toBe(true);
  });

  it("enqueues one task per member across platforms", async () => {
    const queue = await PersistentQueue.open(createMemoryQueueStore(), NOW);
    const campaign = activateCampaign(makeCampaign());
    const members = makeMembers("acc-1", "acc-2");

    let n = 0;
    for (const account of ["acc-1", "acc-2"]) {
      await enqueueCampaignTask(
        campaign,
        members,
        {
          id: `task-${++n}`,
          platform: account === "acc-1" ? "instagram" : "telegram",
          accountId: account,
          actionType: account === "acc-1" ? "post_page" : "telegram_post",
          target: `t-${account}`,
          scheduledTime: NOW,
        },
        { enqueue: (t) => queue.enqueue(t, NOW) },
      );
    }
    expect(queue.list()).toHaveLength(2);
    expect(queue.list().map((t) => t.accountId).sort()).toEqual([
      "acc-1",
      "acc-2",
    ]);
  });
});

describe("account membership enforcement (CAMP-02)", () => {
  it("rejects a non-member account and leaves the queue unchanged", async () => {
    const queue = await PersistentQueue.open(createMemoryQueueStore(), NOW);
    const campaign = activateCampaign(makeCampaign());
    const members = makeMembers("acc-1");

    await expect(
      enqueueCampaignTask(
        campaign,
        members,
        {
          id: "task-x",
          platform: "facebook",
          accountId: "acc-intruder",
          actionType: "post_page",
          target: "page-1",
          scheduledTime: NOW,
        },
        { enqueue: (t) => queue.enqueue(t, NOW) },
      ),
    ).rejects.toThrow(CampaignError);

    await expect(
      enqueueCampaignTask(
        campaign,
        members,
        {
          id: "task-x",
          platform: "facebook",
          accountId: "acc-intruder",
          actionType: "post_page",
          target: "page-1",
          scheduledTime: NOW,
        },
        { enqueue: (t) => queue.enqueue(t, NOW) },
      ),
    ).rejects.toThrow(/not a member/);
    expect(queue.list()).toHaveLength(0);
  });

  it("rejects a member record from a different workspace", async () => {
    const campaign = activateCampaign(makeCampaign());
    expect(() =>
      addCampaignMember(campaign, [], {
        campaignId: "camp1",
        workspaceId: "other-ws",
        accountId: "acc-1",
        addedAt: NOW,
      }),
    ).toThrow(CampaignError);

    // Even a well-formed local membership does not authorize a foreign account.
    const members = makeMembers("acc-1");
    const foreignWorkspaceMember = { ...members[0]!, workspaceId: "ws2" };
    expect(
      isCampaignMember(
        [foreignWorkspaceMember],
        campaign.id,
        campaign.workspaceId,
        "acc-1",
      ),
    ).toBe(false);
  });

  it("rejects enqueue for draft, paused, and completed campaigns (fail-closed)", async () => {
    const queue = await PersistentQueue.open(createMemoryQueueStore(), NOW);
    const members = makeMembers("acc-1");
    const input = {
      id: "task-1",
      platform: "facebook",
      accountId: "acc-1",
      actionType: "post_page" as const,
      target: "page-1",
      scheduledTime: NOW,
    };

    for (const status of ["draft", "paused", "completed"] as const) {
      const campaign = makeCampaign(status);
      await expect(
        enqueueCampaignTask(campaign, members, input, {
          enqueue: (t) => queue.enqueue(t, NOW),
        }),
      ).rejects.toThrow(/not active/);
    }
    expect(queue.list()).toHaveLength(0);

    expect(() => activateCampaign(makeCampaign("completed"))).toThrow(
      /completed/,
    );
  });

  it("deduplicates membership additions", () => {
    const campaign = makeCampaign();
    const once = addCampaignMember(campaign, [], {
      campaignId: campaign.id,
      workspaceId: campaign.workspaceId,
      accountId: "acc-1",
      addedAt: NOW,
    });
    const twice = addCampaignMember(campaign, once, {
      campaignId: campaign.id,
      workspaceId: campaign.workspaceId,
      accountId: "acc-1",
      addedAt: NOW,
    });
    expect(twice).toHaveLength(1);
    expect(twice).toBe(once);
  });

  it("fails closed on malformed campaign, membership, and task fields", async () => {
    expect(() =>
      createCampaign({ id: " ", workspaceId: "ws1", name: "n", createdAt: NOW }),
    ).toThrow(CampaignError);
    expect(() =>
      createCampaign({ id: "c", workspaceId: "ws1", name: "", createdAt: NOW }),
    ).toThrow(CampaignError);

    const campaign = activateCampaign(makeCampaign());
    const members = makeMembers("acc-1");
    const queue = await PersistentQueue.open(createMemoryQueueStore(), NOW);
    const sink = { enqueue: (t: Parameters<typeof queue.enqueue>[0]) => queue.enqueue(t, NOW) };

    await expect(
      enqueueCampaignTask(
        campaign,
        members,
        {
          id: "task-1",
          platform: "facebook",
          accountId: "acc-1",
          actionType: "not_a_real_action" as never,
          target: "page-1",
          scheduledTime: NOW,
        },
        sink,
      ),
    ).rejects.toThrow(/unknown action type/);

    await expect(
      enqueueCampaignTask(
        campaign,
        members,
        {
          id: "task-1",
          platform: "",
          accountId: "acc-1",
          actionType: "post_page",
          target: "page-1",
          scheduledTime: NOW,
        },
        sink,
      ),
    ).rejects.toThrow(/platform/);

    await expect(
      enqueueCampaignTask(
        campaign,
        members,
        {
          id: "task-1",
          platform: "facebook",
          accountId: "acc-1",
          actionType: "post_page",
          target: "",
          scheduledTime: NOW,
        },
        sink,
      ),
    ).rejects.toThrow(/target/);
    expect(queue.list()).toHaveLength(0);
  });
});
