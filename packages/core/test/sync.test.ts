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
  // Convergence cases the original suite did not cover: it only merged distinct
  // keys and exercised two-replica transport recovery. These pin the ordering,
  // duplicate-delivery, and concurrent-conflict invariants instead.
  it("converges concurrent same-key writes to one state on both replicas", () => {
    const left = createSyncDocument();
    const right = createSyncDocument();

    // Same key written concurrently while both replicas are offline. Which
    // value wins depends on Yjs conflict ordering, so assert convergence
    // rather than a specific winner.
    left.getMap("records").set("key", "A");
    right.getMap("records").set("key", "B");

    applySyncUpdate(left, encodeSyncUpdate(right));
    applySyncUpdate(right, encodeSyncUpdate(left));

    const leftState = left.getMap("records").toJSON();
    const rightState = right.getMap("records").toJSON();

    // Exactly one of the two concurrent writes survives, and both agree on it.
    expect(["A", "B"]).toContain(leftState.key);
    expect(rightState).toEqual(leftState);
  });

  it("converges three replicas to identical state", () => {
    const first = createSyncDocument();
    const second = createSyncDocument();
    const third = createSyncDocument();

    first.getMap("shared").set("fromFirst", "1");
    second.getMap("shared").set("fromSecond", "2");
    third.getMap("shared").set("fromThird", "3");

    // Replicas reconnect in different orders; convergence must not depend on
    // arrival sequence.
    applySyncUpdate(first, encodeSyncUpdate(second));
    applySyncUpdate(second, encodeSyncUpdate(third));
    applySyncUpdate(third, encodeSyncUpdate(first));
    applySyncUpdate(first, encodeSyncUpdate(third));
    applySyncUpdate(third, encodeSyncUpdate(second));
    applySyncUpdate(second, encodeSyncUpdate(first));

    const firstState = first.getMap("shared").toJSON();
    expect(second.getMap("shared").toJSON()).toEqual(firstState);
    expect(third.getMap("shared").toJSON()).toEqual(firstState);
    expect(firstState).toEqual({
      fromFirst: "1",
      fromSecond: "2",
      fromThird: "3",
    });
  });

  it("converges to the same state under reversed update delivery order", () => {
    const left = createSyncDocument();
    const right = createSyncDocument();

    left.getMap("items").set("leftKey", "leftValue");
    right.getMap("items").set("rightKey", "rightValue");

    const leftUpdate = encodeSyncUpdate(left);
    const rightUpdate = encodeSyncUpdate(right);

    const forward = createSyncDocument();
    applySyncUpdate(forward, leftUpdate);
    applySyncUpdate(forward, rightUpdate);

    const reversed = createSyncDocument();
    applySyncUpdate(reversed, rightUpdate);
    applySyncUpdate(reversed, leftUpdate);

    // Pin the expected merge as well as the equality: comparing two results to
    // each other would still pass if applying updates were a no-op and both
    // documents stayed empty.
    const expected = { leftKey: "leftValue", rightKey: "rightValue" };
    expect(forward.getMap("items").toJSON()).toEqual(expected);
    expect(reversed.getMap("items").toJSON()).toEqual(expected);
  });

  it("converges a delete made against a shared value with a concurrent write", () => {
    // Both replicas fork from one shared history, then diverge: one deletes
    // the key while the other overwrites it. Neither replica has seen the
    // other's change, so the two operations are genuinely concurrent.
    const origin = createSyncDocument();
    origin.getMap("items").set("key", "original");

    const deleter = createSyncDocument();
    applySyncUpdate(deleter, encodeSyncUpdate(origin));

    const writer = createSyncDocument();
    applySyncUpdate(writer, encodeSyncUpdate(origin));

    deleter.getMap("items").delete("key");
    writer.getMap("items").set("key", "updated");

    // Reconcile in both directions.
    applySyncUpdate(deleter, encodeSyncUpdate(writer));
    applySyncUpdate(writer, encodeSyncUpdate(deleter));

    const deleterState = deleter.getMap("items").toJSON();
    const writerState = writer.getMap("items").toJSON();

    // Delete and write are concurrent, so either may win; both replicas must
    // agree, and the pre-delete value must never come back.
    expect(writerState).toEqual(deleterState);
    expect(deleterState.key ?? null).not.toBe("original");
  });

  it("is idempotent when a redelivered update arrives twice", () => {
    const source = createSyncDocument();
    const target = createSyncDocument();

    source.getMap("items").set("key", "value1");
    const update = encodeSyncUpdate(source);

    // At-least-once transports can redeliver; a duplicate must not corrupt or
    // duplicate state.
    applySyncUpdate(target, update);
    const afterFirst = target.getMap("items").toJSON();
    applySyncUpdate(target, update);

    expect(target.getMap("items").toJSON()).toEqual(afterFirst);
    expect(afterFirst).toEqual({ key: "value1" });
  });
});

