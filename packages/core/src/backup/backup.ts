import type { EncryptedPayload } from "../security/aesGcm.js";
import { decryptAes256Gcm, encryptAes256Gcm } from "../security/aesGcm.js";

export interface BackupEnvelope {
  readonly version: 1;
  readonly createdAt: string;
  readonly data: EncryptedPayload;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

/**
 * Encrypt an opaque database/media snapshot before it leaves the local runtime.
 */
export async function createEncryptedBackup(
  data: Uint8Array,
  key: CryptoKey,
  createdAt = new Date().toISOString(),
): Promise<BackupEnvelope> {
  const encrypted = await encryptAes256Gcm(bytesToBase64(data), key);
  return {
    version: 1,
    createdAt,
    data: encrypted,
  };
}

/**
 * Restore an encrypted backup only after successful authenticated decryption.
 */
export async function restoreEncryptedBackup(
  envelope: BackupEnvelope,
  key: CryptoKey,
): Promise<Uint8Array> {
  if (envelope.version !== 1) throw new TypeError("Unsupported backup version");
  const decoded = await decryptAes256Gcm(envelope.data, key);
  return base64ToBytes(decoded);
}
