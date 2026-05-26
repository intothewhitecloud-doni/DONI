import type { Dispatch } from "react";
import { decisionIdForProposal } from "../../domain/result-scenarios";
import type { PrototypeState, VoteChoice } from "../../domain/types";
import { commandMeta } from "../events";
import { can } from "../permissions";
import { canVoteOnProposal } from "../policy";
import type { PrototypeAction } from "../store";

export function castVote(
  state: PrototypeState,
  dispatch: Dispatch<PrototypeAction>,
  proposalId: string,
  choice: VoteChoice,
  reason: string
): boolean {
  if (!can(state.session.role, "proposal:vote") || !canVoteOnProposal(state, proposalId)) {
    dispatch({ type: "SET_PERMISSION_DENIED", message: "현재 역할은 투표에 참여할 수 없습니다." });
    return false;
  }

  dispatch({
    type: "CAST_VOTE",
    proposalId,
    choice,
    reason,
    ...commandMeta(state, "투표 참여", "proposal", proposalId, "현재 사용자의 투표가 반영되었습니다.")
  });
  return true;
}

export function finalizeProposal(state: PrototypeState, dispatch: Dispatch<PrototypeAction>, proposalId: string): boolean {
  if (!can(state.session.role, "proposal:finalize")) {
    dispatch({ type: "SET_PERMISSION_DENIED", message: "현재 역할은 의사결정 결과를 확정할 수 없습니다." });
    return false;
  }

  dispatch({
    type: "FINALIZE_PROPOSAL",
    proposalId,
    ...commandMeta(state, "의사결정 결과 확정", "decision", decisionIdForProposal(proposalId), "투표 요약과 승인 기준을 근거로 의사결정 결과를 확정했습니다.")
  });
  return true;
}
