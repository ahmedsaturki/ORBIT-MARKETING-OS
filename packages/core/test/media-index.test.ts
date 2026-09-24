import { describe, expect, it } from "vitest";
import {
  MediaError,
  MediaIndex,
  type MediaAsset,
} from "../src/media/index.js";

const NOW = "2026-09-24T10:00:00.000Z";

function asset(overrides: Partial<MediaAsset> = {}): MediaAsset {
  return {
    id: "media-1",
    workspaceId: "ws1",
    filename: "ramadan-banner.png",
    mimeType: "image/png",
    sizeBytes: 2048,
    tags: ["promo", "banner"],
    createdAt: NOW,
    ...overrides,
  };
}

describe("media metadata index and search (CONT-02)", () => {
  it("indexes assets and finds them by case-insensitive filename text", () => {
    const index = new MediaIndex();
    index.add(asset());
    index.add(
      asset({
        id: "media-2",
        filename: "Eid-Video.MP4",
        mimeType: "video/mp4",
        sizeBytes: 9_000_000,
        tags: ["video"],
      }),
    );

    expect(index.search({ workspaceId: "ws1", text: "RAMADAN" })).toHaveLength(1);
    expect(index.search({ workspaceId: "ws1", text: ".mp4" })[0]?.id).toBe(
      "media-2",
    );
    expect(index.search({ workspaceId: "ws1" })).toHaveLength(2);
  });

  it("filters by exact tag and by mime type (exact and prefix)", () => {
    const index = new MediaIndex();
    index.add(asset());
    index.add(
      asset({
        id: "media-2",
        filename: "clip.mp4",
        mimeType: "video/mp4",
        tags: ["video"],
      }),
    );
    index.add(
      asset({
        id: "media-3",
        filename: "logo.svg",
        mimeType: "image/svg+xml",
        tags: ["brand"],
      }),
    );

    expect(
      index.search({ workspaceId: "ws1", tag: "promo" }).map((a) => a.id),
    ).toEqual(["media-1"]);
    expect(
      index.search({ workspaceId: "ws1", mimeType: "image/" }).map((a) => a.id),
    ).toEqual(["media-1", "media-3"]);
    expect(
      index.search({ workspaceId: "ws1", mimeType: "video/mp4" }).map((a) => a.id),
    ).toEqual(["media-2"]);
    // AND semantics: all filters must hold.
    expect(
      index.search({
        workspaceId: "ws1",
        mimeType: "image/",
        tag: "promo",
        text: "banner",
      }).map((a) => a.id),
    ).toEqual(["media-1"]);
    expect(
      index.search({ workspaceId: "ws1", mimeType: "image/", tag: "video" }),
    ).toHaveLength(0);
  });

  it("keeps workspaces isolated on get, search, count, and remove", () => {
    const index = new MediaIndex();
    index.add(asset());
    index.add(asset({ id: "ws2-1", workspaceId: "ws2", filename: "other.png" }));

    expect(index.search({ workspaceId: "ws1" })).toHaveLength(1);
    expect(index.search({ workspaceId: "ws2" })).toHaveLength(1);
    expect(index.get("ws2-1", "ws1")).toBeUndefined();
    expect(index.get("media-1", "ws1")?.id).toBe("media-1");
    expect(index.count("ws1")).toBe(1);
    expect(index.count("ws2")).toBe(1);
    expect(index.remove("ws2-1", "ws1")).toBe(false);
    expect(index.count("ws2")).toBe(1);
    expect(index.remove("ws2-1", "ws2")).toBe(true);
    expect(index.count("ws2")).toBe(0);
  });

  it("returns deterministic id-sorted results", () => {
    const index = new MediaIndex();
    index.add(asset({ id: "b" }));
    index.add(asset({ id: "a" }));
    index.add(asset({ id: "c" }));
    expect(index.search({ workspaceId: "ws1" }).map((a) => a.id)).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  it("rejects duplicate ids and malformed assets", () => {
    const index = new MediaIndex();
    index.add(asset());
    expect(() => index.add(asset())).toThrow(MediaError);
    expect(() => index.add(asset({ filename: " " }))).toThrow(/filename/);
    expect(() => index.add(asset({ mimeType: "" }))).toThrow(/mimeType/);
    expect(() => index.add(asset({ sizeBytes: -1 }))).toThrow(/sizeBytes/);
    expect(() => index.add(asset({ tags: ["ok", " "] }))).toThrow(/tag/);
    expect(() => index.add(asset({ workspaceId: "" }))).toThrow(/workspaceId/);
  });

  it("fails closed on a query without a workspace", () => {
    const index = new MediaIndex();
    expect(() => index.search({ workspaceId: "" })).toThrow(MediaError);
    expect(() => index.count("")).toThrow(MediaError);
  });
});
