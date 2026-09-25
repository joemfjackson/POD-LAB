import type { GateType } from "./lifecycle";

export const WORKSPACE_ROLES = ["owner", "admin", "editor", "viewer"] as const;
export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number];

const RANK: Record<WorkspaceRole, number> = { owner: 4, admin: 3, editor: 2, viewer: 1 };

export function roleAtLeast(role: WorkspaceRole | null | undefined, min: WorkspaceRole): boolean {
  if (!role) return false;
  return RANK[role] >= RANK[min];
}

/** Mirrors `public.gate_min_role()` in the database. */
export function gateMinRole(gate: GateType): WorkspaceRole {
  switch (gate) {
    case "provider_credentials":
      return "owner";
    case "destructive_action":
    case "paid_campaign_spend":
    case "scale_approval":
    case "store_launch":
    case "compliance_override":
      return "admin";
    default:
      return "editor";
  }
}

export type Permission =
  | "workspace.read"
  | "workspace.manage"
  | "members.manage"
  | "content.edit"
  | "agents.run"
  | "agents.configure"
  | "providers.configure"
  | "credentials.submit"
  | "imports.run"
  | "data.delete"
  | "notes.write";

const PERMISSION_MIN_ROLE: Record<Permission, WorkspaceRole> = {
  "workspace.read": "viewer",
  "notes.write": "editor",
  "content.edit": "editor",
  "agents.run": "editor",
  "imports.run": "editor",
  "agents.configure": "admin",
  "providers.configure": "admin",
  "credentials.submit": "admin",
  "workspace.manage": "admin",
  "members.manage": "admin",
  "data.delete": "admin",
};

export function can(role: WorkspaceRole | null | undefined, permission: Permission): boolean {
  return roleAtLeast(role, PERMISSION_MIN_ROLE[permission]);
}

export function canDecideGate(role: WorkspaceRole | null | undefined, gate: GateType): boolean {
  return roleAtLeast(role, gateMinRole(gate));
}

/** Admins may assign roles below owner; only the owner role is never assignable via the UI. */
export function assignableRoles(actor: WorkspaceRole | null | undefined): WorkspaceRole[] {
  if (!roleAtLeast(actor, "admin")) return [];
  return ["admin", "editor", "viewer"];
}
