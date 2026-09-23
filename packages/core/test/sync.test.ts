import { describe, expect, it } from "vitest";
import {
  applySyncUpdate,
  createSyncDocument,
  decryptSyncUpdate,
  encodeSyncUpdate,
  encryptSyncUpdate,
} from "../src/sync/yjs.js";
import { generateAes256Key } from "../src/security/aesGcm.js";

describe("Yjs sync", () => {
  it("merges concurrent offline changes", () => {
    const left = createSyncDocument();
    const right = createSyncDocument();
    left.getMap("records").set("left", "A");
    right.getMap("records").set("right", "B");

    applySyncUpdate(left, encodeSyncUpdate(right));
    applySyncUpdate(right, encodeSyncUpdate(left));

    expect(left.getMap("records").toJSON()).toEqual({ left: "A", right: "B" });
    expect(right.getMap("records").toJSON()).toEqual({ left: "A", right: "B" });
  });

  it("encrypts updates before transport", async () => {
    const doc = createSyncDocument();
    doc.getMap("records").set("secret", "value");

    const key = await generateAes256Key();
    const update = encodeSyncUpdate(doc);
    const envelope = await encryptSyncUpdate(update, key);
    const recovered = await decryptSyncUpdate(envelope, key);

    expect(Array.from(recovered)).toEqual(Array.from(update));
    expect(envelope.update).not.toContain("secret");
  });
});
