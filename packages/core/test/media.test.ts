import { describe, expect, it } from "vitest";
import { searchMediaAssets, validateMediaAsset, type MediaAsset } from "../src/media/catalog.js";

const image: MediaAsset = {
  id: "media-1",
  workspaceId: "workspace-1",
  kind: "image",
  filename: "launch.png",
  mimeType: "image/png",
  sizeBytes: 1200,
  sha256: "a".repeat(64),
  localPath: "/media/launch.png",
  tags: ["launch", "facebook"],
  createdAt: "2026-09-24T00:00:00.000Z",
};

describe("media catalog", () => {
  it("validates a local media asset", () => {
    expect(validateMediaAsset(image).valid).toBe(true);
  });

  it("rejects a kind/mime mismatch", () => {
    expect(validateMediaAsset({ ...image, kind: "video" }).valid).toBe(false);
  });

  it("searches by text, kind, and all requested tags", () => {
    const results = searchMediaAssets(
      [image, { ...image, id: "media-2", filename: "other.jpg", mimeType: "image/jpeg", tags: ["other"] }],
      { text: "launch", kind: "image", tags: ["facebook"] },
    );
    expect(results.map((item) => item.id)).toEqual(["media-1"]);
  });
});
