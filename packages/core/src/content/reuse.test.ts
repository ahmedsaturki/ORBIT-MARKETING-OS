import { describe, expect, it } from "vitest";
import { evaluateContentReuse } from "./reuse.js";

const base = {
  contentId: "content-001",
  workspaceId: "workspace-001",
  platform: "linkedin" as const,
  body: "A useful marketing idea",
  approvalStatus: "approved" as const,
  createdAt: "2026-09-20T00:00:00Z",
};

const policy = {
  cooldownHours: 24,
  maxReuseCount: 3,
  excludedPlatforms: [] as const,
  maxAgeDays: 30,
  requireApproval: true,
};

describe("content reuse policy", () => {
  it("allows approved fresh content with no conflicting history", () => {
    expect(
      evaluateContentReuse(
        base,
        [],
        policy,
        new Date("2026-09-26T00:00:00Z"),
      ),
    ).toEqual({
      allowed: true,
      reasons: ["approved"],
    });
  });

  it("blocks reuse during cooldown", () => {
    const history = [
      {
        contentId: "content-001",
        platform: "linkedin" as const,
        publishedAt: "2026-09-25T12:00:00Z",
      },
    ];
    const result = evaluateContentReuse(
      base,
      history,
      policy,
      new Date("2026-09-26T00:00:00Z"),
    );
    expect(result.allowed).toBe(false);
    expect(result.reasons).toContain("cooldown_active");
  });

  it("blocks when the reuse count is exhausted", () => {
    const history = [0, 1, 2].map((index) => ({
      contentId: "content-001",
      platform: "linkedin" as const,
      publishedAt: `2026-08-0${index + 1}T00:00:00Z`,
    }));
    const result = evaluateContentReuse(
      base,
      history,
      policy,
      new Date("2026-09-26T00:00:00Z"),
    );
    expect(result.allowed).toBe(false);
    expect(result.reasons).toContain("reuse_limit_reached");
  });

  it("blocks excluded platforms and unapproved content", () => {
    const result = evaluateContentReuse(
      { ...base, platform: "instagram", approvalStatus: "pending" },
      [],
      {
        ...policy,
        excludedPlatforms: ["instagram"],
      },
      new Date("2026-09-26T00:00:00Z"),
    );
    expect(result.allowed).toBe(false);
    expect(result.reasons).toContain("approval_required");
    expect(result.reasons).toContain("platform_excluded");
  });

  it("blocks stale content", () => {
    const result = evaluateContentReuse(
      { ...base, createdAt: "2026-07-01T00:00:00Z" },
      [],
      policy,
      new Date("2026-09-26T00:00:00Z"),
    );
    expect(result.allowed).toBe(false);
    expect(result.reasons).toContain("stale");
  });

  it("blocks duplicate variants when the platform body matches", () => {
    const result = evaluateContentReuse(
      base,
      [
        {
          contentId: "content-999",
          platform: "linkedin",
          publishedAt: "2026-09-01T00:00:00Z",
          body: " A useful   marketing idea ",
        },
      ],
      policy,
      new Date("2026-09-26T00:00:00Z"),
    );
    expect(result.allowed).toBe(false);
    expect(result.reasons).toContain("duplicate_variant");
  });

  it("keeps approval requirement deterministic", () => {
    const result = evaluateContentReuse(
      { ...base, approvalStatus: "draft" },
      [],
      policy,
      new Date("2026-09-26T00:00:00Z"),
    );
    expect(result.reasons).toEqual(["approval_required"]);
  });
});
