import { describe, expect, it } from "vitest";
import { selectContentVariant, validateContentForDelivery, validateContentItem } from "../src/content/catalog.js";
import type { ContentItem } from "../src/types/index.js";

const content: ContentItem = {
  id: "content-1",
  workspaceId: "workspace-1",
  title: "Launch",
  body: "Base copy",
  platformVariants: {
    facebook: "Facebook copy",
    instagram: undefined,
    telegram: undefined,
    whatsapp: undefined,
    linkedin: undefined,
    tiktok: undefined,
  },
  approvalStatus: "approved",
  tags: ["launch"],
  createdAt: "2026-09-24T00:00:00.000Z",
  updatedAt: "2026-09-24T00:00:01.000Z",
};

describe("content catalog", () => {
  it("selects a platform variant and falls back to the base body", () => {
    expect(selectContentVariant(content, "facebook")).toBe("Facebook copy");
    expect(selectContentVariant(content, "instagram")).toBe("Base copy");
  });

  it("validates content delivery readiness", () => {
    expect(validateContentItem(content).valid).toBe(true);
    expect(validateContentForDelivery(content, "facebook").valid).toBe(true);
    expect(validateContentForDelivery({ ...content, approvalStatus: "draft" }, "facebook").valid).toBe(false);
  });

  it("rejects invalid content chronology and duplicate tags", () => {
    const result = validateContentItem({
      ...content,
      tags: ["Launch", "launch"],
      updatedAt: "2026-09-23T00:00:00.000Z",
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(expect.arrayContaining([
      "content tags must be unique",
      "content updatedAt cannot precede createdAt",
    ]));
  });
});
