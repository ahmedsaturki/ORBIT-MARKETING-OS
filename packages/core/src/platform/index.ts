export type PlatformExtensionKind = "connector" | "agent" | "workflow" | "vertical_pack";
export type PlatformCapabilityRisk = "low" | "medium" | "high" | "critical";

export interface PlatformCapability {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly risk: PlatformCapabilityRisk;
  readonly externallyVisible: boolean;
  readonly requiredScopes: readonly string[];
}

export interface PlatformExtensionManifest {
  readonly id: string;
  readonly version: string;
  readonly name: string;
  readonly vendor: string;
  readonly kind: PlatformExtensionKind;
  readonly capabilities: readonly PlatformCapability[];
  readonly requiredPermissions: readonly string[];
  readonly minOrbitVersion: string;
  readonly enabledByDefault: boolean;
}

export type ConnectorAuthMode =
  | "official_oauth"
  | "official_token"
  | "user_authorized_browser"
  | "manual";

export interface ConnectorExtensionManifest extends PlatformExtensionManifest {
  readonly kind: "connector";
  readonly platform: string;
  readonly authModes: readonly ConnectorAuthMode[];
  readonly supportsWebhooks: boolean;
}

export interface VerticalPackManifest extends PlatformExtensionManifest {
  readonly kind: "vertical_pack";
  readonly vertical: string;
  readonly defaultPolicyPack: "conservative" | "balanced" | "agency" | "enterprise" | "regulated";
  readonly lifecycleStages: readonly string[];
  readonly objectTypes: readonly string[];
  readonly workflowIds: readonly string[];
}

export interface PlatformValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

const VERSION_PATTERN = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/;
const EXTENSION_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{1,63}$/;

function requiredText(value: string, error: string, errors: string[]): void {
  if (!value.trim()) errors.push(error);
}

function validateCapabilities(
  capabilities: readonly PlatformCapability[],
  errors: string[],
): void {
  const seen = new Set<string>();
  for (const capability of capabilities) {
    requiredText(capability.id, "capability_id_required", errors);
    requiredText(capability.title, "capability_title_required", errors);
    requiredText(capability.description, "capability_description_required", errors);
    if (!seen.add(capability.id)) errors.push("duplicate_capability");
    if (capability.requiredScopes.some((scope) => !scope.trim())) {
      errors.push("empty_capability_scope");
    }
    if (
      capability.externallyVisible &&
      capability.requiredScopes.length === 0
    ) {
      errors.push("external_capability_scope_required");
    }
  }
}

export function validatePlatformExtensionManifest(
  manifest: PlatformExtensionManifest,
): PlatformValidationResult {
  const errors: string[] = [];
  requiredText(manifest.id, "extension_id_required", errors);
  requiredText(manifest.version, "extension_version_required", errors);
  requiredText(manifest.name, "extension_name_required", errors);
  requiredText(manifest.vendor, "extension_vendor_required", errors);
  requiredText(manifest.minOrbitVersion, "min_orbit_version_required", errors);
  if (!EXTENSION_ID_PATTERN.test(manifest.id)) errors.push("extension_id_invalid");
  if (!VERSION_PATTERN.test(manifest.version)) {
    errors.push("extension_version_invalid");
  }
  if (!VERSION_PATTERN.test(manifest.minOrbitVersion)) {
    errors.push("min_orbit_version_invalid");
  }
  if (manifest.capabilities.length === 0) {
    errors.push("extension_capability_required");
  }
  if (manifest.requiredPermissions.some((permission) => !permission.trim())) {
    errors.push("empty_required_permission");
  }
  validateCapabilities(manifest.capabilities, errors);
  return { valid: errors.length === 0, errors };
}

export function validateConnectorManifest(
  manifest: ConnectorExtensionManifest,
): PlatformValidationResult {
  const errors = [...validatePlatformExtensionManifest(manifest).errors];
  requiredText(manifest.platform, "connector_platform_required", errors);
  if (manifest.authModes.length === 0) {
    errors.push("connector_auth_mode_required");
  }
  if (
    manifest.authModes.includes("user_authorized_browser") &&
    !manifest.requiredPermissions.includes("browser:authorized-session")
  ) {
    errors.push("browser_session_permission_required");
  }
  return { valid: errors.length === 0, errors };
}

export function validateVerticalPackManifest(
  manifest: VerticalPackManifest,
): PlatformValidationResult {
  const errors = [...validatePlatformExtensionManifest(manifest).errors];
  requiredText(manifest.vertical, "vertical_required", errors);
  if (manifest.lifecycleStages.length < 2) {
    errors.push("lifecycle_stage_required");
  }
  if (manifest.objectTypes.length === 0) {
    errors.push("object_type_required");
  }
  if (manifest.workflowIds.some((id) => !id.trim())) {
    errors.push("empty_workflow_id");
  }
  return { valid: errors.length === 0, errors };
}

export class PlatformRegistry {
  private readonly extensions = new Map<string, PlatformExtensionManifest>();

  public constructor(
    extensions: readonly PlatformExtensionManifest[] = [],
  ) {
    for (const extension of extensions) this.register(extension);
  }

  public register(extension: PlatformExtensionManifest): void {
    const validation = validatePlatformExtensionManifest(extension);
    if (!validation.valid) {
      throw new Error("invalid_extension:" + validation.errors.join(","));
    }
    if (this.extensions.has(extension.id)) {
      throw new Error("extension_duplicate");
    }
    this.extensions.set(extension.id, cloneManifest(extension));
  }

  public replace(extension: PlatformExtensionManifest): void {
    const validation = validatePlatformExtensionManifest(extension);
    if (!validation.valid) {
      throw new Error("invalid_extension:" + validation.errors.join(","));
    }
    this.extensions.set(extension.id, cloneManifest(extension));
  }

  public get(
    extensionId: string,
  ): PlatformExtensionManifest | undefined {
    const extension = this.extensions.get(extensionId);
    return extension ? cloneManifest(extension) : undefined;
  }

  public list(
    kind?: PlatformExtensionKind,
  ): readonly PlatformExtensionManifest[] {
    return [...this.extensions.values()]
      .filter(
        (extension) => kind === undefined || extension.kind === kind,
      )
      .map(cloneManifest)
      .sort((left, right) => left.id.localeCompare(right.id));
  }

  public remove(extensionId: string): boolean {
    return this.extensions.delete(extensionId);
  }
}

function cloneManifest(
  manifest: PlatformExtensionManifest,
): PlatformExtensionManifest {
  return {
    ...manifest,
    capabilities: manifest.capabilities.map((capability) => ({
      ...capability,
      requiredScopes: [...capability.requiredScopes],
    })),
    requiredPermissions: [...manifest.requiredPermissions],
  };
}

export function isConnectorManifest(
  manifest: PlatformExtensionManifest,
): manifest is ConnectorExtensionManifest {
  return manifest.kind === "connector";
}

export function isVerticalPackManifest(
  manifest: PlatformExtensionManifest,
): manifest is VerticalPackManifest {
  return manifest.kind === "vertical_pack";
}
