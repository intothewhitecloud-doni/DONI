import type { Dispatch } from "react";
import type { CandidateType, PrototypeState } from "../../domain/types";
import { commandMeta } from "../events";
import { canCurrentUser } from "../permissions";
import type { PrototypeAction } from "../store";

export function startAnalysisJob(state: PrototypeState, dispatch: Dispatch<PrototypeAction>): boolean {
  if (!canCurrentUser(state, "analysis:start")) {
    dispatch({ type: "SET_PERMISSION_DENIED", message: "현재 역할은 인공지능 분석을 시작할 수 없습니다." });
    return false;
  }

  dispatch({
    type: "START_ANALYSIS",
    ...commandMeta(state, "인공지능 분석 시작", "analysis_job", "analysis-job-main", "업로드된 파일을 기반으로 구조 추출 작업을 시작했습니다.")
  });
  return true;
}

export function advanceAnalysisJob(dispatch: Dispatch<PrototypeAction>): void {
  dispatch({ type: "ADVANCE_ANALYSIS", now: new Date().toISOString() });
}

export function setCandidateType(dispatch: Dispatch<PrototypeAction>, candidateType: CandidateType): void {
  dispatch({ type: "SET_CANDIDATE_TYPE", candidateType });
}

export function editCandidate(
  state: PrototypeState,
  dispatch: Dispatch<PrototypeAction>,
  candidateId: string,
  title: string,
  note: string,
  description?: string
): boolean {
  if (!canCurrentUser(state, "candidate:review")) {
    dispatch({ type: "SET_PERMISSION_DENIED", message: "현재 역할은 후보를 수정할 수 없습니다." });
    return false;
  }

  dispatch({
    type: "EDIT_CANDIDATE",
    candidateId,
    description,
    title,
    note,
    ...commandMeta(state, "후보 수정", "extraction_candidate", candidateId, "검토자가 추출 후보의 이름과 설명을 보정했습니다.")
  });
  return true;
}

export function excludeCandidate(state: PrototypeState, dispatch: Dispatch<PrototypeAction>, candidateId: string): boolean {
  if (!canCurrentUser(state, "candidate:review")) {
    dispatch({ type: "SET_PERMISSION_DENIED", message: "현재 역할은 후보를 제외할 수 없습니다." });
    return false;
  }

  dispatch({
    type: "EXCLUDE_CANDIDATE",
    candidateId,
    ...commandMeta(state, "후보 제외", "extraction_candidate", candidateId, "검토자가 데이터 구조에서 후보를 제외했습니다.")
  });
  return true;
}

export function confirmCandidates(state: PrototypeState, dispatch: Dispatch<PrototypeAction>, selectedCandidateIds?: string[]): boolean {
  if (!canCurrentUser(state, "candidate:confirm")) {
    dispatch({ type: "SET_PERMISSION_DENIED", message: "현재 역할은 데이터 구조를 확정할 수 없습니다." });
    return false;
  }

  dispatch({
    type: "CONFIRM_CANDIDATES",
    selectedCandidateIds,
    ...commandMeta(state, "데이터 구조 확정", "company", state.company.id, "확정 후보를 관리 대상, 업무 흐름, 연결 관계, 지표로 반영했습니다.")
  });
  return true;
}
