import type { MembershipStatus, Proposal, ProposalStatus, PrototypeState, Role, WorkspaceMember } from "./types";

export type MembershipManagementAction =
  | "approve"
  | "reject"
  | "deactivate"
  | "update_role"
  | "update_title"
  | "transfer_owner";

const statusLabels: Record<MembershipStatus, string> = {
  active: "승인 완료",
  inactive: "비활성화",
  pending: "승인 대기",
  rejected: "반려"
};

const roleLabels: Record<Role, string> = {
  manager: "운영 관리자",
  member: "일반 사용자",
  owner: "워크스페이스 소유자"
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

export function membershipStatusLabel(status: MembershipStatus): string {
  return statusLabels[status];
}

export function proposalStatusLabel(status: ProposalStatus): string {
  return proposalStatusLabels[status];
}

export function normalizeLegacyRole(role: Role | "admin" | string | undefined): Role {
  if (role === "admin" || role === "owner") {
    return "owner";
  }

  if (role === "manager") {
    return "manager";
  }

  return "member";
}

export function normalizeMembershipStatus(status: MembershipStatus | "invited" | string | undefined): MembershipStatus {
  if (status === "active" || status === "inactive" || status === "pending" || status === "rejected") {
    return status;
  }

  if (status === "invited") {
    return "pending";
  }

  return "pending";
}

export function workspaceMemberForUser(
  state: Pick<PrototypeState, "members">,
  workspaceId: string,
  userId: string
): WorkspaceMember | undefined {
  return state.members.find((member) => member.workspaceId === workspaceId && member.userId === userId);
}

export function activeWorkspaceMemberForUser(
  state: Pick<PrototypeState, "members">,
  workspaceId: string,
  userId: string
): WorkspaceMember | undefined {
  const member = workspaceMemberForUser(state, workspaceId, userId);
  return member?.status === "active" ? member : undefined;
}

export function membershipById(state: Pick<PrototypeState, "members">, memberId: string): WorkspaceMember | undefined {
  return state.members.find((member) => member.id === memberId);
}

export function isActiveMembership(member: WorkspaceMember | undefined): member is WorkspaceMember {
  return member?.status === "active";
}

export function canEnterWorkspace(state: Pick<PrototypeState, "members">, workspaceId: string, userId: string): boolean {
  return Boolean(activeWorkspaceMemberForUser(state, workspaceId, userId));
}

export function isVotingRole(role: Role): boolean {
  return role === "owner" || role === "manager";
}

export function canSeeProposalList(member: WorkspaceMember | undefined): boolean {
  return isActiveMembership(member);
}

export function canOpenProposalDetail(member: WorkspaceMember | undefined): boolean {
  return isActiveMembership(member) && isVotingRole(member.role);
}

export function proposalVoterUserIds(state: Pick<PrototypeState, "members">, workspaceId: string): string[] {
  return state.members
    .filter((member) => member.workspaceId === workspaceId && member.status === "active" && isVotingRole(member.role))
    .map((member) => member.userId);
}

export function canVoteOnProposal(
  state: Pick<PrototypeState, "members" | "session" | "proposals">,
  proposalId: string,
  userId = state.session.currentUserId,
  workspaceId = state.session.workspaceId
): boolean {
  const proposal = state.proposals.find((item) => item.id === proposalId);
  const member = activeWorkspaceMemberForUser(state, workspaceId, userId);
  return Boolean(proposal && canOpenProposalDetail(member) && proposal.voterUserIds.includes(userId));
}

export function canFinalizeProposal(
  state: Pick<PrototypeState, "members" | "session">,
  userId = state.session.currentUserId,
  workspaceId = state.session.workspaceId
): boolean {
  return canOpenProposalDetail(activeWorkspaceMemberForUser(state, workspaceId, userId));
}

export function canManageMembership(
  actor: WorkspaceMember | undefined,
  target: WorkspaceMember | undefined,
  action: MembershipManagementAction,
  nextRole?: Role
): boolean {
  if (!actor || !target || actor.workspaceId !== target.workspaceId || actor.id === target.id || actor.status !== "active") {
    return false;
  }

  if (actor.role === "owner") {
    if (action === "transfer_owner") {
      return target.status === "active" && target.role !== "owner";
    }

    if (action === "approve") {
      return target.status === "pending" || target.status === "rejected";
    }

    if (action === "reject") {
      return target.status === "pending";
    }

    if (action === "deactivate") {
      return target.status === "active" && target.role !== "owner";
    }

    if (action === "update_role") {
      return target.status === "active" && target.role !== "owner" && nextRole !== "owner";
    }

    if (action === "update_title") {
      return target.status === "active" && target.role !== "owner";
    }
  }

  if (actor.role === "manager") {
    if (action === "approve") {
      return target.role === "member" && (target.status === "pending" || target.status === "rejected");
    }

    if (action === "reject") {
      return target.role === "member" && target.status === "pending";
    }

    if (action === "deactivate") {
      return target.role === "member" && target.status === "active";
    }

    if (action === "update_title") {
      return target.role === "member" && target.status === "active";
    }
  }

  return false;
}

export function actorMembershipForTarget(
  state: Pick<PrototypeState, "members" | "session">,
  target: WorkspaceMember | undefined
): WorkspaceMember | undefined {
  if (!target) {
    return undefined;
  }

  return activeWorkspaceMemberForUser(state, target.workspaceId, state.session.currentUserId);
}

export function normalizeProposalVoters<T extends Partial<Proposal> & Record<string, unknown>>(proposal: T): T & { voterUserIds: string[] } {
  const legacyVoterIds = Array.isArray(proposal.eligibleVoterIds) ? (proposal.eligibleVoterIds as string[]) : [];
  const voterUserIds = Array.isArray(proposal.voterUserIds) ? proposal.voterUserIds : legacyVoterIds;

  return {
    ...proposal,
    voterUserIds
  };
}

