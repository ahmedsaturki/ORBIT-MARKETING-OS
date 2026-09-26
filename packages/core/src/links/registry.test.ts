import { describe, expect, it } from "vitest";
import {
  buildTrackedUrl,
  createLinkRecord,
  normalizeDestinationUrl,
} from "./registry.js";

describe("link intelligence registry", () => {
  it("normalizes supported destination URLs deterministically", () => {
    expect(
      normalizeDestinationUrl(
        "HTTPS://Example.COM:443/path?b=2&a=1#tracking-fragment",
      ),
    ).toBe("https://example.com/path?a=1&b=2");
  });

  it("rejects unsupported destination protocols", () => {
    expect(() => normalizeDestinationUrl("javascript:alert(1)")).toThrow(
      "must use http or https",
    );
  });

  it("adds only explicit UTM values and preserves existing query parameters", () => {
    const tracked = buildTrackedUrl({
      destinationUrl: "https://example.com/landing?ref=orbit",
      source: "linkedin",
      medium: "social",
      campaign: "q4-launch",
      content: "hero-01",
      term: null,
    });

    expect(tracked).toBe(
      "https://example.com/landing?ref=orbit&utm_campaign=q4-launch&utm_content=hero-01&utm_medium=social&utm_source=linkedin",
    );
  });

  it("creates the same local key for the same canonical record", () => {
    const input = {
      destinationUrl: "https://example.com/offer?b=2&a=1",
      campaignId: "cmp-001",
      contentId: "content-001",
      source: "facebook",
      medium: "social",
      campaign: "spring",
    };

    expect(createLinkRecord(input)).toEqual(createLinkRecord(input));
    expect(createLinkRecord(input).provenance).toBe("local");
    expect(createLinkRecord(input).key).toMatch(/^lnk_[0-9a-f]{8}$/);
  });

  it("changes the identity when campaign/content context changes", () => {
    const base = createLinkRecord({
      destinationUrl: "https://example.com/offer",
      campaignId: "cmp-001",
      contentId: "content-001",
    });
    const changed = createLinkRecord({
      destinationUrl: "https://example.com/offer",
      campaignId: "cmp-002",
      contentId: "content-001",
    });

    expect(changed.key).not.toBe(base.key);
  });
});
