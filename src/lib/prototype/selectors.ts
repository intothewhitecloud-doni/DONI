import type { AIInsight, CandidateType, Decision, Proposal, PrototypeState, VerificationRecord } from "../domain/types";
import { currentCompanyData as readCurrentCompanyData } from "../domain/state-machine";

export function currentUser(state: PrototypeState) {
  return state.users.find((user) => user.id === state.session.currentUserId) ?? state.users[0];
}

export function currentCompany(state: PrototypeState) {
  return state.company;
}

export function currentCompanyUser(state: PrototypeState) {
  return state.companyUsers.find((companyUser) => companyUser.userId === state.session.currentUserId);
}

export function hasActiveCompanySession(state: PrototypeState): boolean {
  return Boolean(state.session.loggedIn && currentCompanyUser(state)?.status === "active");
}

export function companyUsersForConsole(state: PrototypeState) {
  return state.companyUsers;
}

export function currentCompanyData(state: PrototypeState) {
  return readCurrentCompanyData(state);
}

export function candidatesByType(state: PrototypeState, type: CandidateType) {
  return currentCompanyData(state).candidates.filter((candidate) => candidate.type === type);
}

export function evidenceById(state: PrototypeState, evidenceId: string) {
  return currentCompanyData(state).evidence.find((item) => item.id === evidenceId);
}

export function activeInsight(state: PrototypeState): AIInsight | undefined {
  const data = currentCompanyData(state);
  const focusId = state.navigationFocus?.screen === "insightDetail" || state.navigationFocus?.screen === "insights"
    ? state.navigationFocus.focusId
    : undefined;
  return data.insights.find((insight) => insight.id === focusId) ?? data.insights.find((insight) => insight.id === data.activeInsightId) ?? data.insights[0];
}

export function activeProposal(state: PrototypeState): Proposal | undefined {
  const data = currentCompanyData(state);
  const focusId = state.navigationFocus?.screen === "proposalVote" ? state.navigationFocus.focusId : undefined;
  return data.proposals.find((proposal) => proposal.id === focusId);
}

export function latestDecision(state: PrototypeState): Decision | undefined {
  return currentCompanyData(state).decisions[0];
}

export function latestVerification(state: PrototypeState): VerificationRecord | undefined {
  return currentCompanyData(state).verificationRecords[0];
}

export function latestVerificationForDecision(state: PrototypeState, decisionId?: string): VerificationRecord | undefined {
  if (!decisionId) {
    return latestVerification(state);
  }

  return verificationHistoryForDecision(state, decisionId)[0];
}

export function verificationHistoryForDecision(state: PrototypeState, decisionId: string): VerificationRecord[] {
  return currentCompanyData(state).verificationRecords
    .filter((record) => record.decisionId === decisionId)
    .sort((left, right) => {
      if (right.revision !== left.revision) {
        return right.revision - left.revision;
      }

      return Date.parse(right.verifiedAt) - Date.parse(left.verifiedAt);
    });
}