describe("offline edits survive a restart", () => {
  // A restart is modelled by discarding the document and rebuilding it only
  // from what was persisted, which is what a real relaunch does.
  it("restores edits made while offline after the document is recreated", () => {
    const first = createSyncDocument();
    first.getMap("contacts").set("contact-1", "Alice");
    first.getMap("contacts").set("contact-2", "Bob");

    // Persist, then throw the whole document away as a restart would.
    const persisted = encodeSyncUpdate(first);
    const restarted = createSyncDocument();
    expect(restarted.getMap("contacts").toJSON()).toEqual({});

    applySyncUpdate(restarted, persisted);
    expect(restarted.getMap("contacts").toJSON()).toEqual({
      "contact-1": "Alice",
      "contact-2": "Bob",
    });
  });

  it("keeps offline edits made after the last sync, not only synced ones", () => {
    const online = createSyncDocument();
    online.getMap("contacts").set("synced", "Synced");
    const snapshotAtLastSync = encodeSyncUpdate(online);

    // Device goes offline and keeps working.
    const offline = createSyncDocument();
    applySyncUpdate(offline, snapshotAtLastSync);
    offline.getMap("contacts").set("offline-1", "Edited offline");
    offline.getMap("contacts").set("contact-1", "Edited while offline");

    const persistedAtRestart = encodeSyncUpdate(offline);
    const restarted = createSyncDocument();
    applySyncUpdate(restarted, persistedAtRestart);

    expect(restarted.getMap("contacts").toJSON()).toEqual({
      synced: "Synced",
      "offline-1": "Edited offline",
      "contact-1": "Edited while offline",
    });
  });

  // An update that only took effect after the last snapshot must survive a
  // restart on its own, not merely because an earlier snapshot was replayed.
  it("persists a deletion made offline across a restart", () => {
    const first = createSyncDocument();
    first.getMap("contacts").set("keep", "Keep");
    first.getMap("contacts").set("remove", "Remove");
    applySyncUpdate(first, encodeSyncUpdate(createSyncDocument()));

    // A full-fidelity update carries deletions; a naive merge would not.
    const stateBeforeRestart = encodeSyncUpdate(first);
    first.getMap("contacts").delete("remove");
    const afterDelete = encodeSyncUpdate(first);

    const restarted = createSyncDocument();
    applySyncUpdate(restarted, afterDelete);
    expect(restarted.getMap("contacts").toJSON()).toEqual({
      keep: "Keep",
    });

    // Replaying the older snapshot afterwards must not resurrect the row.
    applySyncUpdate(restarted, stateBeforeRestart);
    expect(restarted.getMap("contacts").has("remove")).toBe(false);
  });

  it("restores state persisted through the encrypted transport", async () => {
    const key = await generateAes256Key();
    const first = createSyncDocument();
    first.getMap("contacts").set("secret", "Confidential");

    const envelope = await encryptSyncUpdate(encodeSyncUpdate(first), key);
    // Nothing about the payload may be readable at rest.
    expect(envelope.update).not.toContain("Confidential");

    const restarted = createSyncDocument();
    applySyncUpdate(restarted, await decryptSyncUpdate(envelope, key));
    expect(restarted.getMap("contacts").toJSON()).toEqual({
      secret: "Confidential",
    });
  });

  it("survives repeated restarts without drifting", () => {
    let document = createSyncDocument();
    for (let index = 0; index < 5; index += 1) {
      document.getMap("contacts").set(`contact-${index}`, `Value ${index}`);
      const persisted = encodeSyncUpdate(document);
      document = createSyncDocument();
      applySyncUpdate(document, persisted);
    }

    expect(document.getMap("contacts").toJSON()).toEqual({
      "contact-0": "Value 0",
      "contact-1": "Value 1",
      "contact-2": "Value 2",
      "contact-3": "Value 3",
      "contact-4": "Value 4",
    });
  });
});
