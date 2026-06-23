import type { Dispatch } from "react";
import type { PrototypeState } from "../../domain/types";
import { commandMeta } from "../events";
import { canCurrentUser } from "../permissions";
import type { PrototypeAction } from "../store";

export function recordOutcome(state: PrototypeState, dispatch: Dispatch<PrototypeAction>, decisionId: string): boolean {
  if (!canCurrentUser(state, "outcome:record")) {
    dispatch({ type: "SET_PERMISSION_DENIED", message: "현재 역할은 실행 결과를 기록할 수 없습니다." });
    return false;
  }

  dispatch({
    type: "RECORD_OUTCOME",
    decisionId,
    beforeMetricValue: 13.8,
    afterMetricValue: 17.1,
    summary: "프로모션 조정과 공급 조건 재협의 후 평균 마진율이 3.3%p 회복되고 평균 출고 대기시간이 단축되었습니다.",
    notificationId: `notice-outcome-${Date.now()}`,
    ...commandMeta(state, "실행 결과 기록", "outcome", "outcome-margin-delay", "의사결정 실행 후 지표 변화를 기록하고 재분석 결과를 생성했습니다.")
  });
  return true;
}
