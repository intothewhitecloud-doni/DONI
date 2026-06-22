import type { Dispatch } from "react";
import { initialPrototypeState as preparedData } from "../../domain/mock-data";
import { reducer } from "../../domain/state-machine";
import type { PrototypeState, SourceFile } from "../../domain/types";
import { commandMeta } from "../events";
import { canCurrentUser } from "../permissions";
import { checkPersistedWriteBudget } from "../persistence";
import { sourceFileKindForName, validateSourceFileRename } from "../sourceFiles";
import type { PrototypeAction } from "../store";

type SourceFileInput = {
  name: string;
  size: number;
  description?: string;
  organizationCategoryId?: string;
  mimeType?: string;
  dataUrl?: string;
  textContent?: string;
  previewColumns?: string[];
  previewRows?: string[][];
  rowCount?: number;
};

function toSourceFile(file: SourceFileInput, index: number): SourceFile {
  const fileIdStem = file.name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, "-")
    .replace(/^-|-$/g, "");

  return {
    id: `source-${fileIdStem || "file"}-${index + 1}`,
    name: file.name,
    kind: sourceFileKindForName(file.name),
    description: file.description ?? defaultSourceFileDescription(file),
    rowCount: file.rowCount ?? 0,
    status: "ready",
    organizationCategoryId: file.organizationCategoryId,
    size: file.size,
    mimeType: file.mimeType,
    dataUrl: file.dataUrl,
    textContent: file.textContent,
    previewColumns: file.previewColumns,
    previewRows: file.previewRows
  };
}

function defaultSourceFileDescription(file: SourceFileInput): string {
  const fields = file.previewColumns?.filter(Boolean).slice(0, 4) ?? [];
  if (fields.length > 0) {
    return `${fields.join(", ")} 필드를 포함한 원천 데이터입니다.`;
  }

  return `${file.name} 업로드 원천 데이터입니다.`;
}

export function addSourceFiles(
  state: PrototypeState,
  dispatch: Dispatch<PrototypeAction>,
  files: SourceFileInput[],
  organizationCategoryId?: string
): boolean {
  if (!canCurrentUser(state, "source:upload")) {
    dispatch({ type: "SET_PERMISSION_DENIED", message: "현재 역할은 파일을 추가할 수 없습니다." });
    return false;
  }

  if (files.length === 0) {
    dispatch({ type: "SET_PERMISSION_DENIED", message: "추가할 파일을 선택해 주세요." });
    return false;
  }

  const action: PrototypeAction = {
    type: "ADD_SOURCE_FILES",
    files: files.map(toSourceFile),
    organizationCategoryId,
    notificationId: `notice-source-files-${Date.now()}`,
    ...commandMeta(state, "파일 추가", "source_file", "source-files", `${files.length}개 파일을 데이터 보관함에 추가했습니다.`)
  };
  const budget = checkPersistedWriteBudget(reducer(state, action));
  if (!budget.ok) {
    dispatch({ type: "SET_PERMISSION_DENIED", message: budget.message });
    return false;
  }

  dispatch(action);
  return true;
}

export function updateSourceFile(
  state: PrototypeState,
  dispatch: Dispatch<PrototypeAction>,
  fileId: string,
  patch: Pick<SourceFile, "kind" | "name"> & Partial<Pick<SourceFile, "description">> & { organizationCategoryId?: string }
): boolean {
  if (!canCurrentUser(state, "source:upload")) {
    dispatch({ type: "SET_PERMISSION_DENIED", message: "현재 역할은 파일 정보를 수정할 수 없습니다." });
    return false;
  }

  const currentFile = state.sourceFiles.find((file) => file.id === fileId);
  if (!currentFile) {
    dispatch({ type: "SET_PERMISSION_DENIED", message: "수정할 파일을 찾지 못했습니다." });
    return false;
  }

  const renameResult = validateSourceFileRename(currentFile.name, patch.name);
  if (!renameResult.valid) {
    dispatch({ type: "SET_PERMISSION_DENIED", message: renameResult.message });
    return false;
  }

  dispatch({
    type: "UPDATE_SOURCE_FILE",
    fileId,
    patch: { ...patch, name: renameResult.name },
    notificationId: `notice-source-file-update-${Date.now()}`,
    ...commandMeta(state, "파일 정보 수정", "source_file", fileId, "데이터 보관함의 파일 정보를 수정했습니다.")
  });
  return true;
}

