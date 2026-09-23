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
});
