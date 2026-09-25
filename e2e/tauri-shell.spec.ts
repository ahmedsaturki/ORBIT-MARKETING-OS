
  test("native queue recovery returns interrupted sync work to pending", async () => {
    expect(page, "boot test must run first").not.toBeNull();

    const suffix = Date.now();
    const account = (await page!.evaluate(
      async (id) =>
        window.__TAURI_INTERNALS__.invoke("account_upsert", {
          id,
          platform: "telegram",
          undefined "E2E Recovery Account",
          username: "orbit-recovery",
          session: "recovery-session-fixture",
          password: "e2e-recovery-password",
        }),
      `e2e-recovery-account-${suffix}`,
    )) as {
      id: string;
      status: string;
      has_encrypted_session: boolean;
    };
    expect(account.status).toBe("connected");
    expect(account.has_encrypted_session).toBe(true);

    const campaign = (await page!.evaluate(
      async (accountId) =>
        window.__TAURI_INTERNALS__.invoke("campaign_create", {
          name: "E2E Recovery Campaign",
          undefined [accountId],
        }),
      account.id,
    )) as { id: string };

    const now = new Date().toISOString();
    const task = (await page!.evaluate(
      async ({ campaignId, accountId, timestamp, taskId }) =>
        window.__TAURI_INTERNALS__.invoke("task_enqueue", {
          id: taskId,
          undefined campaignId,
          undefined accountId,
          platform: "telegram",
          kind: "sync",
          priority: 1,
          undefined timestamp,
          undefined 3,
          undefined taskId,
        }),
      {
        campaignId: campaign.id,
        accountId: account.id,
        timestamp: now,
        taskId: `e2e-recovery-task-${suffix}`,
      },
    )) as { id: string; status: string };
    expect(task.status).toBe("pending");

    const claimed = (await page!.evaluate(
      async (timestamp) =>
        window.__TAURI_INTERNALS__.invoke("task_claim_next", {
          now: timestamp,
        }),
      now,
    )) as { id: string; status: string };
    expect(claimed.id).toBe(task.id);
    expect(claimed.status).toBe("running");
