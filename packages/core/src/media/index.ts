export class MediaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MediaError";
  }
}

export interface MediaAsset {
  readonly id: string;
  readonly workspaceId: string;
  readonly filename: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly tags: readonly string[];
  readonly createdAt: string;
}

export interface MediaSearchQuery {
  readonly workspaceId: string;
  readonly text?: string;
  readonly mimeType?: string;
  readonly tag?: string;
}

function requireNonEmpty(value: string, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new MediaError(`${field} must be a non-empty string`);
  }
  return value;
}

function validate(asset: MediaAsset): MediaAsset {
  requireNonEmpty(asset.id, "id");
  requireNonEmpty(asset.workspaceId, "workspaceId");
  requireNonEmpty(asset.filename, "filename");
  requireNonEmpty(asset.mimeType, "mimeType");
  requireNonEmpty(asset.createdAt, "createdAt");
  if (
    typeof asset.sizeBytes !== "number" ||
    !Number.isFinite(asset.sizeBytes) ||
    asset.sizeBytes < 0
  ) {
    throw new MediaError("sizeBytes must be a non-negative number");
  }
  if (!Array.isArray(asset.tags)) {
    throw new MediaError("tags must be an array");
  }
  for (const tag of asset.tags) {
    requireNonEmpty(tag, "tag");
  }
  return asset;
}

/**
 * In-memory metadata index. Search is always workspace-scoped (fail-closed:
 * a query without a workspaceId throws), filters combine with AND, matching
 * is case-insensitive substring on filename, exact on tag, and prefix on
 * `type/` style mime filters.
 */
export class MediaIndex {
  private readonly byId = new Map<string, MediaAsset>();

  add(asset: MediaAsset): MediaAsset {
    const valid = validate(asset);
    if (this.byId.has(valid.id)) {
      throw new MediaError(`duplicate media id: ${valid.id}`);
    }
    this.byId.set(valid.id, valid);
    return valid;
  }

  get(id: string, workspaceId: string): MediaAsset | undefined {
    const asset = this.byId.get(id);
    if (!asset) return undefined;
    return asset.workspaceId === workspaceId ? asset : undefined;
  }

  remove(id: string, workspaceId: string): boolean {
    const asset = this.byId.get(id);
    if (!asset || asset.workspaceId !== workspaceId) return false;
    this.byId.delete(id);
    return true;
  }

  count(workspaceId: string): number {
    requireNonEmpty(workspaceId, "workspaceId");
    let n = 0;
    for (const asset of this.byId.values()) {
      if (asset.workspaceId === workspaceId) n++;
    }
    return n;
  }

  search(query: MediaSearchQuery): readonly MediaAsset[] {
    requireNonEmpty(query.workspaceId, "workspaceId");
    const text =
      query.text !== undefined && query.text.length > 0
        ? query.text.toLowerCase()
        : undefined;
    const mime =
      query.mimeType !== undefined && query.mimeType.length > 0
        ? query.mimeType
        : undefined;

    const results: MediaAsset[] = [];
    for (const asset of this.byId.values()) {
      if (asset.workspaceId !== query.workspaceId) continue;
      if (text !== undefined && !asset.filename.toLowerCase().includes(text)) {
        continue;
      }
      if (mime !== undefined) {
        const matches = mime.endsWith("/")
          ? asset.mimeType.startsWith(mime)
          : asset.mimeType === mime;
        if (!matches) continue;
      }
      if (query.tag !== undefined && query.tag.length > 0) {
        if (!asset.tags.includes(query.tag)) continue;
      }
      results.push(asset);
    }
    results.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    return results;
  }
}
