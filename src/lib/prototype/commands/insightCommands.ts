import type { Dispatch } from "react";
import { proposalIdForInsight } from "../../domain/result-scenarios";
import type { PrototypeState } from "../../domain/types";
import { commandMeta } from "../events";
import { canCurrentUser } from "../permissions";
import type { PrototypeAction } from "../store";

export function createProposalFromInsight(
  state: PrototypeState,
  dispatch: Dispatch<PrototypeAction>,
  insightId: string
): boolean {
  if (!canCurrentUser(state, "insight:proposal")) {
    dispatch({ type: "SET_PERMISSION_DENIED", message: "현재 역할은 인사이트에서 안건을 만들 수 없습니다." });
    return false;
  }

  dispatch({
    type: "CREATE_PROPOSAL_FROM_INSIGHT",
    insightId,
    ...commandMeta(state, "의사결정 안건 생성", "proposal", proposalIdForInsight(insightId), "인공지능 인사이트를 근거로 투표 안건을 생성했습니다.")
  });
  return true;
}
