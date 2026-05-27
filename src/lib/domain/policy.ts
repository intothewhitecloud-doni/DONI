import type { CompanyUser, CompanyUserStatus, Proposal, ProposalStatus, PrototypeState, Role } from "./types";

export type CompanyUserManagementAction =
  | "approve"
  | "reject"
  | "delete_account"
  | "update_role"
  | "update_title"
  | "assign_category";

const statusLabels: Record<CompanyUserStatus, string> = {
  active: "승인 완료",
  pending: "승인 대기",
  rejected: "반려"
};

const roleLabels: Record<Role, string> = {
  manager: "기업 관리자",
  owner: "기업 소유자"
};

const proposalStatusLabels: Record<ProposalStatus, string> = {
  approved: "승인 완료",
  closed: "종료",
  draft: "초안",
  finalized: "확정",
  rejected: "반려",
  reviewing: "검토 중",
  verified: "검증 완료",
  voting: "투표 중"
};

export function normalizedEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function roleLabelForPolicy(role: Role): string {
  return roleLabels[role];
}

export function companyUserStatusLabel(status: CompanyUserStatus): string {
  return statusLabels[status];
}

export function proposalStatusLabel(status: ProposalStatus): string {
  return proposalStatusLabels[status];
}

export function normalizeLegacyRole(role: Role | "admin" | string | undefined): Role {
  if (role === "admin" || role === "owner") {
    return "owner";
  }

  return "manager";
}

export function normalizeCompanyUserStatus(status: CompanyUserStatus | "invited" | string | undefined): CompanyUserStatus {
  if (status === "active" || status === "pending" || status === "rejected") {
    return status;
  }

  if (status === "invited") {
    return "pending";
  }

  return "pending";
}

export function companyUserForUser(
  state: Pick<PrototypeState, "companyUsers">,
  userId: string
): CompanyUser | undefined {
  return state.companyUsers.find((companyUser) => companyUser.userId === userId);
}

export function activeCompanyUserForUser(
  state: Pick<PrototypeState, "companyUsers">,
  userId: string
): CompanyUser | undefined {
  const companyUser = companyUserForUser(state, userId);
  return companyUser?.status === "active" ? companyUser : undefined;
}

export function companyUserById(state: Pick<PrototypeState, "companyUsers">, companyUserId: string): CompanyUser | undefined {
  return state.companyUsers.find((companyUser) => companyUser.id === companyUserId);
}

export function isActiveCompanyUser(companyUser: CompanyUser | undefined): companyUser is CompanyUser {
  return companyUser?.status === "active";
}

export function canEnterCompany(state: Pick<PrototypeState, "companyUsers">, userId: string): boolean {
  return Boolean(activeCompanyUserForUser(state, userId));
}

export function isVotingRole(role: Role): boolean {
  return role === "owner" || role === "manager";
}

export function canSeeProposalList(companyUser: CompanyUser | undefined): boolean {
  return isActiveCompanyUser(companyUser);
}

export function canOpenProposalDetail(companyUser: CompanyUser | undefined): boolean {
  return isActiveCompanyUser(companyUser) && isVotingRole(companyUser.role);
}

export function proposalVoterUserIds(state: Pick<PrototypeState, "companyUsers">): string[] {
  return state.companyUsers
    .filter((companyUser) => companyUser.status === "active" && isVotingRole(companyUser.role))
    .map((companyUser) => companyUser.userId);
}

export function canVoteOnProposal(
  state: Pick<PrototypeState, "companyUsers" | "session" | "proposals">,
  proposalId: string,
  userId = state.session.currentUserId
): boolean {
  const proposal = state.proposals.find((item) => item.id === proposalId);
  const companyUser = activeCompanyUserForUser(state, userId);
  return Boolean(proposal && canOpenProposalDetail(companyUser) && proposal.voterUserIds.includes(userId));
}

export function canFinalizeProposal(
  state: Pick<PrototypeState, "companyUsers" | "session">,
  userId = state.session.currentUserId
): boolean {
  return canOpenProposalDetail(activeCompanyUserForUser(state, userId));
}

export function canManageCompanyUser(
  actor: CompanyUser | undefined,
  target: CompanyUser | undefined,
  action: CompanyUserManagementAction,
  nextRole?: Role
): boolean {
  if (!actor || !target || actor.id === target.id || actor.status !== "active" || actor.role !== "owner") {
    return false;
  }

  if (target.role === "owner") {
    return false;
  }

  if (action === "approve") {
    return target.status === "pending" || target.status === "rejected";
  }

  if (action === "reject") {
    return target.status === "pending";
  }

  if (action === "delete_account") {
    return true;
  }

  if (action === "update_role") {
    return target.status === "active" && nextRole === "manager";
  }

  if (action === "update_title" || action === "assign_category") {
    return target.status === "active";
  }

  return false;
}

export function actorCompanyUserForTarget(
  state: Pick<PrototypeState, "companyUsers" | "session">,
  target: CompanyUser | undefined
): CompanyUser | undefined {
  if (!target || !state.session.loggedIn || !state.session.currentUserId) {
    return undefined;
  }

  return activeCompanyUserForUser(state, state.session.currentUserId);
}

export function normalizeProposalVoters<T extends Partial<Proposal> & Record<string, unknown>>(proposal: T): T & { voterUserIds: string[] } {
  const legacyVoterIds = Array.isArray(proposal.eligibleVoterIds) ? (proposal.eligibleVoterIds as string[]) : [];
  const voterUserIds = Array.isArray(proposal.voterUserIds) ? proposal.voterUserIds : legacyVoterIds;

  return {
    ...proposal,
    voterUserIds
  };
}
