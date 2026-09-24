import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  FileSyncStore,
  SyncDocument,
  SyncError,
} from "../src/sync/index.js";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "orbit-sync-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("offline edits survive restart (SYNC-01)", () => {
  it("persists edits through a file store and restores them after a device restart", () => {
    const storePath = join(dir, "doc.snapshot.json");
    const store = new FileSyncStore(storePath);

    // First run: store is missing → fresh document.
    expect(store.load()).toEqual({ version: 1, updates: [] });

    // Device works offline: local edits accumulate in the document.
    let device = SyncDocument.fromSnapshot(store.load());
    device.text.insert(0, "offline draft 1; ");
    device.map.set("status", "draft");
    store.save(device.toSnapshot());

    // Simulated power loss: document object is gone, only the store remains.
    device = null as never;
    let restored = SyncDocument.fromSnapshot(store.load());
    expect(restored.getTextContent()).toBe("offline draft 1; ");
    expect(restored.map.get("status")).toBe("draft");

    // More offline edits after the restart, then a second restart.
    restored.text.insert(restored.text.length, "offline draft 2");
    restored.map.set("status", "ready");
    store.save(restored.toSnapshot());

    const afterSecondRestart = SyncDocument.fromSnapshot(store.load());
    expect(afterSecondRestart.getTextContent()).toBe(
      "offline draft 1; offline draft 2",
    );
    expect(afterSecondRestart.map.get("status")).toBe("ready");
  });

  it("keeps edits that arrived while the device was offline (remote then restart)", () => {
    const store = new FileSyncStore(join(dir, "doc.snapshot.json"));
    const base = SyncDocument.create();
    base.text.insert(0, "base ");
    store.save(base.toSnapshot());

    // Another device produces an update while we are offline.
    const other = SyncDocument.fromSnapshot(store.load());
    other.text.insert(other.text.length, "from other device");

    // Offline device loads the store, applies the update when it returns,
    // edits locally, and persists everything.
    const offline = SyncDocument.fromSnapshot(store.load());
    offline.applyRemote(other.encodeState());
    offline.text.insert(offline.text.length, " + local edit");
    store.save(offline.toSnapshot());

    const reloaded = SyncDocument.fromSnapshot(store.load());
    expect(reloaded.getTextContent()).toBe(
      "base from other device + local edit",
    );
  });

  it("fails closed on corrupt, truncated, and wrong-version snapshots", () => {
    const storePath = join(dir, "doc.snapshot.json");
    const store = new FileSyncStore(storePath);

    writeFileSync(storePath, "{ not json", "utf8");
    expect(() => store.load()).toThrow(SyncError);

    writeFileSync(storePath, JSON.stringify({ version: 2, updates: [] }), "utf8");
    expect(() => store.load()).toThrow(/unsupported shape/);

    writeFileSync(
      storePath,
      JSON.stringify({ version: 1, updates: ["@@@not-base64@@@"] }),
      "utf8",
    );
    expect(() => store.load()).toThrow(SyncError);

    // Valid JSON shape but garbage update bytes → rejected at document load.
    writeFileSync(
      storePath,
      JSON.stringify({ version: 1, updates: ["aGVsbG8="] }),
      "utf8",
    );
    expect(() => SyncDocument.fromSnapshot(store.load())).toThrow(SyncError);

    expect(() => store.save({ version: 1, updates: [""] })).toThrow(SyncError);
    expect(() => store.save({ version: 0, updates: [] } as never)).toThrow(
      SyncError,
    );
  });
});

