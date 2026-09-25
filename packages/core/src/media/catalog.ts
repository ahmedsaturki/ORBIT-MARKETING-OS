export type MediaKind = "image" | "video" | "audio" | "document";

export interface MediaAsset {
  readonly id: string;
  readonly workspaceId: string;
  readonly kind: MediaKind;
  readonly filename: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly sha256?: string;
  readonly localPath: string;
  readonly tags: readonly string[];
  readonly createdAt: string;
}

export interface MediaSearchQuery {
  readonly text?: string;
  readonly kind?: MediaKind;
  readonly tags?: readonly string[];
}

export interface MediaValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

const MIME_BY_KIND: Readonly<Record<MediaKind, readonly string[]>> = {
  image: ["image/"],
  video: ["video/"],
  audio: ["audio/"],
  document: ["application/pdf", "text/", "application/zip"],
};

export function validateMediaAsset(asset: MediaAsset): MediaValidationResult {
  const errors: string[] = [];
  if (!asset.id.trim()) errors.push("media id is required");
  if (!asset.workspaceId.trim()) errors.push("media workspace id is required");
  if (!asset.filename.trim()) errors.push("media filename is required");
  if (!asset.localPath.trim()) errors.push("media localPath is required");
  if (!Number.isSafeInteger(asset.sizeBytes) || asset.sizeBytes <= 0) {
    errors.push("media sizeBytes must be a positive safe integer");
  }
  if (!asset.mimeType.includes("/")) errors.push("media mimeType is invalid");
  const allowed = MIME_BY_KIND[asset.kind];
  if (!allowed.some((prefix) => asset.mimeType.startsWith(prefix))) {
    errors.push("media mimeType does not match media kind");
  }
  if (asset.sha256 !== undefined && !/^[a-f0-9]{64}$/u.test(asset.sha256)) {
    errors.push("media sha256 must be a 64-character lowercase hex digest");
  }
  if (asset.tags.some((tag) => !tag.trim()))
    errors.push("media tags must be non-empty");
  return { valid: errors.length === 0, errors };
}

export function searchMediaAssets(
  assets: readonly MediaAsset[],
  query: MediaSearchQuery,
): readonly MediaAsset[] {
  const text = query.text?.trim().toLowerCase();
  const tags = (query.tags ?? [])
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean);
  return assets.filter((asset) => {
    if (query.kind && asset.kind !== query.kind) return false;
    if (
      text &&
      !asset.filename.toLowerCase().includes(text) &&
      !asset.localPath.toLowerCase().includes(text)
    ) {
      return false;
    }
    if (
      tags.length &&
      !tags.every((tag) =>
        asset.tags.some((item) => item.toLowerCase() === tag),
      )
    ) {
      return false;
    }
    return true;
  });
}
