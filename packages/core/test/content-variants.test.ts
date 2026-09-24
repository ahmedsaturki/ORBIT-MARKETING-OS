import { describe, expect, it } from "vitest";
import type { ContentItem } from "../src/types/index.js";
import {
  ContentError,
  generatePlatformVariants,
  PLATFORM_VARIANT_LIMITS,
  withPlatformVariants,
  type VariantProvider,
  type VariantRequest,
} from "../src/content/variants.js";

const SOURCE = {
  id: "content-1",
  workspaceId: "ws1",
  title: "Ramadan offer",
  body: "50% off all bundles until Friday. Order now!",
};

/** Deterministic local fixture standing in for the AI provider (no API key). */
const fixtureProvider: VariantProvider = {
  id: "fixture-local",
  async generateVariant(request: VariantRequest): Promise<string> {
    const limit = PLATFORM_VARIANT_LIMITS[request.platform]!;
    const raw = `(${request.platform}) ${request.title}: ${request.body}`;
    return raw.slice(0, limit);
  },
};

const overLimitProvider: VariantProvider = {
  id: "fixture-over",
  async generateVariant(request: VariantRequest): Promise<string> {
    return "x".repeat(PLATFORM_VARIANT_LIMITS[request.platform]! + 1);
  },
};

const emptyProvider: VariantProvider = {
  id: "fixture-empty",
  async generateVariant(): Promise<string> {
    return "   ";
  },
};

const failingProvider: VariantProvider = {
  id: "fixture-failing",
  async generateVariant(): Promise<string> {
    throw new Error("quota exceeded");
  },
};

const CONTENT: ContentItem = {
  id: "content-1",
  workspaceId: "ws1",
  title: "Ramadan offer",
  body: "50% off all bundles until Friday. Order now!",
  platformVariants: {},
  approvalStatus: "draft",
  tags: ["promo"],
  createdAt: "2026-09-24T10:00:00.000Z",
  updatedAt: "2026-09-24T10:00:00.000Z",
};

describe("content variants via local provider fixture (CONT-01)", () => {
  it("generates one bounded variant per platform", async () => {
    const variants = await generatePlatformVariants(
      SOURCE,
      ["twitter", "instagram", "telegram"],
      fixtureProvider,
    );
    expect(Object.keys(variants).sort()).toEqual([
      "instagram",
      "telegram",
      "twitter",
    ]);
    expect(variants.twitter!.startsWith("(twitter)")).toBe(true);
    expect(variants.instagram!.startsWith("(instagram)")).toBe(true);
    expect(variants.twitter!.length).toBeLessThanOrEqual(
      PLATFORM_VARIANT_LIMITS.twitter!,
    );
    expect(variants.instagram!.length).toBeLessThanOrEqual(
      PLATFORM_VARIANT_LIMITS.instagram!,
    );
    expect(Object.isFrozen(variants)).toBe(true);
  });

  it("applies generated variants onto a content item", async () => {
    const variants = await generatePlatformVariants(
      SOURCE,
      ["twitter"],
      fixtureProvider,
    );
    const updated = withPlatformVariants(
      CONTENT,
      variants,
      "2026-09-24T11:00:00.000Z",
    );
    expect(updated.platformVariants.twitter).toContain("(twitter)");
    expect(updated.updatedAt).toBe("2026-09-24T11:00:00.000Z");
    expect(updated.approvalStatus).toBe("draft");
    expect(updated.id).toBe(CONTENT.id);
    expect(Object.isFrozen(updated.platformVariants)).toBe(true);
  });

  it("fails closed when the provider errors", async () => {
    await expect(
      generatePlatformVariants(SOURCE, ["twitter"], failingProvider),
    ).rejects.toThrow(/provider failed for twitter: quota exceeded/);
  });

  it("rejects over-limit variants", async () => {
    await expect(
      generatePlatformVariants(SOURCE, ["twitter"], overLimitProvider),
    ).rejects.toThrow(/exceeds 280 characters/);
  });

  it("rejects empty variants", async () => {
    await expect(
      generatePlatformVariants(SOURCE, ["twitter"], emptyProvider),
    ).rejects.toThrow(/empty variant/);
  });

  it("rejects unknown, duplicate, and empty platform lists", async () => {
    await expect(
      generatePlatformVariants(SOURCE, ["myspace"], fixtureProvider),
    ).rejects.toThrow(/unknown platform: myspace/);
    await expect(
      generatePlatformVariants(SOURCE, ["twitter", "twitter"], fixtureProvider),
    ).rejects.toThrow(/duplicate platforms/);
    await expect(
      generatePlatformVariants(SOURCE, [], fixtureProvider),
    ).rejects.toThrow(/at least one platform/);
  });

  it("fails closed on malformed source content", async () => {
    await expect(
      generatePlatformVariants(
        { ...SOURCE, title: " " },
        ["twitter"],
        fixtureProvider,
      ),
    ).rejects.toThrow(/title/);
    await expect(
      generatePlatformVariants(
        { ...SOURCE, workspaceId: "" },
        ["twitter"],
        fixtureProvider,
      ),
    ).rejects.toThrow(/workspace id/);
    await expect(
      generatePlatformVariants(SOURCE, ["twitter"], {
        id: "",
        generateVariant: async () => "ok",
      }),
    ).rejects.toThrow(/provider id/);
  });

  it("rejects invalid variants when applying them to content", () => {
    expect(() =>
      withPlatformVariants(CONTENT, { myspace: "hi" }, "2026-09-24T11:00:00.000Z"),
    ).toThrow(ContentError);
    expect(() =>
      withPlatformVariants(CONTENT, { twitter: " " }, "2026-09-24T11:00:00.000Z"),
    ).toThrow(/non-empty string/);
    expect(() => withPlatformVariants(CONTENT, {}, "")).toThrow(/updatedAt/);
  });
});
