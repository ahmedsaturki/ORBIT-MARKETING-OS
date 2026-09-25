import type { ConnectorResult } from "../types/index.js";

export type ChallengeKind =
  "captcha" | "login_required" | "two_factor" | "unknown_checkpoint";

export interface ChallengeDetection {
  readonly kind: ChallengeKind;
  readonly detected: boolean;
  readonly selectorHint?: string;
}

/**
 * Any detected authentication/challenge state is a hard stop.
 * A clean page is explicitly non-intervention and is safe to continue.
 */
export function handleChallenge(
  detection: ChallengeDetection,
): ConnectorResult<never> {
  if (!detection.detected) {
    return {
      ok: false,
      error: "no_challenge",
      requiresIntervention: false,
    };
  }

  return {
    ok: false,
    error: `Challenge detected (${detection.kind}); automation stopped safely`,
    requiresIntervention: true,
  };
}
