import type { AIInsight, CandidateType, Decision, Proposal, PrototypeState, VerificationRecord } from "../domain/types";
import { currentWorkspaceData as readCurrentWorkspaceData } from "../domain/state-machine";

export function currentUser(state: PrototypeState) {
  return state.users.find((user) => user.id === state.session.currentUserId) ?? state.users[0];
}

export function currentWorkspace(state: PrototypeState) {
  return state.workspaces.find((workspace) => workspace.id === state.session.workspaceId) ?? state.workspaces[0];
}

export function accessibleWorkspaces(state: PrototypeState, userId = state.session.currentUserId) {
  const activeWorkspaceIds = new Set(
    state.members
      .filter((member) => member.userId === userId && member.status === "active")
      .map((member) => member.workspaceId)
  );

  return state.workspaces.filter((workspace) => activeWorkspaceIds.has(workspace.id));
}

export function currentWorkspaceData(state: PrototypeState) {
  return readCurrentWorkspaceData(state);
}

export function candidatesByType(state: PrototypeState, type: CandidateType) {
  return currentWorkspaceData(state).candidates.filter((candidate) => candidate.type === type);
}

export function evidenceById(state: PrototypeState, evidenceId: string) {
  return currentWorkspaceData(state).evidence.find((item) => item.id === evidenceId);
}

export function activeInsight(state: PrototypeState): AIInsight | undefined {
  const data = currentWorkspaceData(state);
  const focusId = state.navigationFocus?.screen === "insightDetail" || state.navigationFocus?.screen === "insights"
    ? state.navigationFocus.focusId
    : undefined;
  return data.insights.find((insight) => insight.id === focusId) ?? data.insights.find((insight) => insight.id === data.activeInsightId) ?? data.insights[0];
}

export function activeProposal(state: PrototypeState): Proposal | undefined {
  const data = currentWorkspaceData(state);
  const focusId = state.navigationFocus?.screen === "proposalVote" ? state.navigationFocus.focusId : undefined;
  const activeInsightProposal = data.insights
    .find((insight) => insight.id === data.activeInsightId)
    ?.proposalId;
  return (
    data.proposals.find((proposal) => proposal.id === focusId) ??
    data.proposals.find((proposal) => proposal.id === activeInsightProposal) ??
    data.proposals.find((proposal) => proposal.id === data.activeProposalId) ??
    data.proposals[0]
  );
}

export function latestDecision(state: PrototypeState): Decision | undefined {
  return currentWorkspaceData(state).decisions[0];
}

export function latestVerification(state: PrototypeState): VerificationRecord | undefined {
  return currentWorkspaceData(state).verificationRecords[0];
}

export function latestVerificationForDecision(state: PrototypeState, decisionId?: string): VerificationRecord | undefined {
  if (!decisionId) {
    return latestVerification(state);
  }

  return verificationHistoryForDecision(state, decisionId)[0];
}

export function verificationHistoryForDecision(state: PrototypeState, decisionId: string): VerificationRecord[] {
  return currentWorkspaceData(state).verificationRecords
    .filter((record) => record.decisionId === decisionId)
    .sort((left, right) => {
      if (right.revision !== left.revision) {
        return right.revision - left.revision;
      }

      return Date.parse(right.verifiedAt) - Date.parse(left.verifiedAt);
    });
}
