import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  scryptSync,
} from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";

const MAGIC = Buffer.from("ORBBK001", "ascii");
const FLAG_ENCRYPTED = 0x01;
const SHA_LEN = 32;
const SALT_LEN = 16;
const IV_LEN = 12;
const TAG_LEN = 16;
const KEY_LEN = 32;
const BASE_HEADER_LEN = MAGIC.length + 1 + SHA_LEN;
const ENCRYPTED_HEADER_LEN = BASE_HEADER_LEN + SALT_LEN + IV_LEN + TAG_LEN;
const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 } as const;

export interface BackupOptions {
  readonly passphrase?: string;
}

export interface BackupInfo {
  readonly encrypted: boolean;
  readonly plaintextBytes: number;
  readonly sha256: string;
}

function sha256(data: Buffer): Buffer {
  return createHash("sha256").update(data).digest();
}

function deriveKey(passphrase: string, salt: Buffer): Buffer {
  return scryptSync(Buffer.from(passphrase, "utf8"), salt, KEY_LEN, SCRYPT_PARAMS);
}

function snapshotDb(dbPath: string): Buffer {
  if (!existsSync(dbPath)) {
    throw new Error(`database not found: ${dbPath}`);
  }
  const snapshotPath = join(
    dirname(dbPath),
    `.orbit-snapshot-${randomBytes(8).toString("hex")}.db`,
  );
  const db = new DatabaseSync(dbPath);
  try {
    const escaped = snapshotPath.replace(/'/g, "''");
    db.exec(`VACUUM INTO '${escaped}'`);
  } finally {
    db.close();
  }
  try {
    return readFileSync(snapshotPath);
  } finally {
    if (existsSync(snapshotPath)) {
      unlinkSync(snapshotPath);
    }
  }
}

function encrypt(plaintext: Buffer, sha: Buffer, passphrase: string): Buffer {
  const salt = randomBytes(SALT_LEN);
  const iv = randomBytes(IV_LEN);
  const key = deriveKey(passphrase, salt);
  const cipher = createCipheriv("aes-256-gcm", key, iv, { authTagLength: TAG_LEN });
  cipher.setAAD(Buffer.concat([MAGIC, Buffer.from([FLAG_ENCRYPTED]), sha]));
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([
    MAGIC,
    Buffer.from([FLAG_ENCRYPTED]),
    sha,
    salt,
    iv,
    tag,
    ciphertext,
  ]);
}

function decrypt(
  payload: Buffer,
  expectedSha: Buffer,
  passphrase: string,
): Buffer {
  const salt = payload.subarray(BASE_HEADER_LEN, BASE_HEADER_LEN + SALT_LEN);
  const iv = payload.subarray(
    BASE_HEADER_LEN + SALT_LEN,
    BASE_HEADER_LEN + SALT_LEN + IV_LEN,
  );
  const tag = payload.subarray(
    BASE_HEADER_LEN + SALT_LEN + IV_LEN,
    ENCRYPTED_HEADER_LEN,
  );
  const ciphertext = payload.subarray(ENCRYPTED_HEADER_LEN);
  const key = deriveKey(passphrase, Buffer.from(salt));
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, iv, {
      authTagLength: TAG_LEN,
    });
    decipher.setAAD(
      Buffer.concat([MAGIC, Buffer.from([FLAG_ENCRYPTED]), expectedSha]),
    );
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  } catch {
    throw new Error("backup corrupt: authentication failed (tampered data or wrong passphrase)");
  }
}

function readVerified(
  srcPath: string,
  options: BackupOptions,
): { plaintext: Buffer; info: BackupInfo } {
  const payload = readFileSync(srcPath);
  if (payload.length < BASE_HEADER_LEN) {
    throw new Error("backup corrupt: truncated header");
  }
  if (!payload.subarray(0, MAGIC.length).equals(MAGIC)) {
    throw new Error("backup corrupt: invalid magic bytes");
  }
  const flags = payload[MAGIC.length];
  if ((flags & ~FLAG_ENCRYPTED) !== 0) {
    throw new Error("backup corrupt: unknown flags");
  }
  const sha = payload.subarray(MAGIC.length + 1, BASE_HEADER_LEN);
  const encrypted = (flags & FLAG_ENCRYPTED) !== 0;
  let plaintext: Buffer;
  if (encrypted) {
    if (!options.passphrase) {
      throw new Error("backup requires passphrase");
    }
    if (payload.length < ENCRYPTED_HEADER_LEN) {
      throw new Error("backup corrupt: truncated encrypted payload");
    }
    plaintext = decrypt(payload, sha, options.passphrase);
  } else {
    plaintext = payload.subarray(BASE_HEADER_LEN);
  }
  if (!sha256(plaintext).equals(sha)) {
    throw new Error("backup corrupt: content hash mismatch");
  }
  return {
    plaintext,
    info: {
      encrypted,
      plaintextBytes: plaintext.length,
      sha256: sha.toString("hex"),
    },
  };
}

function atomicWrite(destPath: string, data: Buffer): void {
  mkdirSync(dirname(destPath), { recursive: true });
  const tmpPath = `${destPath}.tmp-${randomBytes(6).toString("hex")}`;
  try {
    writeFileSync(tmpPath, data);
    renameSync(tmpPath, destPath);
  } catch (err) {
    if (existsSync(tmpPath)) {
      unlinkSync(tmpPath);
    }
    throw err;
  }
}

export function createBackup(
  dbPath: string,
  destPath: string,
  options: BackupOptions = {},
): BackupInfo {
  const plaintext = snapshotDb(dbPath);
  const sha = sha256(plaintext);
  const payload = options.passphrase
    ? encrypt(plaintext, sha, options.passphrase)
    : Buffer.concat([MAGIC, Buffer.from([0]), sha, plaintext]);
  atomicWrite(destPath, payload);
  return {
    encrypted: Boolean(options.passphrase),
    plaintextBytes: plaintext.length,
    sha256: sha.toString("hex"),
  };
}

export function verifyBackup(
  srcPath: string,
  options: BackupOptions = {},
): BackupInfo {
  return readVerified(srcPath, options).info;
}

export function restoreBackup(
  srcPath: string,
  destPath: string,
  options: BackupOptions = {},
): BackupInfo {
  const { plaintext, info } = readVerified(srcPath, options);
  mkdirSync(dirname(destPath), { recursive: true });
  const tmpPath = join(
    dirname(destPath),
    `.orbit-restore-${randomBytes(8).toString("hex")}.db`,
  );
  writeFileSync(tmpPath, plaintext);
  try {
    const db = new DatabaseSync(tmpPath);
    try {
      const row = db.prepare("PRAGMA integrity_check").get() as
        | Record<string, unknown>
        | undefined;
      const outcome = row ? String(Object.values(row)[0] ?? "") : "";
      if (outcome !== "ok") {
        throw new Error(`backup corrupt: integrity check failed (${outcome})`);
      }
    } finally {
      db.close();
    }
    renameSync(tmpPath, destPath);
  } catch (err) {
    if (existsSync(tmpPath)) {
      unlinkSync(tmpPath);
    }
    throw err;
  }
  // Stale sidecar files from a previous database would corrupt the restore target.
  for (const suffix of ["-wal", "-shm"]) {
    const sidecar = `${destPath}${suffix}`;
    if (existsSync(sidecar)) {
      unlinkSync(sidecar);
    }
  }
  return info;
}
