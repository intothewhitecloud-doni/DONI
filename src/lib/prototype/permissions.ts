import type { PermissionAction, Role } from "../domain/types";

const matrix: Record<Role, PermissionAction[]> = {
  admin: [
    "workspace:select",
    "source:upload",
    "analysis:start",
    "candidate:review",
    "candidate:confirm",
    "insight:proposal",
    "proposal:vote",
    "proposal:finalize",
    "verification:create",
    "outcome:record",
    "admin:manage",
    "audit:read"
  ],
  manager: [
    "workspace:select",
    "source:upload",
    "analysis:start",
    "candidate:review",
    "candidate:confirm",
    "insight:proposal",
    "proposal:vote",
    "proposal:finalize",
    "verification:create",
    "outcome:record",
    "audit:read"
  ],
  member: ["workspace:select", "proposal:vote"]
};

export function can(role: Role, action: PermissionAction): boolean {
  return matrix[role].includes(action);
}

export function roleLabel(role: Role): string {
  const labels: Record<Role, string> = {
    admin: "관리자",
    manager: "매니저",
    member: "구성원"
  };

  return labels[role];
}
