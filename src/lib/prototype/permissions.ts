import type { PermissionAction, Role } from "../domain/types";
import { roleLabelForPolicy } from "./policy";

const matrix: Record<Role, PermissionAction[]> = {
  owner: [
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
  member: ["workspace:select", "audit:read"]
};

export function can(role: Role, action: PermissionAction): boolean {
  return matrix[role].includes(action);
}

export function roleLabel(role: Role): string {
  return roleLabelForPolicy(role);
}
