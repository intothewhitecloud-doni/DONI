import type { Dispatch } from "react";
import { initialPrototypeState as preparedData } from "../../domain/mock-data";
import type { PrototypeState, SourceFile } from "../../domain/types";
import { commandMeta } from "../events";
import { can } from "../permissions";
import type { PrototypeAction } from "../store";

type SourceFileInput = {
  name: string;
  size: number;
  mimeType?: string;
  dataUrl?: string;
  textContent?: string;
  previewColumns?: string[];
  previewRows?: string[][];
  rowCount?: number;
};

function toSourceFile(file: SourceFileInput, index: number): SourceFile {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  const baseId = file.name
    .replace(/\.[^.]+$/, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, "-")
    .replace(/^-|-$/g, "");

  const kindByExtension: Record<string, string> = {
    csv: "표 형식 데이터",
    doc: "업무 문서",
    docx: "업무 문서",
    pdf: "업무 문서",
    tsv: "표 형식 데이터",
    xls: "표 형식 데이터",
    xlsx: "표 형식 데이터"
  };

  return {
    id: `source-${baseId || "file"}-${index + 1}`,
    name: file.name,
    kind: kindByExtension[extension] ?? "업무 파일",
    rowCount: file.rowCount ?? Math.max(1, Math.round(file.size / 120)),
    status: "ready",
    size: file.size,
    mimeType: file.mimeType,
    dataUrl: file.dataUrl,
    textContent: file.textContent,
    previewColumns: file.previewColumns,
    previewRows: file.previewRows
  };
}

export function addSourceFiles(state: PrototypeState, dispatch: Dispatch<PrototypeAction>, files: SourceFileInput[]): boolean {
  if (!can(state.session.role, "source:upload")) {
    dispatch({ type: "SET_PERMISSION_DENIED", message: "현재 역할은 파일을 추가할 수 없습니다." });
    return false;
  }

  if (files.length === 0) {
    dispatch({ type: "SET_PERMISSION_DENIED", message: "추가할 파일을 선택해 주세요." });
    return false;
  }

  dispatch({
    type: "ADD_SOURCE_FILES",
    files: files.map(toSourceFile),
    notificationId: `notice-source-files-${Date.now()}`,
    ...commandMeta(state, "파일 추가", "source_file", "source-files", `${files.length}개 파일을 데이터 보관함에 추가했습니다.`)
  });
  return true;
}

export function updateSourceFile(
  state: PrototypeState,
  dispatch: Dispatch<PrototypeAction>,
  fileId: string,
  patch: Pick<SourceFile, "kind" | "name">
): boolean {
  if (!can(state.session.role, "source:upload")) {
    dispatch({ type: "SET_PERMISSION_DENIED", message: "현재 역할은 파일 정보를 수정할 수 없습니다." });
    return false;
  }

  dispatch({
    type: "UPDATE_SOURCE_FILE",
    fileId,
    patch,
    notificationId: `notice-source-file-update-${Date.now()}`,
    ...commandMeta(state, "파일 정보 수정", "source_file", fileId, "데이터 보관함의 파일 정보를 수정했습니다.")
  });
  return true;
}

export function removeSourceFile(state: PrototypeState, dispatch: Dispatch<PrototypeAction>, fileId: string): boolean {
  if (!can(state.session.role, "source:upload")) {
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
  if (!can(state.session.role, "source:upload")) {
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
  if (!can(state.session.role, "source:upload")) {
    dispatch({ type: "SET_PERMISSION_DENIED", message: "현재 역할은 소스 데이터를 업로드할 수 없습니다." });
    return false;
  }

  if (!can(state.session.role, "analysis:start")) {
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
