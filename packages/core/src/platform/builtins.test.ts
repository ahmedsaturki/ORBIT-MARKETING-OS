import { describe, expect, it } from "vitest";
import {
  BUILT_IN_CONNECTOR_MANIFESTS,
  BUILT_IN_PLATFORM_MANIFESTS,
  BUILT_IN_VERTICAL_PACKS,
} from "./builtins.js";
import {
  PlatformRegistry,
  validateConnectorManifest,
  validateVerticalPackManifest,
} from "./index.js";

describe("platform built-ins", () => {
  it("keeps current real connector capability contracts explicit", () => {
    expect(BUILT_IN_CONNECTOR_MANIFESTS.map((item) => item.platform)).toEqual([
      "telegram",
      "linkedin",
    ]);
    for (const manifest of BUILT_IN_CONNECTOR_MANIFESTS) {
      expect(validateConnectorManifest(manifest).valid).toBe(true);
    }
  });

  it("provides reusable vertical operating packs", () => {
    expect(BUILT_IN_VERTICAL_PACKS).toHaveLength(5);
    for (const manifest of BUILT_IN_VERTICAL_PACKS) {
      expect(validateVerticalPackManifest(manifest).valid).toBe(true);
      expect(manifest.enabledByDefault).toBe(false);
    }
  });

  it("registers built-ins deterministically without granting execution authority", () => {
    const registry = new PlatformRegistry(BUILT_IN_PLATFORM_MANIFESTS);
    expect(registry.list().map((item) => item.id)).toEqual([
      "connector.linkedin",
      "connector.telegram",
      "vertical.agency",
      "vertical.b2b",
      "vertical.creator",
      "vertical.ecommerce",
      "vertical.real-estate",
    ]);
  });
});
