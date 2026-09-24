import type {
  ConnectorCapability,
  ConnectorDescriptor,
  ConnectorResult,
} from "../types/index.js";

/**
 * Capability handshake: a connector can only be trusted for capabilities
 * it explicitly declares AND that the runtime confirms it implements.
 */
export function handshake(
  declared: ConnectorDescriptor,
  implemented: readonly ConnectorCapability[],
): ConnectorResult<readonly ConnectorCapability[]> {
  const unsupported = declared.capabilities.filter((c) => !implemented.includes(c));
  if (unsupported.length > 0) {
    return {
      ok: false,
      error: `Declared capabilities not implemented: ${unsupported.join(", ")}`,
      requiresIntervention: true,
    };
  }
  return { ok: true, data: declared.capabilities };
}

export function executeCapability(
  descriptor: ConnectorDescriptor,
  confirmed: readonly ConnectorCapability[],
  capability: ConnectorCapability,
  run: () => ConnectorResult,
): ConnectorResult {
  if (!confirmed.includes(capability) || !descriptor.capabilities.includes(capability)) {
    return {
      ok: false,
      error: `Capability "${capability}" is not available on connector "${descriptor.id}"`,
      requiresIntervention: false,
    };
  }
  try {
    return run();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message, requiresIntervention: true };
  }
}

export type ChallengeKind = "captcha" | "login_required" | "two_factor" | "unknown_checkpoint";

export interface ChallengeDetection {
  readonly kind: ChallengeKind;
  readonly detected: boolean;
  readonly selectorHint?: string;
}

/**
 * Unknown or changing UI states must fail closed and request intervention.
 */
export function handleChallenge(detection: ChallengeDetection): ConnectorResult<never> {
  if (!detection.detected) {
    return { ok: false, error: "no_challenge", requiresIntervention: false };
  }
  return {
    ok: false,
    error: `Challenge detected (${detection.kind}); automation stopped safely`,
    requiresIntervention: true,
  };
}
