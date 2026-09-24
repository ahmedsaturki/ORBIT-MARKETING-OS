import { describe, expect, it } from "vitest";
import { evaluateApproval } from "../src/workflows/approval.js";
import type { Approval, ContentItem } from "../src/types/index.js";

const content: ContentItem = {
  id: "content-1",
  workspaceId: "workspace-1",
  title: "Launch",
  body: "Launch post",
  platformVariants: {
    facebook: undefined,
    instagram: undefined,
    telegram: undefined,
    whatsapp: undefined,
    linkedin: undefined,
    tiktok: undefined,
  },
  approvalStatus: "pending",
  tags: [],
  createdAt: "2026-09-24T00:00:00.000Z",
  updatedAt: "2026-09-24T00:00:00.000Z",
};

const approved: Approval = {
  id: "approval-1",
  workspaceId: "workspace-1",
  contentId: "content-1",
  requestedBy: "user-1",
  reviewerIds: ["user-2"],
  status: "approved",
};

describe("approval gate", () => {
  it("fails closed when approval evidence is absent", () => {
    expect(evaluateApproval(content).allowedToPublish).toBe(false);
  });

  it("allows an explicitly approved item", () => {
    expect(evaluateApproval({ ...content, approvalStatus: "approved" }).allowedToPublish).toBe(true);
  });

  it("allows an approved workflow decision", () => {
    expect(evaluateApproval(content, approved).allowedToPublish).toBe(true);
  });

  it("blocks rejected workflow decisions", () => {
    const rejected: Approval = { ...approved, status: "rejected" };
    const decision = evaluateApproval(content, rejected);
    expect(decision.allowedToPublish).toBe(false);
    expect(decision.reason).toBe("rejected");
  });

  it("blocks changes_requested decisions", () => {
    const changes: Approval = { ...approved, status: "changes_requested" };
    const decision = evaluateApproval(content, changes);
    expect(decision.allowedToPublish).toBe(false);
    expect(decision.reason).toBe("changes_requested");
  });

  it("blocks pending decisions", () => {
    const pending: Approval = { ...approved, status: "pending" };
    const decision = evaluateApproval(content, pending);
    expect(decision.allowedToPublish).toBe(false);
    expect(decision.reason).toBe("pending");
  });

  it("blocks draft workflow decisions", () => {
    const draft: Approval = { ...approved, status: "draft" };
    const decision = evaluateApproval(content, draft);
    expect(decision.allowedToPublish).toBe(false);
    expect(decision.reason).toBe("pending");
  });

  it("allows draft content when no approval workflow is configured", () => {
    const draftContent = { ...content, approvalStatus: "draft" as const };
    expect(evaluateApproval(draftContent).allowedToPublish).toBe(true);
  });
});
