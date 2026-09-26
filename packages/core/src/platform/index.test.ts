import { describe, expect, it } from "vitest";
import {
  PlatformRegistry,
  isConnectorManifest,
  isVerticalPackManifest,
  validateConnectorManifest,
  validatePlatformExtensionManifest,
  validateVerticalPackManifest,
  type ConnectorExtensionManifest,
  type VerticalPackManifest,
} from "./index.js";

function capability() {
  return {
    id: "content.publish",
    title: "Publish content",
    description: "Publish already-approved content.",
    risk: "high" as const,
    externallyVisible: true,
    requiredScopes: ["content:publish"],
  };
}

function connector(): ConnectorExtensionManifest {
  return {
    id: "connector.linkedin",
    version: "1.0.0",
    name: "LinkedIn",
    vendor: "ORBIT",
    kind: "connector",
    platform: "linkedin",
    authModes: ["official_oauth"],
    supportsWebhooks: false,
    capabilities: [capability()],
    requiredPermissions: ["connector:execute"],
    minOrbitVersion: "0.2.0",
    enabledByDefault: false,
  };
}

function verticalPack(): VerticalPackManifest {
  return {
    id: "vertical.real-estate",
    version: "1.0.0",
    name: "Real Estate",
    vendor: "ORBIT",
    kind: "vertical_pack",
    vertical: "real_estate",
    defaultPolicyPack: "balanced",
    lifecycleStages: ["lead", "qualified", "opportunity", "won"],
    objectTypes: ["contact", "property", "opportunity"],
    workflowIds: ["lead.follow_up", "opportunity.nurture"],
    capabilities: [
      {
        id: "vertical.templates",
        title: "Vertical templates",
        description: "Expose structured real-estate operating templates.",
        risk: "low",
        externallyVisible: false,
        requiredScopes: ["vertical:read"],
      },
    ],
    requiredPermissions: ["vertical:read"],
    minOrbitVersion: "0.2.0",
    enabledByDefault: false,
  };
}

describe("platform foundation", () => {
  it("validates extension, connector, and vertical manifests", () => {
    expect(validatePlatformExtensionManifest(connector()).valid).toBe(true);
    expect(validateConnectorManifest(connector()).valid).toBe(true);
    expect(validateVerticalPackManifest(verticalPack()).valid).toBe(true);
  });

  it("requires explicit permissions for externally visible capabilities", () => {
    const invalid = {
      ...connector(),
      capabilities: [{ ...capability(), requiredScopes: [] }],
    };
    expect(validateConnectorManifest(invalid).errors).toContain(
      "external_capability_scope_required",
    );
  });

  it("requires explicit browser-session permission for browser connectors", () => {
    const invalid = {
      ...connector(),
      authModes: ["user_authorized_browser"] as const,
      requiredPermissions: ["connector:execute"],
    };
    expect(validateConnectorManifest(invalid).errors).toContain(
      "browser_session_permission_required",
    );
  });

  it("enforces registry uniqueness and defensive reads", () => {
    const registry = new PlatformRegistry([connector(), verticalPack()]);
    expect(registry.list().map((extension) => extension.id)).toEqual([
      "connector.linkedin",
      "vertical.real-estate",
    ]);
    expect(registry.list("connector").map((extension) => extension.id)).toEqual([
      "connector.linkedin",
    ]);
    expect(isConnectorManifest(registry.get("connector.linkedin")!)).toBe(true);
    expect(isVerticalPackManifest(registry.get("vertical.real-estate")!)).toBe(
      true,
    );
    expect(() => registry.register(connector())).toThrow("extension_duplicate");

    const loaded = registry.get(
      "connector.linkedin",
    ) as ConnectorExtensionManifest;
    const scopes = [...loaded.capabilities[0]!.requiredScopes];
    scopes.push("mutated");
    expect(
      (registry.get("connector.linkedin") as ConnectorExtensionManifest)
        .capabilities[0]!.requiredScopes,
    ).toEqual(["content:publish"]);
  });
});
