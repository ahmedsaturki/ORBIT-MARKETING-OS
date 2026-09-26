import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as Y from "yjs";
import {
  applySyncUpdate,
  createSyncDocument,
  decryptSyncUpdate,
  encodeSyncUpdate,
  encryptSyncUpdate,
  type SyncEnvelope,
} from "../src/sync/yjs.js";
import { generateAes256Key } from "../src/security/aesGcm.js";

interface EnvelopeRequest {
  readonly from: "device-a" | "device-b";
  readonly to: "device-a" | "device-b";
  readonly envelope: SyncEnvelope;
}

interface Relay {
  readonly url: string;
  readonly read: (
    device: "device-a" | "device-b",
  ) => Promise<EnvelopeRequest | undefined>;
  readonly close: () => Promise<void>;
}

async function createRelay(): Promise<Relay> {
  const queues = new Map<"device-a" | "device-b", EnvelopeRequest[]>([
    ["device-a", []],
    ["device-b", []],
  ]);
  let server: Server;

  server = createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    request.on("end", () => {
      if (request.method === "POST" && request.url === "/sync") {
        try {
          const payload = JSON.parse(
            Buffer.concat(chunks).toString("utf8"),
          ) as EnvelopeRequest;
          if (
            (payload.from !== "device-a" && payload.from !== "device-b") ||
            (payload.to !== "device-a" && payload.to !== "device-b")
          ) {
            response.statusCode = 400;
            response.end("invalid route");
            return;
          }
          queues.get(payload.to)?.push(payload);
          response.statusCode = 202;
          response.end("accepted");
        } catch {
          response.statusCode = 400;
          response.end("invalid payload");
        }
        return;
      }

      response.statusCode = 404;
      response.end("not found");
    });
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    throw new Error("loopback relay did not expose a port");
  }

  return {
    url: `http://127.0.0.1:${address.port}`,
    read: async (device) => queues.get(device)?.shift(),
    close: async () =>
      new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      ),
  };
}

async function postEnvelope(
  relay: Relay,
  from: EnvelopeRequest["from"],
  to: EnvelopeRequest["to"],
  envelope: SyncEnvelope,
): Promise<void> {
  const response = await fetch(`${relay.url}/sync`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ from, to, envelope }),
  });
  expect(response.status).toBe(202);
}

describe("encrypted Yjs sync network evidence", () => {
  let relay: Relay;

  beforeAll(async () => {
    relay = await createRelay();
  });

  afterAll(async () => {
    await relay.close();
  });

  it("converges bidirectionally across two independent loopback devices", async () => {
    const key = await generateAes256Key();
    const deviceA = createSyncDocument();
    const deviceB = createSyncDocument();

    deviceA.getMap("marketing").set("campaign", "A");
    deviceA.getArray("events").push(["A-created"]);

    const updateA = encodeSyncUpdate(deviceA);
    const envelopeA = await encryptSyncUpdate(updateA, key);
    await postEnvelope(relay, "device-a", "device-b", envelopeA);

    const receivedA = await relay.read("device-b");
    expect(receivedA).toBeDefined();
    const decryptedA = await decryptSyncUpdate(receivedA!.envelope, key);
    applySyncUpdate(deviceB, decryptedA);

    deviceB.getMap("marketing").set("audience", "B");
    deviceB.getArray("events").push(["B-created"]);

    const updateB = encodeSyncUpdate(deviceB);
    const envelopeB = await encryptSyncUpdate(updateB, key);
    await postEnvelope(relay, "device-b", "device-a", envelopeB);

    const receivedB = await relay.read("device-a");
    expect(receivedB).toBeDefined();
    const decryptedB = await decryptSyncUpdate(receivedB!.envelope, key);
    applySyncUpdate(deviceA, decryptedB);

    expect(deviceA.getMap("marketing").toJSON()).toEqual({
      campaign: "A",
      audience: "B",
    });
    expect(deviceB.getMap("marketing").toJSON()).toEqual({
      campaign: "A",
      audience: "B",
    });
    expect(deviceA.getArray("events").toJSON()).toEqual([
      "A-created",
      "B-created",
    ]);
    expect(deviceB.getArray("events").toJSON()).toEqual([
      "A-created",
      "B-created",
    ]);
  });

  it("rejects tampered encrypted transport before applying state", async () => {
    const key = await generateAes256Key();
    const source = createSyncDocument();
    source.getMap("marketing").set("secret", "never-apply");
    const envelope = await encryptSyncUpdate(encodeSyncUpdate(source), key);
    const tampered = {
      ...envelope,
      update: envelope.update.replace(/.$/, (character) =>
        character === "A" ? "B" : "A",
      ),
    } satisfies SyncEnvelope;

    const target = createSyncDocument();
    await expect(decryptSyncUpdate(tampered, key)).rejects.toThrow();
    expect(target.getMap("marketing").toJSON()).toEqual({});
  });
});
