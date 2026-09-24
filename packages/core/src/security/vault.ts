import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname } from "node:path";

const MAGIC = Buffer.from("ORBVLT001", "ascii");
const SALT_LEN = 16;
const IV_LEN = 12;
const TAG_LEN = 16;
const KEY_LEN = 32;
const HEADER_LEN = MAGIC.length + SALT_LEN + IV_LEN + TAG_LEN;
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_MAXMEM = 64 * 1024 * 1024;

export const VAULT_HEADER_SIZE = HEADER_LEN;

export class VaultError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VaultError";
  }
}

export interface Vault {
  readonly path: string;
  set(key: string, value: string): void;
  get(key: string): string | undefined;
  has(key: string): boolean;
  delete(key: string): boolean;
  keys(): string[];
  close(): void;
}

interface VaultPayload {
  v: 1;
  secrets: Record<string, string>;
}

function deriveKey(passphrase: string, salt: Buffer): Buffer {
  return scryptSync(Buffer.from(passphrase, "utf8"), salt, KEY_LEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    maxmem: SCRYPT_MAXMEM,
  });
}

function assertPassphrase(passphrase: string): void {
  if (typeof passphrase !== "string" || passphrase.length === 0) {
    throw new VaultError("passphrase must be a non-empty string");
  }
}

function encryptPayload(
  payload: VaultPayload,
  passphrase: string,
): Buffer {
  const salt = randomBytes(SALT_LEN);
  const iv = randomBytes(IV_LEN);
  const key = deriveKey(passphrase, salt);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.concat([MAGIC, salt]));
  const plaintext = Buffer.from(JSON.stringify(payload), "utf8");
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  key.fill(0);
  return Buffer.concat([MAGIC, salt, iv, tag, ciphertext]);
}

function decryptToPayload(
  file: Buffer,
  passphrase: string,
): VaultPayload {
  if (file.length < HEADER_LEN + 1) {
    throw new VaultError("vault file is truncated");
  }
  if (!file.subarray(0, MAGIC.length).equals(MAGIC)) {
    throw new VaultError("not an orbit vault file");
  }
  const salt = file.subarray(MAGIC.length, MAGIC.length + SALT_LEN);
  const iv = file.subarray(
    MAGIC.length + SALT_LEN,
    MAGIC.length + SALT_LEN + IV_LEN,
  );
  const tag = file.subarray(
    MAGIC.length + SALT_LEN + IV_LEN,
    HEADER_LEN,
  );
  const ciphertext = file.subarray(HEADER_LEN);
  const key = deriveKey(passphrase, salt);
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAAD(Buffer.concat([MAGIC, salt]));
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);
    const parsed = JSON.parse(plaintext.toString("utf8")) as VaultPayload;
    if (parsed?.v !== 1 || typeof parsed.secrets !== "object") {
      throw new VaultError("vault payload is malformed");
    }
    return parsed;
  } catch (err) {
    if (err instanceof VaultError) throw err;
    throw new VaultError(
      "wrong passphrase or tampered vault (authentication failed)",
    );
  } finally {
    key.fill(0);
  }
}

class FileVault implements Vault {
  readonly path: string;
  #passphrase: string;
  #secrets: Record<string, string>;
  #closed = false;

  constructor(path: string, passphrase: string, secrets: Record<string, string>) {
    this.path = path;
    this.#passphrase = passphrase;
    this.#secrets = { ...secrets };
  }

  #assertOpen(): void {
    if (this.#closed) {
      throw new VaultError("vault is closed");
    }
  }

  #persist(): void {
    const next = encryptPayload(
      { v: 1, secrets: this.#secrets },
      this.#passphrase,
    );
    const tmp = `${this.path}.tmp-${randomBytes(6).toString("hex")}`;
    try {
      writeFileSync(tmp, next, { mode: 0o600 });
      renameSync(tmp, this.path);
    } catch (err) {
      rmSync(tmp, { force: true });
      throw err;
    }
  }

  set(key: string, value: string): void {
    this.#assertOpen();
    if (typeof key !== "string" || key.length === 0) {
      throw new VaultError("secret key must be a non-empty string");
    }
    const previous = this.#secrets[key];
    this.#secrets[key] = value;
    try {
      this.#persist();
    } catch (err) {
      if (previous === undefined) {
        delete this.#secrets[key];
      } else {
        this.#secrets[key] = previous;
      }
      throw err;
    }
  }

  get(key: string): string | undefined {
    this.#assertOpen();
    return this.#secrets[key];
  }

  has(key: string): boolean {
    this.#assertOpen();
    return Object.prototype.hasOwnProperty.call(this.#secrets, key);
  }

  delete(key: string): boolean {
    this.#assertOpen();
    if (!this.has(key)) return false;
    const previous = this.#secrets[key];
    delete this.#secrets[key];
    try {
      this.#persist();
    } catch (err) {
      this.#secrets[key] = previous;
      throw err;
    }
    return true;
  }

  keys(): string[] {
    this.#assertOpen();
    return Object.keys(this.#secrets);
  }

  close(): void {
    this.#secrets = {};
    this.#closed = true;
  }
}

export function createVault(path: string, passphrase: string): Vault {
  assertPassphrase(passphrase);
  if (existsSync(path)) {
    throw new VaultError(`vault already exists at ${path}`);
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, encryptPayload({ v: 1, secrets: {} }, passphrase), {
    mode: 0o600,
  });
  return new FileVault(path, passphrase, {});
}

export function openVault(path: string, passphrase: string): Vault {
  assertPassphrase(passphrase);
  if (!existsSync(path)) {
    throw new VaultError(`vault not found at ${path}`);
  }
  let file: Buffer;
  try {
    file = readFileSync(path);
  } catch {
    throw new VaultError(`unable to read vault at ${path}`);
  }
  const payload = decryptToPayload(file, passphrase);
  return new FileVault(path, passphrase, payload.secrets);
}
