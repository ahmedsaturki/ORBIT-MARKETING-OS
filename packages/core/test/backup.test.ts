import { describe, expect, it } from "vitest";
import {
  createEncryptedBackup,
  restoreEncryptedBackup,
} from "../src/backup/backup.js";
import { generateAes256Key } from "../src/security/aesGcm.js";

describe("encrypted backup", () => {
  it("round-trips opaque data", async () => {
    const key = await generateAes256Key();
    const source = new TextEncoder().encode("private CRM snapshot");

    const envelope = await createEncryptedBackup(
      source,
      key,
      "2026-09-24T00:00:00.000Z",
    );
    const restored = await restoreEncryptedBackup(envelope, key);

    expect(Array.from(restored)).toEqual(Array.from(source));
    expect(JSON.stringify(envelope)).not.toContain("private CRM snapshot");
  });
});
