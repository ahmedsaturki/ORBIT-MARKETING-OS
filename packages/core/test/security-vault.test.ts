import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createVault,
  openVault,
  VAULT_HEADER_SIZE,
  VaultError,
} from "../src/security/index.js";

let dir: string;
let vaultPath: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "orbit-vault-"));
  vaultPath = join(dir, "secrets.vault");
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("encrypted secrets vault (SEC-01)", () => {
  it("round-trips secrets across a close and reopen", () => {
    const vault = createVault(vaultPath, "correct horse battery");
    vault.set("gemini", "AIzaFAKESECRET1234567890abcdefghijklmnop");
    vault.set("smtp", "hunter2-super-secret");
    expect(vault.get("gemini")).toContain("AIza");
    expect(vault.keys().sort()).toEqual(["gemini", "smtp"]);

    const reopened = openVault(vaultPath, "correct horse battery");
    expect(reopened.get("gemini")).toContain("AIza");
    expect(reopened.get("smtp")).toBe("hunter2-super-secret");
    expect(reopened.get("missing")).toBeUndefined();
  });

  it("never stores secret values in plaintext on disk", () => {
    const vault = createVault(vaultPath, "passphrase-1");
    vault.set("api_key", "PLAINTEXT-SENTINEL-DO-NOT-LEAK");
    const raw = readFileSync(vaultPath);
    const asText = raw.toString("latin1");
    expect(asText).not.toContain("PLAINTEXT-SENTINEL-DO-NOT-LEAK");
    expect(raw.subarray(0, 9).toString("ascii")).toBe("ORBVLT001");
    expect(raw.length).toBeGreaterThan(VAULT_HEADER_SIZE);
  });

  it("rejects the wrong passphrase without decrypting anything", () => {
    const vault = createVault(vaultPath, "right-passphrase");
    vault.set("k", "v");
    expect(() => openVault(vaultPath, "wrong-passphrase")).toThrow(VaultError);
    try {
      openVault(vaultPath, "wrong-passphrase");
    } catch (err) {
      expect((err as Error).message).toMatch(/wrong passphrase|tampered/);
    }
  });

  it("rejects a tampered ciphertext body", () => {
    const vault = createVault(vaultPath, "pp");
    vault.set("key1", "value1-long-enough-to-encrypt");
    const raw = Buffer.from(readFileSync(vaultPath));
    // Flip a bit inside the ciphertext region (past the fixed header).
    const target = raw.length - 1;
    raw[target] = raw[target] ^ 0xff;
    writeFileSync(vaultPath, raw);
    expect(() => openVault(vaultPath, "pp")).toThrow(VaultError);
  });

  it("rejects a tampered salt (AAD binds header to payload)", () => {
    const vault = createVault(vaultPath, "pp");
    vault.set("key1", "value1");
    const raw = Buffer.from(readFileSync(vaultPath));
    const saltOffset = 9; // after 9-byte magic
    raw[saltOffset] = raw[saltOffset] ^ 0xff;
    writeFileSync(vaultPath, raw);
    expect(() => openVault(vaultPath, "pp")).toThrow(VaultError);
  });

  it("rejects a foreign file that is not a vault", () => {
    writeFileSync(vaultPath, Buffer.alloc(120, 7));
    expect(() => openVault(vaultPath, "anything")).toThrow(
      /not an orbit vault/,
    );
  });

  it("rejects a truncated vault file", () => {
    writeFileSync(vaultPath, Buffer.from("ORBVLT001partial"));
    expect(() => openVault(vaultPath, "anything")).toThrow(/truncated/);
  });

  it("persists deletes atomically", () => {
    const vault = createVault(vaultPath, "pp");
    vault.set("keep", "1");
    vault.set("drop", "2");
    expect(vault.delete("drop")).toBe(true);
    expect(vault.delete("drop")).toBe(false);

    const reopened = openVault(vaultPath, "pp");
    expect(reopened.has("keep")).toBe(true);
    expect(reopened.has("drop")).toBe(false);
    expect(reopened.keys()).toEqual(["keep"]);
  });

  it("restores a vault from a copied backup file", () => {
    const vault = createVault(vaultPath, "restore-pass");
    vault.set("service_a", "secret-a-value");
    vault.set("service_b", "secret-b-value");

    const restoredPath = join(dir, "restored.vault");
    copyFileSync(vaultPath, restoredPath);

    const restored = openVault(restoredPath, "restore-pass");
    expect(restored.get("service_a")).toBe("secret-a-value");
    expect(restored.get("service_b")).toBe("secret-b-value");

    // The restored copy is independent: writing it does not touch the source.
    restored.set("service_c", "secret-c-value");
    expect(openVault(vaultPath, "restore-pass").get("service_c")).toBeUndefined();
  });

  it("refuses to overwrite an existing vault on create", () => {
    createVault(vaultPath, "pp");
    expect(() => createVault(vaultPath, "other")).toThrow(/already exists/);
  });

  it("rejects an empty passphrase and missing file, fail-closed", () => {
    expect(() => createVault(vaultPath, "")).toThrow(/non-empty/);
    expect(() => openVault(join(dir, "nope.vault"), "pp")).toThrow(
      /not found/,
    );
  });

  it("throws on operations after close without touching disk state", () => {
    const vault = createVault(vaultPath, "pp");
    vault.set("k", "v");
    vault.close();
    expect(() => vault.get("k")).toThrow(/closed/);
    expect(() => vault.set("k2", "v2")).toThrow(/closed/);
    expect(() => vault.delete("k")).toThrow(/closed/);
    expect(() => vault.keys()).toThrow(/closed/);
    expect(openVault(vaultPath, "pp").get("k")).toBe("v");
  });

  it("rolls back in-memory state when persistence fails", () => {
    const dirVault = join(dir, "dir-vault");
    const live = createVault(join(dirVault, "a.vault"), "pp");
    live.set("k", "old");
    live.set("gone", "x");

    // Remove the parent directory so the atomic tmp write fails.
    rmSync(dirVault, { recursive: true, force: true });
    expect(() => live.set("k", "new")).toThrow();
    expect(live.get("k")).toBe("old");
    expect(() => live.delete("gone")).toThrow();
    expect(live.get("gone")).toBe("x");
  });
});