export function applySourceFileToCurrentStandard(state: PrototypeState, dispatch: Dispatch<PrototypeAction>, fileId: string): boolean {
  if (!canCurrentUser(state, "source:upload") || !canCurrentUser(state, "analysis:start")) {
    dispatch({ type: "SET_PERMISSION_DENIED", message: "현재 역할은 파일을 현재 기준에 반영할 수 없습니다." });
    return false;
  }

  const currentFile = state.sourceFiles.find((file) => file.id === fileId);
  if (!currentFile) {
    dispatch({ type: "SET_PERMISSION_DENIED", message: "반영할 파일을 찾지 못했습니다." });
    return false;
  }

  dispatch({
    type: "APPLY_SOURCE_FILE_TO_CURRENT_STANDARD",
    fileId,
    notificationId: `notice-source-file-apply-${Date.now()}`,
    ...commandMeta(state, "현재 기준 반영", "source_file", fileId, "원천 데이터 관계를 현재 기준 데이터에 반영했습니다.")
  });
  return true;
}

export function removeSourceFile(state: PrototypeState, dispatch: Dispatch<PrototypeAction>, fileId: string): boolean {
  if (!canCurrentUser(state, "source:upload")) {
    dispatch({ type: "SET_PERMISSION_DENIED", message: "현재 역할은 파일을 제거할 수 없습니다." });
    return false;
  }

  dispatch({
    type: "REMOVE_SOURCE_FILE",
    fileId,
    notificationId: `notice-source-file-remove-${Date.now()}`,
    ...commandMeta(state, "파일 제거", "source_file", fileId, "데이터 보관함에서 파일을 제거했습니다.")
  });
  return true;
}

export function addPreparedSourceFiles(state: PrototypeState, dispatch: Dispatch<PrototypeAction>): boolean {
  if (!canCurrentUser(state, "source:upload")) {
    dispatch({ type: "SET_PERMISSION_DENIED", message: "현재 역할은 파일을 추가할 수 없습니다." });
    return false;
  }

  dispatch({
    type: "ADD_SOURCE_FILES",
    files: preparedData.sourceFiles,
    notificationId: `notice-source-files-${Date.now()}`,
    ...commandMeta(state, "파일 추가", "source_file", "source-files", "업무 파일을 데이터 보관함에 추가했습니다.")
  });
  return true;
}

export function uploadSampleFiles(state: PrototypeState, dispatch: Dispatch<PrototypeAction>): boolean {
  if (!canCurrentUser(state, "source:upload")) {
    dispatch({ type: "SET_PERMISSION_DENIED", message: "현재 역할은 소스 데이터를 업로드할 수 없습니다." });
    return false;
  }

  if (!canCurrentUser(state, "analysis:start")) {
    dispatch({ type: "SET_PERMISSION_DENIED", message: "현재 역할은 인공지능 분석을 시작할 수 없습니다." });
    return false;
  }

  dispatch({
    type: "UPLOAD_SAMPLE_FILES",
    notificationId: `notice-upload-${Date.now()}`,
    ...commandMeta(state, "소스 데이터 업로드", "source_file", "source-orders", "주문, 배송, 클레임, 마진 파일을 업로드했습니다.")
  });
  dispatch({
    type: "START_ANALYSIS",
    ...commandMeta(state, "인공지능 분석 시작", "analysis_job", "analysis-job-main", "업로드된 파일을 기반으로 구조 추출 작업을 시작했습니다.")
  });
  return true;
}
