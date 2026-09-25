import type { ContentItem, Platform } from "../types/index.js";

export interface ContentValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

export function validateContentItem(content: ContentItem): ContentValidationResult {
  const errors: string[] = [];
  if (!content.id.trim()) errors.push("content id is required");
  if (!content.workspaceId.trim()) errors.push("content workspace id is required");
  if (!content.title.trim()) errors.push("content title is required");
  if (!content.body.trim()) errors.push("content body is required");
  if (content.tags.some((tag) => !tag.trim())) errors.push("content tags must be non-empty");
  if (new Set(content.tags.map((tag) => tag.trim().toLowerCase())).size !== content.tags.length) {
    errors.push("content tags must be unique");
  }
  if (Number.isNaN(Date.parse(content.createdAt)) || Number.isNaN(Date.parse(content.updatedAt))) {
    errors.push("content timestamps must be valid");
  }
  if (Date.parse(content.updatedAt) < Date.parse(content.createdAt)) {
    errors.push("content updatedAt cannot precede createdAt");
  }
  return { valid: errors.length === 0, errors };
}

export function selectContentVariant(content: ContentItem, platform: Platform): string {
  const variant = content.platformVariants[platform]?.trim();
  if (variant) return variant;
  return content.body.trim();
}

export function validateContentForDelivery(
  content: ContentItem,
  platform: Platform,
): ContentValidationResult {
  const base = validateContentItem(content);
  const errors = [...base.errors];
  if (content.approvalStatus !== "approved") errors.push("content is not approved");
  if (!selectContentVariant(content, platform)) errors.push("content variant is empty");
  return { valid: errors.length === 0, errors };
}
