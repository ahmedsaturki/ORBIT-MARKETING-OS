import * as Y from "yjs";
import { decryptAes256Gcm, encryptAes256Gcm } from "../security/aesGcm.js";

export interface SyncEnvelope {
  readonly version: 1;
  readonly update: string;
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
 * Create an empty Yjs document for offline-first replicated state.
 */
export function createSyncDocument(): Y.Doc {
  return new Y.Doc();
}

/**
 * Encode all document state as a Yjs update.
 */
export function encodeSyncUpdate(document: Y.Doc): Uint8Array {
  return Y.encodeStateAsUpdate(document);
}

/**
 * Apply a remote Yjs update. Yjs resolves concurrent changes without
 * requiring a central conflict resolver.
 */
export function applySyncUpdate(document: Y.Doc, update: Uint8Array): void {
  Y.applyUpdate(document, update);
}

/**
 * Wrap a Yjs update in an encrypted transport envelope.
 */
export async function encryptSyncUpdate(
  update: Uint8Array,
  key: CryptoKey,
): Promise<SyncEnvelope> {
  const payload = await encryptAes256Gcm(bytesToBase64(update), key);
  return {
    version: 1,
    update: JSON.stringify(payload),
  };
}

/**
 * Decrypt a transport envelope back into a Yjs update.
 */
export async function decryptSyncUpdate(
  envelope: SyncEnvelope,
  key: CryptoKey,
): Promise<Uint8Array> {
  if (envelope.version !== 1) throw new TypeError("Unsupported sync envelope");
  const encrypted = JSON.parse(envelope.update) as Parameters<
    typeof decryptAes256Gcm
  >[0];
  const updateBase64 = await decryptAes256Gcm(encrypted, key);
  return base64ToBytes(updateBase64);
}
