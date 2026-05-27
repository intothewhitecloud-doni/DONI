import type { CompanyUser, PermissionAction, PrototypeState, Role } from "../domain/types";
import { activeCompanyUserForUser, roleLabelForPolicy } from "./policy";

const matrix: Record<Role, PermissionAction[]> = {
  owner: [
    "company:read",
    "company:manage",
    "company:user:manage",
    "company:organization:manage",
    "company:code:manage",
    "company:type:manage",
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
  manager: [
    "company:read",
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
  ]
};

export function can(role: Role, action: PermissionAction): boolean {
  return matrix[role].includes(action);
}

export function currentActiveCompanyUser(
  state: Pick<PrototypeState, "companyUsers" | "session">
): CompanyUser | undefined {
  if (!state.session.loggedIn || !state.session.currentUserId) {
    return undefined;
  }

  return activeCompanyUserForUser(state, state.session.currentUserId);
}

export function canCurrentUser(state: Pick<PrototypeState, "companyUsers" | "session">, action: PermissionAction): boolean {
  const companyUser = currentActiveCompanyUser(state);
  return Boolean(companyUser && can(companyUser.role, action));
}

export function roleLabel(role: Role): string {
  return roleLabelForPolicy(role);
}