describe("concurrent edits converge (SYNC-02)", () => {
  function twoDevicesFromBase(): {
    baseState: Uint8Array;
    deviceA: SyncDocument;
    deviceB: SyncDocument;
  } {
    const base = SyncDocument.create();
    base.text.insert(0, "base");
    const baseState = base.encodeState();
    const deviceA = SyncDocument.fromSnapshot({ version: 1, updates: [b64(baseState)] });
    const deviceB = SyncDocument.fromSnapshot({ version: 1, updates: [b64(baseState)] });
    return { baseState, deviceA, deviceB };
  }

  function b64(bytes: Uint8Array): string {
    return Buffer.from(bytes).toString("base64");
  }

  function assertConverged(a: SyncDocument, b: SyncDocument): void {
    expect(b64(a.encodeStateVector())).toBe(b64(b.encodeStateVector()));
    expect(a.getTextContent()).toBe(b.getTextContent());
    expect(a.map.get("title")).toEqual(b.map.get("title"));
  }

  it("converges after offline concurrent text edits are exchanged", () => {
    const { deviceA, deviceB } = twoDevicesFromBase();

    // Both devices edit while offline.
    deviceA.text.insert(deviceA.text.length, " A was here");
    deviceB.text.insert(deviceB.text.length, " B was here");

    // Exchange updates (either direction first; do both).
    deviceA.applyRemote(deviceB.encodeState());
    deviceB.applyRemote(deviceA.encodeState());

    assertConverged(deviceA, deviceB);
    expect(deviceA.getTextContent()).toContain("A was here");
    expect(deviceA.getTextContent()).toContain("B was here");
  });

  it("converges when the same map key is set concurrently (deterministic winner)", () => {
    const { deviceA, deviceB } = twoDevicesFromBase();

    deviceA.map.set("title", "title from A");
    deviceB.map.set("title", "title from B");

    deviceA.applyRemote(deviceB.encodeState());
    deviceB.applyRemote(deviceA.encodeState());

    assertConverged(deviceA, deviceB);
    // Exactly one deterministic winner on both sides.
    const winner = deviceA.map.get("title");
    expect(["title from A", "title from B"]).toContain(winner);
  });

  it("converges a three-device mesh with repeated exchanges", () => {
    const base = SyncDocument.create();
    base.text.insert(0, "start");
    const baseState = base.encodeState();

    const [a, b, c] = [0, 1, 2].map(() =>
      SyncDocument.fromSnapshot({ version: 1, updates: [b64(baseState)] }),
    ) as [SyncDocument, SyncDocument, SyncDocument];

    a.text.insert(a.text.length, " from-A");
    b.text.insert(b.text.length, " from-B");
    c.map.set("phase", "two");

    // Two full rounds of all-pairs state exchange.
    for (let round = 0; round < 2; round++) {
      for (const [self, peer] of [
        [a, b],
        [b, a],
        [a, c],
        [c, a],
        [b, c],
        [c, b],
      ]) {
        self.applyRemote(peer.encodeState());
      }
    }

    assertConverged(a, b);
    assertConverged(b, c);
    expect(a.getTextContent()).toContain("from-A");
    expect(a.getTextContent()).toContain("from-B");
    expect(c.map.get("phase")).toBe("two");
  });

  it("rejects garbage and empty remote updates fail-closed", () => {
    const doc = SyncDocument.create();
    expect(() => doc.applyRemote(new Uint8Array(0))).toThrow(SyncError);
    expect(() =>
      doc.applyRemote(Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 8])),
    ).toThrow(SyncError);
    expect(() =>
      SyncDocument.fromSnapshot({ version: 1, updates: [""] }),
    ).toThrow(SyncError);
    expect(() => SyncDocument.fromSnapshot({ version: 1, updates: [] })).not.toThrow();
  });

  it("emits every update exactly once through onAnyUpdate", () => {
    const doc = SyncDocument.create();
    const seen: number[] = [];
    const unsubscribe = doc.onAnyUpdate((update) => seen.push(update.length));
    doc.text.insert(0, "first");
    doc.map.set("k", 1);
    unsubscribe();
    doc.text.insert(doc.text.length, "after-unsubscribe");
    expect(seen).toHaveLength(2);
    expect(doc.getTextContent()).toBe("firstafter-unsubscribe");
  });
});
