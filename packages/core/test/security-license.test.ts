import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  issueLicense,
  LicenseError,
  verifyLicense,
  type LicenseClaims,
} from "../src/security/index.js";

const SECRET = "license-signing-secret-do-not-leak";
const NOW = "2026-09-24T12:00:00.000Z";

const CLAIMS: LicenseClaims = {
  licensee: "Orbit Labs",
  tier: "pro",
  issuedAt: "2026-01-01T00:00:00.000Z",
  expiresAt: "2027-01-01T00:00:00.000Z",
  seats: 5,
};

function resign(payloadJson: string): string {
  const payload = Buffer.from(payloadJson, "utf8").toString("base64url");
  const sig = createHmac("sha256", SECRET).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

describe("license tamper detection (SEC-04)", () => {
  it("verifies a freshly issued license", () => {
    const token = issueLicense(CLAIMS, SECRET);
    const result = verifyLicense(token, SECRET, NOW);
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.claims.licensee).toBe("Orbit Labs");
      expect(result.claims.tier).toBe("pro");
      expect(result.claims.seats).toBe(5);
    }
  });

  it("rejects a mutated payload (tier/seat upgrade forgery)", () => {
    const token = issueLicense(CLAIMS, SECRET);
    const [payload, sig] = token.split(".") as [string, string];
    const original = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as Record<string, unknown>;
    // Attacker upgrades tier/seats but has no secret, so keeps the original sig.
    const forgedPayload = Buffer.from(
      JSON.stringify({ ...original, tier: "enterprise", seats: 9999 }),
      "utf8",
    ).toString("base64url");
    const forged = `${forgedPayload}.${sig}`;
    expect(verifyLicense(forged, SECRET, NOW)).toEqual({
      valid: false,
      reason: "bad_signature",
    });
  });

  it("rejects a bit-flipped payload", () => {
    const token = issueLicense(CLAIMS, SECRET);
    const [payload, sig] = token.split(".") as [string, string];
    const bytes = Buffer.from(payload, "base64url");
    bytes[0] = bytes[0]! ^ 0x01;
    const flipped = `${bytes.toString("base64url")}.${sig}`;
    expect(verifyLicense(flipped, SECRET, NOW)).toEqual({
      valid: false,
      reason: "bad_signature",
    });
  });

  it("rejects a license signed with the wrong secret", () => {
    const token = issueLicense(CLAIMS, "attacker-guess");
    expect(verifyLicense(token, SECRET, NOW)).toEqual({
      valid: false,
      reason: "bad_signature",
    });
  });

  it("rejects a token spliced from two different licenses", () => {
    const a = issueLicense(CLAIMS, SECRET);
    const b = issueLicense(
      { ...CLAIMS, licensee: "Someone Else" },
      SECRET,
    );
    const spliced = `${a.split(".")[0]}.${b.split(".")[1]}`;
    expect(verifyLicense(spliced, SECRET, NOW).valid).toBe(false);
  });

  it("rejects expired and not-yet-valid licenses", () => {
    const token = issueLicense(CLAIMS, SECRET);
    expect(verifyLicense(token, SECRET, "2027-06-01T00:00:00.000Z")).toEqual({
      valid: false,
      reason: "expired",
    });
    expect(verifyLicense(token, SECRET, "2025-06-01T00:00:00.000Z")).toEqual({
      valid: false,
      reason: "not_yet_valid",
    });
  });

  it("rejects malformed tokens fail-closed", () => {
    const cases = ["", "no-dot", ".", "a.", ".b", "a.b.c", "!!.!!"];
    for (const token of cases) {
      const result = verifyLicense(token, SECRET, NOW);
      expect(result.valid).toBe(false);
    }
    expect(verifyLicense(issueLicense(CLAIMS, SECRET), "", NOW)).toEqual({
      valid: false,
      reason: "malformed",
    });
    expect(
      verifyLicense(issueLicense(CLAIMS, SECRET), SECRET, "not-a-date"),
    ).toEqual({ valid: false, reason: "malformed" });
  });

  it("rejects correctly-signed but semantically invalid claims", () => {
    // Simulates an issuer bug: signature is valid, claims are not.
    const signedGarbage = resign(JSON.stringify({ tier: "enterprise" }));
    expect(verifyLicense(signedGarbage, SECRET, NOW)).toEqual({
      valid: false,
      reason: "invalid_claims",
    });

    const signedUnknownKey = resign(
      JSON.stringify({ ...CLAIMS, admin: true }),
    );
    expect(verifyLicense(signedUnknownKey, SECRET, NOW)).toEqual({
      valid: false,
      reason: "invalid_claims",
    });

    const signedBadSeats = resign(
      JSON.stringify({ ...CLAIMS, seats: -3 }),
    );
    expect(verifyLicense(signedBadSeats, SECRET, NOW)).toEqual({
      valid: false,
      reason: "invalid_claims",
    });
  });

  it("refuses to issue with invalid claims or empty secret", () => {
    expect(() => issueLicense(CLAIMS, "")).toThrow(LicenseError);
    expect(() =>
      issueLicense({ ...CLAIMS, licensee: " " }, SECRET),
    ).toThrow(LicenseError);
    expect(() =>
      issueLicense({ ...CLAIMS, tier: "ultimate" as never }, SECRET),
    ).toThrow(LicenseError);
    expect(() =>
      issueLicense({ ...CLAIMS, issuedAt: "garbage" }, SECRET),
    ).toThrow(LicenseError);
    expect(() =>
      issueLicense(
        { ...CLAIMS, issuedAt: NOW, expiresAt: NOW },
        SECRET,
      ),
    ).toThrow(/expiresAt must be after/);
  });

  it("is deterministic: same claims and secret produce the same token", () => {
    expect(issueLicense(CLAIMS, SECRET)).toBe(issueLicense(CLAIMS, SECRET));
  });
});
