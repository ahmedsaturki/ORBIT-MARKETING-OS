import { describe, expect, it } from "vitest";
import {
  createLicenseToken,
  verifyLicenseToken,
} from "../src/licensing/license.js";

describe("offline license verification", () => {
  it("verifies a real Ed25519 signature", async () => {
    const keyPair = (await crypto.subtle.generateKey(
      { name: "Ed25519" },
      true,
      ["sign", "verify"],
    )) as CryptoKeyPair;
    const payload = {
      licenseId: "lic-1",
      plan: "pro" as const,
      subject: "customer-1",
      issuedAt: "2026-09-24T00:00:00.000Z",
      expiresAt: "2030-01-01T00:00:00.000Z",
      maxDevices: 3,
      accountLimit: 15,
      features: ["analytics"],
    };

    const publicKey = new Uint8Array(await crypto.subtle.exportKey("raw", keyPair.publicKey));
    const canonical = new TextEncoder().encode(JSON.stringify({
      licenseId: payload.licenseId,
      plan: payload.plan,
      subject: payload.subject,
      issuedAt: payload.issuedAt,
      expiresAt: payload.expiresAt,
      maxDevices: payload.maxDevices,
      accountLimit: payload.accountLimit,
      features: [...payload.features],
    }));
    const signature = new Uint8Array(await crypto.subtle.sign("Ed25519", keyPair.privateKey, canonical));
    const token = createLicenseToken(payload, signature);

    const result = await verifyLicenseToken(token, publicKey, {
      deviceCount: 2,
      accountCount: 10,
      now: new Date("2027-01-01T00:00:00.000Z"),
    });

    expect(result.valid).toBe(true);
    expect(result.reason).toBe("valid");
  });


  it("rejects a license whose expiry precedes issuance", async () => {
    const keyPair = (await crypto.subtle.generateKey(
      { name: "Ed25519" },
      true,
      ["sign", "verify"],
    )) as CryptoKeyPair;

    const payload = {
      licenseId: "lic-order",
      plan: "basic" as const,
      subject: "customer-1",
      issuedAt: "2026-09-24T00:00:00.000Z",
      expiresAt: "2026-09-23T00:00:00.000Z",
      maxDevices: 1,
      accountLimit: 1,
      features: [],
    };

    const publicKey = new Uint8Array(await crypto.subtle.exportKey("raw", keyPair.publicKey));
    const canonical = new TextEncoder().encode(JSON.stringify({
      licenseId: payload.licenseId,
      plan: payload.plan,
      subject: payload.subject,
      issuedAt: payload.issuedAt,
      expiresAt: payload.expiresAt,
      maxDevices: payload.maxDevices,
      accountLimit: payload.accountLimit,
      features: [...payload.features],
    }));
    const signature = new Uint8Array(await crypto.subtle.sign("Ed25519", keyPair.privateKey, canonical));
    const token = createLicenseToken(payload, signature);

    const result = await verifyLicenseToken(token, publicKey, {
      deviceCount: 1,
      accountCount: 1,
      now: new Date("2026-09-24T00:00:00.000Z"),
    });
    expect(result).toMatchObject({ valid: false, reason: "malformed" });
  });

  it("rejects licenses with invalid dates or future issue times", async () => {
    const keyPair = (await crypto.subtle.generateKey(
      { name: "Ed25519" },
      true,
      ["sign", "verify"],
    )) as CryptoKeyPair;

    const payload = {
      licenseId: "lic-invalid",
      plan: "basic" as const,
      subject: "customer-1",
      issuedAt: "not-a-date",
      expiresAt: "not-a-date",
      maxDevices: 1,
      accountLimit: 1,
      features: [],
    };

    const publicKey = new Uint8Array(await crypto.subtle.exportKey("raw", keyPair.publicKey));
    const canonical = new TextEncoder().encode(JSON.stringify({
      licenseId: payload.licenseId,
      plan: payload.plan,
      subject: payload.subject,
      issuedAt: payload.issuedAt,
      expiresAt: payload.expiresAt,
      maxDevices: payload.maxDevices,
      accountLimit: payload.accountLimit,
      features: [...payload.features],
    }));
    const signature = new Uint8Array(await crypto.subtle.sign("Ed25519", keyPair.privateKey, canonical));
    const token = createLicenseToken(payload, signature);

    await expect(verifyLicenseToken(token, publicKey, {
      deviceCount: 1,
      accountCount: 1,
      now: new Date("2026-09-24T00:00:00.000Z"),
    })).resolves.toMatchObject({ valid: false, reason: "malformed" });
  });

  it("rejects tokens with extra segments", async () => {
    const result = await verifyLicenseToken("a.b.c", new Uint8Array(32), {
      deviceCount: 0,
      accountCount: 0,
    });
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("malformed");
  });

  it("rejects an expired license", async () => {
    const keyPair = (await crypto.subtle.generateKey(
      { name: "Ed25519" },
      true,
      ["sign", "verify"],
    )) as CryptoKeyPair;
    const payload = {
      licenseId: "lic-2",
      plan: "basic" as const,
      subject: "customer-1",
      issuedAt: "2025-01-01T00:00:00.000Z",
      expiresAt: "2025-01-02T00:00:00.000Z",
      maxDevices: 1,
      accountLimit: 5,
      features: [],
    };
    const publicKey = new Uint8Array(await crypto.subtle.exportKey("raw", keyPair.publicKey));
    const canonical = new TextEncoder().encode(JSON.stringify({
      licenseId: payload.licenseId,
      plan: payload.plan,
      subject: payload.subject,
      issuedAt: payload.issuedAt,
      expiresAt: payload.expiresAt,
      maxDevices: payload.maxDevices,
      accountLimit: payload.accountLimit,
      features: [...payload.features],
    }));
    const signature = new Uint8Array(await crypto.subtle.sign("Ed25519", keyPair.privateKey, canonical));
    const token = createLicenseToken(payload, signature);

    const result = await verifyLicenseToken(token, publicKey, {
      deviceCount: 1,
      accountCount: 1,
      now: new Date("2026-01-01T00:00:00.000Z"),
    });

    expect(result.valid).toBe(false);
    expect(result.reason).toBe("expired");
  });
});
