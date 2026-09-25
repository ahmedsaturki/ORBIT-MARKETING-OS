import { describe, expect, it } from "vitest";
import {
  authorize,
  hasPermission,
  permissionsForRole,
  type WorkspaceMembership,
} from "../src/access/control.js";

const membership = (
  role: WorkspaceMembership["role"],
  active = true,
): WorkspaceMembership => ({
  workspaceId: "workspace-1",
  userId: "user-1",
  role,
  active,
});

describe("workspace authorization", () => {
  it("grants only role-defined permissions", () => {
    expect(hasPermission(membership("operator"), "queue.execute")).toBe(true);
    expect(hasPermission(membership("operator"), "approval.review")).toBe(
      false,
    );
    expect(hasPermission(membership("reviewer"), "approval.review")).toBe(true);
    expect(permissionsForRole("viewer")).toContain("workspace.read");
  });

  it("fails closed for inactive memberships", () => {
    expect(
      authorize(membership("owner", false), "workspace-1", "workspace.manage"),
    ).toEqual({
      allowed: false,
      reason: "inactive_membership",
    });
  });

  it("fails closed across workspaces", () => {
    expect(
      authorize(membership("admin"), "workspace-2", "account.read"),
    ).toEqual({
      allowed: false,
      reason: "workspace_mismatch",
    });
  });

  it("fails closed for missing permissions", () => {
    expect(
      authorize(membership("viewer"), "workspace-1", "campaign.manage"),
    ).toEqual({
      allowed: false,
      reason: "permission_denied",
    });
  });

  it("allows an authorized operation", () => {
    expect(
      authorize(membership("operator"), "workspace-1", "queue.execute"),
    ).toEqual({
      allowed: true,
      reason: "allowed",
    });
  });
});
