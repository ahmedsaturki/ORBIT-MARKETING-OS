import type { ContentItem } from "../types/index.js";

export class ContentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ContentError";
  }
}

export interface VariantRequest {
  readonly contentId: string;
  readonly workspaceId: string;
  readonly title: string;
  readonly body: string;
  readonly platform: string;
}

/**
 * Provider abstraction: the Gemini-backed implementation lives at runtime
 * wiring; tests inject a deterministic local fixture so variant generation is
 * verifiable without an API key.
 */
export interface VariantProvider {
  readonly id: string;
  generateVariant(request: VariantRequest): Promise<string>;
}

export const PLATFORM_VARIANT_LIMITS: Readonly<Record<string, number>> = {
  twitter: 280,
  x: 280,
  instagram: 2200,
  facebook: 5000,
  linkedin: 3000,
  telegram: 4096,
  whatsapp: 4096,
  tiktok: 2200,
  youtube: 5000,
};

function requireNonEmpty(value: string, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ContentError(`${field} must be a non-empty string`);
  }
  return value;
}

function requireKnownPlatform(platform: string): number {
  requireNonEmpty(platform, "platform");
  const limit = PLATFORM_VARIANT_LIMITS[platform];
  if (limit === undefined) {
    throw new ContentError(`unknown platform: ${platform}`);
  }
  return limit;
}

export interface VariantSource {
  readonly id: string;
  readonly workspaceId: string;
  readonly title: string;
  readonly body: string;
}

/**
 * Generates one variant per requested platform through the provider and
 * fails closed: any provider error, empty variant, or over-limit variant
 * aborts the whole batch with no partial result.
 */
export async function generatePlatformVariants(
  source: VariantSource,
  platforms: readonly string[],
  provider: VariantProvider,
): Promise<Readonly<Record<string, string>>> {
  requireNonEmpty(source.id, "content id");
  requireNonEmpty(source.workspaceId, "workspace id");
  requireNonEmpty(source.title, "title");
  requireNonEmpty(source.body, "body");
  requireNonEmpty(provider.id, "provider id");
  if (!Array.isArray(platforms) || platforms.length === 0) {
    throw new ContentError("at least one platform is required");
  }
  const unique = [...new Set(platforms)];
  if (unique.length !== platforms.length) {
    throw new ContentError("duplicate platforms are not allowed");
  }
  const limits = unique.map((p) => requireKnownPlatform(p));

  const variants: Record<string, string> = {};
  for (let i = 0; i < unique.length; i++) {
    const platform = unique[i]!;
    const limit = limits[i]!;
    let variant: string;
    try {
      variant = await provider.generateVariant({
        contentId: source.id,
        workspaceId: source.workspaceId,
        title: source.title,
        body: source.body,
        platform,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new ContentError(`provider failed for ${platform}: ${message}`);
    }
    if (typeof variant !== "string" || variant.trim().length === 0) {
      throw new ContentError(`provider returned an empty variant for ${platform}`);
    }
    if (variant.length > limit) {
      throw new ContentError(
        `variant for ${platform} exceeds ${limit} characters (${variant.length})`,
      );
    }
    variants[platform] = variant;
  }
  return Object.freeze(variants);
}

export function withPlatformVariants(
  content: ContentItem,
  variants: Readonly<Record<string, string>>,
  updatedAt: string,
): ContentItem {
  requireNonEmpty(updatedAt, "updatedAt");
  for (const [platform, value] of Object.entries(variants)) {
    requireKnownPlatform(platform);
    if (typeof value !== "string" || value.trim().length === 0) {
      throw new ContentError(`variant for ${platform} must be a non-empty string`);
    }
  }
  return {
    ...content,
    platformVariants: Object.freeze({ ...variants }),
    updatedAt,
  };
}
