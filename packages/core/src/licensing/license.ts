export type LicensePlan = "basic" | "pro" | "agency" | "lifetime";

export interface LicensePayload {
  readonly licenseId: string;
  readonly plan: LicensePlan;
  readonly subject: string;
  readonly issuedAt: string;
  readonly expiresAt?: string;
  readonly maxDevices: number;
  readonly accountLimit: number;
  readonly features: readonly string[];
}

export interface LicenseToken {
  readonly payload: LicensePayload;
  readonly signature: string;
}

const textEncoder = new TextEncoder();

function isNonEmptyBoundedString(value: unknown, maxLength: number): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= maxLength;
}

function isFiniteNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function validatePayload(payload: LicensePayload): void {
  if (!isNonEmptyBoundedString(payload.licenseId, 200)) throw new Error("Invalid license payload");
  if (!isNonEmptyBoundedString(payload.subject, 200)) throw new Error("Invalid license payload");
  if (!["basic", "pro", "agency", "lifetime"].includes(payload.plan)) throw new Error("Invalid license payload");
  if (!isNonEmptyBoundedString(payload.issuedAt, 100) || Number.isNaN(Date.parse(payload.issuedAt))) {
    throw new Error("Invalid license payload");
  }
  if (payload.expiresAt !== undefined && (typeof payload.expiresAt !== "string" || Number.isNaN(Date.parse(payload.expiresAt)))) {
    throw new Error("Invalid license payload");
  }
  if (!isFiniteNonNegativeInteger(payload.maxDevices) || payload.maxDevices < 1) {
    throw new Error("Invalid license payload");
  }
  if (!isFiniteNonNegativeInteger(payload.accountLimit) || payload.accountLimit < 1) {
    throw new Error("Invalid license payload");
  }
  if (
    !Array.isArray(payload.features) ||
    payload.features.length > 100 ||
    payload.features.some((feature) => !isNonEmptyBoundedString(feature, 100))
  ) {
    throw new Error("Invalid license payload");
  }
}


function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

function base64UrlToBytes(value: string): Uint8Array {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function encodeJson(value: unknown): string {
  return bytesToBase64Url(textEncoder.encode(JSON.stringify(value)));
}

function decodeJson<T>(value: string): T {
  return JSON.parse(new TextDecoder().decode(base64UrlToBytes(value))) as T;
}

function serializePayload(payload: LicensePayload): Uint8Array {
  const canonical = JSON.stringify({
    licenseId: payload.licenseId,
    plan: payload.plan,
    subject: payload.subject,
    issuedAt: payload.issuedAt,
    expiresAt: payload.expiresAt ?? null,
    maxDevices: payload.maxDevices,
    accountLimit: payload.accountLimit,
    features: [...payload.features],
  });
  return textEncoder.encode(canonical);
}

export function createLicenseMessage(payload: LicensePayload): string {
  return encodeJson({
    licenseId: payload.licenseId,
    plan: payload.plan,
    subject: payload.subject,
    issuedAt: payload.issuedAt,
    expiresAt: payload.expiresAt ?? null,
    maxDevices: payload.maxDevices,
    accountLimit: payload.accountLimit,
    features: [...payload.features],
  });
}

export function createLicenseToken(
  payload: LicensePayload,
  signatureBytes: Uint8Array,
): string {
  return createLicenseMessage(payload) + "." + bytesToBase64Url(signatureBytes);
}

export function parseLicenseToken(token: string): LicenseToken {
  const parts = token.split(".");
  if (parts.length !== 2) throw new Error("Invalid license token");
  const [payloadPart, signaturePart] = parts;
  if (!payloadPart || !signaturePart) throw new Error("Invalid license token");

  const payload = decodeJson<LicensePayload>(payloadPart);
  validatePayload(payload);

  return {
    payload,
    signature: signaturePart,
  };
}

export interface LicenseVerification {
  readonly valid: boolean;
  readonly reason:
    | "valid"
    | "malformed"
    | "bad_signature"
    | "expired"
    | "device_limit"
    | "account_limit";
  readonly payload?: LicensePayload;
}

export async function verifyLicenseToken(
  token: string,
  publicKeyBytes: Uint8Array,
  context: { readonly deviceCount: number; readonly accountCount: number; readonly now?: Date },
): Promise<LicenseVerification> {
  let parsed: LicenseToken;
  try {
    parsed = parseLicenseToken(token);
  } catch {
    return { valid: false, reason: "malformed" };
  }

  try {
    validatePayload(parsed.payload);
    const key = await crypto.subtle.importKey(
      "raw",
      publicKeyBytes,
      { name: "Ed25519" },
      false,
      ["verify"],
    );
    const signatureValid = await crypto.subtle.verify(
      { name: "Ed25519" },
      key,
      base64UrlToBytes(parsed.signature),
      serializePayload(parsed.payload),
    );
    if (!signatureValid) return { valid: false, reason: "bad_signature" };
  } catch {
    return { valid: false, reason: "bad_signature" };
  }

  const now = context.now ?? new Date();
  const issuedAt = new Date(parsed.payload.issuedAt);
  if (issuedAt.getTime() > now.getTime()) {
    return { valid: false, reason: "malformed", payload: parsed.payload };
  }
  if (parsed.payload.expiresAt && new Date(parsed.payload.expiresAt).getTime() < now.getTime()) {
    return { valid: false, reason: "expired", payload: parsed.payload };
  }
  if (context.deviceCount > parsed.payload.maxDevices) {
    return { valid: false, reason: "device_limit", payload: parsed.payload };
  }
  if (context.accountCount > parsed.payload.accountLimit) {
    return { valid: false, reason: "account_limit", payload: parsed.payload };
  }

  return { valid: true, reason: "valid", payload: parsed.payload };
}
