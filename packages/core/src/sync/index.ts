import { readFileSync, renameSync, writeFileSync } from "node:fs";
import * as Y from "yjs";

export class SyncError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SyncError";
  }
}

export interface SyncSnapshot {
  readonly version: 1;
  /** Base64-encoded Yjs state updates, applied in order. */
  readonly updates: readonly string[];
}

const CONTENT_FIELD = "content";

function decodeUpdate(base64: string): Uint8Array {
  if (typeof base64 !== "string" || base64.length === 0) {
    throw new SyncError("snapshot update must be a non-empty string");
  }
  const bytes = Buffer.from(base64, "base64");
  if (bytes.length === 0) {
    throw new SyncError("snapshot update is not valid base64");
  }
  return new Uint8Array(bytes);
}

/**
 * Collaborative document with explicit snapshot persistence and explicit
 * remote-update application. Fail-closed: malformed updates and snapshots
 * throw instead of being silently dropped.
 */
export class SyncDocument {
  private readonly doc: Y.Doc;

  private constructor(doc: Y.Doc) {
    this.doc = doc;
  }

  static create(): SyncDocument {
    return new SyncDocument(new Y.Doc());
  }

  static fromSnapshot(snapshot: SyncSnapshot): SyncDocument {
    if (!snapshot || snapshot.version !== 1 || !Array.isArray(snapshot.updates)) {
      throw new SyncError("invalid snapshot: expected { version: 1, updates: [] }");
    }
    const doc = new Y.Doc();
    for (const encoded of snapshot.updates) {
      const update = decodeUpdate(encoded);
      try {
        Y.applyUpdate(doc, update);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new SyncError(`snapshot update rejected: ${message}`);
      }
    }
    return new SyncDocument(doc);
  }

  /** Full-state snapshot: sufficient to rebuild the document after restart. */
  toSnapshot(): SyncSnapshot {
    const state = Y.encodeStateAsUpdate(this.doc);
    return { version: 1, updates: [Buffer.from(state).toString("base64")] };
  }

  /** Applies an update received from another device. Garbage is rejected. */
  applyRemote(update: Uint8Array): void {
    if (!(update instanceof Uint8Array) || update.length === 0) {
      throw new SyncError("remote update must be a non-empty Uint8Array");
    }
    try {
      Y.applyUpdate(this.doc, update);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new SyncError(`remote update rejected: ${message}`);
    }
  }

  /** State update to send to another device (includes local + applied remote). */
  encodeState(): Uint8Array {
    return Y.encodeStateAsUpdate(this.doc);
  }

  /** Deterministic vector of applied updates; equal vectors = converged. */
  encodeStateVector(): Uint8Array {
    return Y.encodeStateVector(this.doc);
  }

  onAnyUpdate(listener: (update: Uint8Array) => void): () => void {
    const handler = (update: Uint8Array): void => listener(update);
    this.doc.on("update", handler);
    return () => this.doc.off("update", handler);
  }

  get text(): Y.Text {
    return this.doc.getText(CONTENT_FIELD);
  }

  get map(): Y.Map<unknown> {
    return this.doc.getMap("meta");
  }

  getTextContent(): string {
    return this.text.toString();
  }
}

/**
 * File-backed snapshot store. Missing file = fresh document (first run);
 * corrupt or version-mismatched content = SyncError (fail-closed).
 */
export class FileSyncStore {
  constructor(private readonly filePath: string) {}

  load(): SyncSnapshot {
    let raw: string;
    try {
      raw = readFileSync(this.filePath, "utf8");
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "ENOENT") return { version: 1, updates: [] };
      throw new SyncError(`cannot read snapshot store: ${String(error)}`);
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new SyncError("snapshot store is not valid JSON");
    }
    if (
      !parsed ||
      typeof parsed !== "object" ||
      (parsed as SyncSnapshot).version !== 1 ||
      !Array.isArray((parsed as SyncSnapshot).updates)
    ) {
      throw new SyncError("snapshot store has an unsupported shape");
    }
    const snapshot = parsed as SyncSnapshot;
    const probe = new Y.Doc();
    for (const update of snapshot.updates) {
      try {
        Y.applyUpdate(probe, decodeUpdate(update));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new SyncError(`snapshot store update rejected: ${message}`);
      }
    }
    return { version: 1, updates: [...snapshot.updates] };
  }

  save(snapshot: SyncSnapshot): void {
    if (!snapshot || snapshot.version !== 1 || !Array.isArray(snapshot.updates)) {
      throw new SyncError("refusing to save invalid snapshot");
    }
    for (const update of snapshot.updates) {
      decodeUpdate(update);
    }
    const tmp = `${this.filePath}.tmp`;
    writeFileSync(tmp, JSON.stringify(snapshot), "utf8");
    renameSync(tmp, this.filePath);
  }
}
