import type { LicensePayload } from "./license.js";
import { createLicenseToken } from "./license.js";

export async function issueLicenseToken(
  payload: LicensePayload,
  privateKeyPkcs8: ArrayBuffer,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    "pkcs8",
    privateKeyPkcs8,
    { name: "Ed25519" },
    false,
    ["sign"],
  );
  const message = new TextEncoder().encode(
    JSON.stringify({
      licenseId: payload.licenseId,
      plan: payload.plan,
      subject: payload.subject,
      issuedAt: payload.issuedAt,
      expiresAt: payload.expiresAt ?? null,
      maxDevices: payload.maxDevices,
      accountLimit: payload.accountLimit,
      features: [...payload.features],
    }),
  );
  const signature = new Uint8Array(
    await crypto.subtle.sign("Ed25519", key, message),
  );
  return createLicenseToken(payload, signature);
}
