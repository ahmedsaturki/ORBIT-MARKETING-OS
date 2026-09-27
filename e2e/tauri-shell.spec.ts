      (workspaceId) =>
        window.__TAURI_INTERNALS__.invoke("workspace_select", {
          id: workspaceId,
        }),
      before.id,
    );
    const restored = (await page.evaluate(() =>
      window.__TAURI_INTERNALS__.invoke("workspace_current"),
    )) as { id: string; name: string };
    expect(restored.id).toBe(before.id);
    expect(restored.name).toBe(before.name);
    await expect(page).toHaveTitle(/ORBIT Marketing OS/);
  });

  test("bulk task enqueue is atomic", async () => {
    expect(page, "boot test must run first").not.toBeNull();

    const suffix = Date.now();
    const workspace = (await page!.evaluate(
      async (id) =>
        window.__TAURI_INTERNALS__.invoke("workspace_create", {
          id,
          name: "E2E Bulk Atomicity",
        }),
      "e2e-bulk-atomic-" + suffix,
    )) as { id: string };

    await page!.evaluate(
      (id) => window.__TAURI_INTERNALS__.invoke("workspace_select", { id }),
      workspace.id,
    );

    const account = (await page!.evaluate(
      async (id) =>
        window.__TAURI_INTERNALS__.invoke("account_upsert", {
          id,
          platform: "telegram",
          displayName: "E2E Bulk Account",
          username: null,
          session: null,
          password: null,
        }),
      "e2e-bulk-account-" + suffix,
    )) as { id: string };

    const campaign = (await page!.evaluate(
      ({ name, accountId }) =>
        window.__TAURI_INTERNALS__.invoke("campaign_create", {
          name,
          accountIds: [accountId],
        }),
      {
        name: "E2E Bulk Campaign " + suffix,
        accountId: account.id,
      },
    )) as { id: string };

    const content = (await page!.evaluate(
      async (id) =>
        window.__TAURI_INTERNALS__.invoke("content_upsert", {
          id,
          title: "E2E Bulk Content",
          body: "Atomic bulk task content",
          approvalStatus: "draft",
          tagsJson: JSON.stringify(["bulk"]),
        }),
      "e2e-bulk-content-" + suffix,
    )) as { id: string };

    const attached = await page!.evaluate(
      async ({ campaignId, contentId }) =>
        window.__TAURI_INTERNALS__.invoke("campaign_attach_content", {
          campaignId,
          contentId,
        }),
      { campaignId: campaign.id, contentId: content.id },
    );
    expect(attached).toBe(true);

    const approval = (await page!.evaluate(
      async ({ contentId, approvalId }) =>
        window.__TAURI_INTERNALS__.invoke("approval_request", {
          id: approvalId,
          contentId,
          reviewerIdsJson: JSON.stringify(["local-user"]),
          note: "Approve content for atomic bulk enqueue E2E",
        }),
      {
        contentId: content.id,
        approvalId: "e2e-bulk-approval-" + suffix,
      },
    )) as { id: string; status: string };
    expect(approval.status).toBe("pending");

    const decision = (await page!.evaluate(
      async (id) =>
        window.__TAURI_INTERNALS__.invoke("approval_decide", {
          id,
          status: "approved",
          note: "Approved by the local E2E reviewer",
        }),
      approval.id,
    )) as { id: string; status: string };
    expect(decision.status).toBe("approved");

    const before = (await page!.evaluate(() =>
      window.__TAURI_INTERNALS__.invoke("task_list", {}),
    )) as Array<{ id: string }>;
    const auditBefore = (await page!.evaluate(() =>
      window.__TAURI_INTERNALS__.invoke("audit_list", { limit: 200 }),
    )) as Array<{ action: string; entityId?: string | null }>;

    let error = "";
    try {
      await page!.evaluate(
        (payload) =>
          window.__TAURI_INTERNALS__.invoke("task_enqueue_bulk", {
            inputs: payload,
          }),
        [
          {
            id: "e2e-bulk-good-" + suffix,
            campaignId: campaign.id,
            accountId: account.id,
            platform: "telegram",
            kind: "publish",
            priority: 10,
            availableAt: "2026-09-27T00:00:00Z",
            maxAttempts: 3,
            idempotencyKey: "e2e-bulk-good-" + suffix,
            contentId: content.id,
            destinationId: "@e2e-bulk",
          },
          {
            id: "e2e-bulk-bad-" + suffix,
            campaignId: campaign.id,
            accountId: account.id,
            platform: "telegram",
            kind: "publish",
            priority: 10,
            availableAt: "2026-09-27T00:01:00Z",
            maxAttempts: 3,
            idempotencyKey: "e2e-bulk-bad-" + suffix,
            contentId: content.id,
            destinationId: "",
          },
        ],
      );
    } catch (caught: unknown) {
      error = caught instanceof Error ? caught.message : String(caught);
    }

    expect(error).toContain("destination_id is required for external tasks");

    const after = (await page!.evaluate(() =>
      window.__TAURI_INTERNALS__.invoke("task_list", {}),
    )) as Array<{ id: string }>;

    expect(after).toEqual(before);

    const auditAfter = (await page!.evaluate(() =>
      window.__TAURI_INTERNALS__.invoke("audit_list", { limit: 200 }),
    )) as Array<{ action: string; entityId?: string | null }>;
    expect(auditAfter.length).toBe(auditBefore.length);
    expect(
      auditAfter.some(
        (entry) =>
          entry.action === "enqueue_bulk" &&
          String(entry.entityId ?? "").includes("e2e-bulk-good-" + suffix),
      ),
    ).toBe(false);

    await page!.evaluate(
      (id) => window.__TAURI_INTERNALS__.invoke("workspace_select", { id }),
      "default",
    );
  });
