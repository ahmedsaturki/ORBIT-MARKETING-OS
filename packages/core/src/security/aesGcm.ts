export interface EncryptedPayload {
  readonly version: 1;
  readonly algorithm: "AES-256-GCM";
  readonly iv: string;
  readonly ciphertext: string;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function assertKey(key: CryptoKey): void {
  if (key.algorithm.name !== "AES-GCM") {
    throw new TypeError("AES-GCM key required");
  }
  const length = (key.algorithm as AesKeyAlgorithm).length;
  if (length !== 256) {
    throw new TypeError("AES-256 key required");
  }
}

/**
 * Encrypt UTF-8 data with an authenticated AES-256-GCM key.
 *
 * Key derivation is intentionally outside this module so platform-specific
 * implementations can provide Argon2id without duplicating cipher code.
 */
export async function encryptAes256Gcm(
  plaintext: string,
  key: CryptoKey,
): Promise<EncryptedPayload> {
  assertKey(key);

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv.slice().buffer as ArrayBuffer, tagLength: 128 },
    key,
    encoder.encode(plaintext).slice().buffer as ArrayBuffer,
  );

  return {
    version: 1,
    algorithm: "AES-256-GCM",
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
  };
}

/**
 * Decrypt an authenticated AES-256-GCM payload.
 */
export async function decryptAes256Gcm(
  payload: EncryptedPayload,
  key: CryptoKey,
): Promise<string> {
  if (payload.version !== 1 || payload.algorithm !== "AES-256-GCM") {
    throw new TypeError("Unsupported encrypted payload");
  }

  assertKey(key);

  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToBytes(payload.iv).slice().buffer as ArrayBuffer, tagLength: 128 },
    key,
    base64ToBytes(payload.ciphertext).slice().buffer as ArrayBuffer,
  );

  return decoder.decode(plaintext);
}

/**
 * Generate a fresh non-exported AES-256-GCM key.
 */
export async function generateAes256Key(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}
