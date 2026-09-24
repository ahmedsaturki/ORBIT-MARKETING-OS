import { createHmac, timingSafeEqual } from "node:crypto";

export type LicenseTier = "basic" | "pro" | "enterprise";

export interface LicenseClaims {
  readonly licensee: string;
  readonly tier: LicenseTier;
  readonly issuedAt: string;
  readonly expiresAt?: string;
  readonly seats?: number;
}

export type LicenseFailureReason =
  | "malformed"
  | "bad_signature"
  | "expired"
  | "not_yet_valid"
  | "invalid_claims";

export type LicenseVerification =
  | { readonly valid: true; readonly claims: LicenseClaims }
  | { readonly valid: false; readonly reason: LicenseFailureReason };

export class LicenseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LicenseError";
  }
}

const TIERS: readonly LicenseTier[] = ["basic", "pro", "enterprise"];
const CLAIM_KEYS = [
  "licensee",
  "tier",
  "issuedAt",
  "expiresAt",
  "seats",
] as const;

function requireNonEmpty(value: string, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new LicenseError(`${field} must be a non-empty string`);
  }
  return value;
}

function isValidDate(value: string): boolean {
  const ms = Date.parse(value);
  return Number.isFinite(ms);
}

function canonicalize(claims: LicenseClaims): string {
  const out: Record<string, unknown> = {};
  for (const key of [...CLAIM_KEYS].sort()) {
    const value = claims[key];
    if (value !== undefined) out[key] = value;
  }
  return JSON.stringify(out);
}

function parseClaims(raw: unknown): LicenseClaims | null {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }
  const obj = raw as Record<string, unknown>;
  for (const key of Object.keys(obj)) {
    if (!(CLAIM_KEYS as readonly string[]).includes(key)) return null;
  }
  const { licensee, tier, issuedAt, expiresAt, seats } = obj;
  if (typeof licensee !== "string" || licensee.trim().length === 0) return null;
  if (typeof tier !== "string" || !TIERS.includes(tier as LicenseTier)) {
    return null;
  }
  if (typeof issuedAt !== "string" || !isValidDate(issuedAt)) return null;
  if (expiresAt !== undefined) {
    if (typeof expiresAt !== "string" || !isValidDate(expiresAt)) return null;
  }
  if (seats !== undefined) {
    if (typeof seats !== "number" || !Number.isInteger(seats) || seats < 1) {
      return null;
    }
  }
  return {
    licensee,
    tier: tier as LicenseTier,
    issuedAt,
    ...(expiresAt !== undefined ? { expiresAt } : {}),
    ...(seats !== undefined ? { seats } : {}),
  };
}

function sign(payload: string, secret: string): Buffer {
  return createHmac("sha256", secret).update(payload).digest();
}

export function issueLicense(
  claims: LicenseClaims,
  secret: string,
): string {
  requireNonEmpty(secret, "license secret");
  const parsed = parseClaims(claims);
  if (!parsed) {
    throw new LicenseError("invalid license claims");
  }
  if (parsed.expiresAt !== undefined) {
    if (Date.parse(parsed.expiresAt) <= Date.parse(parsed.issuedAt)) {
      throw new LicenseError("expiresAt must be after issuedAt");
    }
  }
  const payload = Buffer.from(canonicalize(parsed), "utf8").toString(
    "base64url",
  );
  const signature = sign(payload, secret).toString("base64url");
  return `${payload}.${signature}`;
}

export function verifyLicense(
  token: string,
  secret: string,
  now: string,
): LicenseVerification {
  if (
    typeof token !== "string" ||
    typeof secret !== "string" ||
    secret.length === 0 ||
    typeof now !== "string" ||
    !isValidDate(now)
  ) {
    return { valid: false, reason: "malformed" };
  }
  const parts = token.split(".");
  if (parts.length !== 2 || parts[0].length === 0 || parts[1].length === 0) {
    return { valid: false, reason: "malformed" };
  }
  const [payload, provided] = parts;
  const expected = sign(payload, secret);
  let providedBuf: Buffer;
  try {
    providedBuf = Buffer.from(provided, "base64url");
  } catch {
    return { valid: false, reason: "bad_signature" };
  }
  if (
    providedBuf.length !== expected.length ||
    !timingSafeEqual(providedBuf, expected)
  ) {
    return { valid: false, reason: "bad_signature" };
  }

  let claims: LicenseClaims | null;
  try {
    claims = parseClaims(JSON.parse(Buffer.from(payload, "base64url").toString("utf8")));
  } catch {
    return { valid: false, reason: "malformed" };
  }
  if (!claims) {
    return { valid: false, reason: "invalid_claims" };
  }

  const nowMs = Date.parse(now);
  if (Date.parse(claims.issuedAt) > nowMs) {
    return { valid: false, reason: "not_yet_valid" };
  }
  if (claims.expiresAt !== undefined && Date.parse(claims.expiresAt) < nowMs) {
    return { valid: false, reason: "expired" };
  }
  return { valid: true, claims };
}
