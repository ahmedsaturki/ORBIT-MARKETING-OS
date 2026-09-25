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

  // Simulates ciphertext buffering across a disconnected transport.
  it("survives encrypted transport disconnect/reconnect and converges across two devices", async () => {
    const left = createSyncDocument();
    const right = createSyncDocument();

    left.getMap("records").set("left", "A");
    const key = await generateAes256Key();

    // Opaque transport queue: ciphertext may be buffered during disconnect,
    // and formatted output remains opaque to the transport.

    // then delivered and applied only after the link is restored.
    const offlineQueue: string[] = [];
    let connected = false;
    const send = async (update: Uint8Array): Promise<void> => {
      const envelope = await encryptSyncUpdate(update, key);
      offlineQueue.push(envelope.update);
      if (!connected) return;
      while (offlineQueue.length) {
        const transportPayload = offlineQueue.shift()!;
        const recovered = await decryptSyncUpdate(
          { version: 1, update: transportPayload },
          key,
        );
        applySyncUpdate(right, recovered);
      }
    };

    await send(encodeSyncUpdate(left));
    expect(right.getMap("records").toJSON()).toEqual({});

    right.getMap("records").set("right", "B");
    const rightUpdate = encodeSyncUpdate(right);
    const rightEnvelope = await encryptSyncUpdate(rightUpdate, key);
    expect(rightEnvelope.update).not.toContain("left");
    expect(rightEnvelope.update).not.toContain("right");

    connected = true;
    while (offlineQueue.length) {
      const transportPayload = offlineQueue.shift()!;
      const recovered = await decryptSyncUpdate(
        { version: 1, update: transportPayload },
        key,
      );
      applySyncUpdate(right, recovered);
    }

    const rightRecovery = await decryptSyncUpdate(rightEnvelope, key);
    applySyncUpdate(left, rightRecovery);

    expect(left.getMap("records").toJSON()).toEqual({
      left: "A",
      right: "B",
    });
    expect(right.getMap("records").toJSON()).toEqual({
      left: "A",
      right: "B",
    });
  });

  it("rejects encrypted transport replay with the wrong key", async () => {
    const document = createSyncDocument();
    document.getMap("records").set("secret", "value");

    const key = await generateAes256Key();
    const wrongKey = await generateAes256Key();
    const envelope = await encryptSyncUpdate(encodeSyncUpdate(document), key);

    await expect(decryptSyncUpdate(envelope, wrongKey)).rejects.toThrow();
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
