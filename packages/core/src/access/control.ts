export type WorkspaceRole =
  "owner" | "admin" | "editor" | "operator" | "reviewer" | "viewer";

export type Permission =
  | "workspace.read"
  | "workspace.manage"
  | "account.read"
  | "account.manage"
  | "content.read"
  | "content.manage"
  | "campaign.read"
  | "campaign.manage"
  | "approval.read"
  | "approval.review"
  | "queue.read"
  | "queue.execute"
  | "inbox.read"
  | "inbox.manage"
  | "crm.read"
  | "crm.manage"
  | "analytics.read"
  | "backup.manage"
  | "security.manage"
  | "billing.manage";

export interface WorkspaceMembership {
  readonly workspaceId: string;
  readonly userId: string;
  readonly role: WorkspaceRole;
  readonly active: boolean;
}

const ROLE_PERMISSIONS: Readonly<Record<WorkspaceRole, readonly Permission[]>> =
  {
    owner: [
      "workspace.read",
      "workspace.manage",
      "account.read",
      "account.manage",
      "content.read",
      "content.manage",
      "campaign.read",
      "campaign.manage",
      "approval.read",
      "approval.review",
      "queue.read",
      "queue.execute",
      "inbox.read",
      "inbox.manage",
      "crm.read",
      "crm.manage",
      "analytics.read",
      "backup.manage",
      "security.manage",
      "billing.manage",
    ],
    admin: [
      "workspace.read",
      "account.read",
      "account.manage",
      "content.read",
      "content.manage",
      "campaign.read",
      "campaign.manage",
      "approval.read",
      "approval.review",
      "queue.read",
      "queue.execute",
      "inbox.read",
      "inbox.manage",
      "crm.read",
      "crm.manage",
      "analytics.read",
      "backup.manage",
      "security.manage",
    ],
    editor: [
      "workspace.read",
      "account.read",
      "content.read",
      "content.manage",
      "campaign.read",
      "campaign.manage",
      "approval.read",
      "queue.read",
      "inbox.read",
      "inbox.manage",
      "crm.read",
      "crm.manage",
      "analytics.read",
    ],
    operator: [
      "workspace.read",
      "account.read",
      "content.read",
      "campaign.read",
      "queue.read",
      "queue.execute",
      "inbox.read",
      "inbox.manage",
      "crm.read",
      "crm.manage",
      "analytics.read",
    ],
    reviewer: [
      "workspace.read",
      "content.read",
      "campaign.read",
      "approval.read",
      "approval.review",
      "queue.read",
      "inbox.read",
      "crm.read",
      "analytics.read",
    ],
    viewer: [
      "workspace.read",
      "account.read",
      "content.read",
      "campaign.read",
      "approval.read",
      "queue.read",
      "inbox.read",
      "crm.read",
      "analytics.read",
    ],
  };

export function permissionsForRole(role: WorkspaceRole): readonly Permission[] {
  return ROLE_PERMISSIONS[role];
}

export function hasPermission(
  membership: WorkspaceMembership,
  permission: Permission,
): boolean {
  return (
    membership.active && ROLE_PERMISSIONS[membership.role].includes(permission)
  );
}

export type AuthorizationFailure =
  "inactive_membership" | "workspace_mismatch" | "permission_denied";

export interface AuthorizationDecision {
  readonly allowed: boolean;
  readonly reason: "allowed" | AuthorizationFailure;
}

export function authorize(
  membership: WorkspaceMembership,
  workspaceId: string,
  permission: Permission,
): AuthorizationDecision {
  if (!membership.active) {
    return { allowed: false, reason: "inactive_membership" };
  }
  if (membership.workspaceId !== workspaceId) {
    return { allowed: false, reason: "workspace_mismatch" };
  }
  if (!hasPermission(membership, permission)) {
    return { allowed: false, reason: "permission_denied" };
  }
  return { allowed: true, reason: "allowed" };
}
