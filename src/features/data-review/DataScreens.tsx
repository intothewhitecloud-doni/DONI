"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card, SectionTitle } from "../../components/ui/Card";
import type { EvidenceReference, MetricValue, SourceFile } from "../../lib/domain/types";
import { can } from "../../lib/prototype/permissions";
import { getManagedObjectView } from "../../lib/prototype/queries/managedObjectQueries";
import { usePrototype } from "../../lib/prototype/PrototypeProvider";
import { KnowledgeGraph } from "./KnowledgeGraph";

type SourceFileUploadDraft = {
  name: string;
  size: number;
  mimeType?: string;
  dataUrl?: string;
  textContent?: string;
  previewColumns?: string[];
  previewRows?: string[][];
  rowCount?: number;
};

const sourceFileKindOptions = ["표 형식 데이터", "업무 문서", "업무 파일"];
const canonicalSourceKind: EvidenceReference["sourceKind"] = "canonical_sample";

export function DataVaultScreen() {
  const { commands, state } = usePrototype();
  const canManageFiles = can(state.session.role, "source:upload");
  const inputRef = useRef<HTMLInputElement>(null);
  const [activeFileId, setActiveFileId] = useState("");
  const [isReadingFiles, setIsReadingFiles] = useState(false);
  const [editingFile, setEditingFile] = useState({ kind: "", name: "" });
  const activeFile = useMemo(
    () => state.sourceFiles.find((file) => file.id === activeFileId) ?? state.sourceFiles[0],
    [activeFileId, state.sourceFiles]
  );
  const fileEvidence = activeFile
    ? state.evidence.filter((item) => item.sourceKind !== canonicalSourceKind && item.sourceFileId === activeFile.id)
    : [];
  const canonicalEvidence = state.evidence.filter((item) => item.sourceKind === canonicalSourceKind);

  useEffect(() => {
    if (activeFileId && state.sourceFiles.some((file) => file.id === activeFileId)) {
      return;
    }

    setActiveFileId(state.sourceFiles[0]?.id ?? "");
  }, [activeFileId, state.sourceFiles]);

  useEffect(() => {
    setEditingFile({
      kind: activeFile?.kind ?? "",
      name: activeFile?.name ?? ""
    });
  }, [activeFile]);

  async function handleFileInputChange(event: ChangeEvent<HTMLInputElement>) {
    const selectedFiles = Array.from(event.target.files ?? []);
    if (selectedFiles.length === 0) {
      return;
    }

    setIsReadingFiles(true);
    try {
      const results = await Promise.allSettled(selectedFiles.map(readSourceFileUpload));
      const files = results
        .filter((result): result is PromiseFulfilledResult<SourceFileUploadDraft> => result.status === "fulfilled")
        .map((result) => result.value);

      if (files.length > 0 && commands.addSourceFiles(files)) {
        event.currentTarget.value = "";
      }

      if (files.length === 0) {
        console.warn("선택한 파일을 읽지 못했습니다.");
      }
    } catch {
      console.warn("선택한 파일을 읽지 못했습니다.");
    } finally {
      setIsReadingFiles(false);
    }
  }

  return (
    <div className="space-y-8">
      <SectionTitle eyebrow="데이터 보관함" title="파일 추가와 분석 준비" description="업무 파일을 추가하고, 업로드된 파일의 내용과 근거 위치를 확인합니다." />
      <Card className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-950">파일 추가</h2>
            <p className="mt-1 text-sm text-slate-600">주문, 배송, 클레임, 상품, 마진, 공급사 관련 파일을 보관함에 추가합니다.</p>
          </div>
          {canManageFiles && (
            <div className="flex flex-wrap gap-2">
              <input
                ref={inputRef}
                className="hidden"
                type="file"
                multiple
                accept=".csv,.doc,.docx,.pdf,.tsv,.xls,.xlsx"
                onChange={handleFileInputChange}
              />
              <Button disabled={isReadingFiles} onClick={() => inputRef.current?.click()}>
                {isReadingFiles ? "파일 읽는 중" : "파일 추가"}
              </Button>
              <Button disabled={state.sourceFiles.length === 0} variant="secondary" onClick={commands.uploadSampleFiles}>
                분석 시작
              </Button>
            </div>
          )}
        </div>
      </Card>
      <div className="grid items-start gap-5 lg:grid-cols-[1fr_1.1fr]">
        <Card className="min-w-0 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-slate-950">보관 파일</h2>
            <Badge tone={state.sourceFiles.length > 0 ? "info" : "neutral"}>{state.sourceFiles.length}개</Badge>
          </div>
          {state.sourceFiles.length === 0 ? (
            <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-5">
              <p className="font-semibold text-slate-900">아직 추가된 파일이 없습니다</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">파일을 추가하면 이곳에서 조회하고 다운로드할 수 있습니다.</p>
            </div>
          ) : (
            state.sourceFiles.map((file) => (
              <button
                key={file.id}
                className={`w-full rounded-md border p-4 text-left transition ${
                  activeFile?.id === file.id ? "border-blue-500 bg-blue-50" : "border-slate-200 hover:bg-slate-50"
                }`}
                onClick={() => setActiveFileId(file.id)}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-bold text-slate-950">{file.name}</h3>
                    <p className="mt-2 text-sm text-slate-600">
                      {file.kind} · {file.rowCount > 0 ? `${file.rowCount.toLocaleString("ko-KR")}행` : "행 수 확인 전"}
                    </p>
                    <p className="mt-2 text-xs text-slate-500">
                      {file.uploadedAt ? `업로드 시각 ${new Date(file.uploadedAt).toLocaleString("ko-KR")}` : "업로드 전"}
                    </p>
                  </div>
                  <Badge tone={file.status === "ready" ? "neutral" : file.status === "uploaded" ? "success" : "info"}>
                    {fileStatusLabel(file.status)}
                  </Badge>
                </div>
              </button>
            ))
          )}
        </Card>
        <Card className="min-w-0 space-y-4">
          {activeFile ? (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <Badge tone={activeFile.status === "ready" ? "neutral" : "success"}>{fileStatusLabel(activeFile.status)}</Badge>
                  <h2 className="mt-3 text-xl font-bold text-slate-950">{activeFile.name}</h2>
                  <p className="mt-2 text-sm text-slate-600">{activeFile.kind}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" onClick={() => downloadSourceFile(activeFile)}>
                    파일 다운로드
                  </Button>
                  {canManageFiles && (
                    <Button
                      variant="danger"
                      onClick={() => {
                        if (commands.removeSourceFile(activeFile.id)) {
                          setActiveFileId("");
                        }
                      }}
                    >
                      파일 제거
                    </Button>
                  )}
                </div>
              </div>
              {canManageFiles && (
                <div className="grid gap-3 rounded-md border border-slate-200 bg-slate-50 p-3 md:grid-cols-[1fr_220px_auto]">
                  <label className="space-y-1">
                    <span className="text-xs font-bold text-slate-500">파일명</span>
                    <input
                      className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                      value={editingFile.name}
                      onChange={(event) => setEditingFile((current) => ({ ...current, name: event.target.value }))}
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs font-bold text-slate-500">파일 종류</span>
                    <select
                      className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                      value={editingFile.kind}
                      onChange={(event) => setEditingFile((current) => ({ ...current, kind: event.target.value }))}
                    >
                      {sourceFileKindOptions.map((kind) => (
                        <option key={kind} value={kind}>{kind}</option>
                      ))}
                    </select>
                  </label>
                  <div className="flex items-end">
                    <Button
                      className="w-full"
                      variant="secondary"
                      onClick={() => commands.updateSourceFile(activeFile.id, editingFile)}
                    >
                      정보 저장
                    </Button>
                  </div>
                </div>
              )}
              <div className="overflow-x-auto rounded-md border border-slate-200">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs font-bold text-slate-500">
                    <tr>
                      {filePreviewColumns(activeFile).map((column) => (
                        <th key={column} className="whitespace-nowrap px-3 py-2">{column}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filePreviewRows(activeFile).map((row) => (
                      <tr key={row.join("-")}>
                        {row.map((cell) => (
                          <td key={cell} className="whitespace-nowrap px-3 py-2 text-slate-700">{cell}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-bold text-slate-500">선택 파일 근거</p>
                <div className="mt-2 space-y-2">
                  {fileEvidence.length > 0 ? (
                    fileEvidence.map((evidence) => (
                      <div key={evidence.id} className="rounded-md bg-white p-3">
                        <p className="font-semibold text-slate-900">{evidence.label}</p>
                        <p className="mt-1 text-xs text-slate-500">{evidence.location}</p>
                        <p className="mt-2 text-sm leading-6 text-slate-600">{evidence.excerpt}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm leading-6 text-slate-600">분석 후에는 보관 파일에서 확인된 근거 위치가 이곳에 표시됩니다.</p>
                  )}
                </div>
              </div>
              <div className="rounded-md border border-blue-100 bg-blue-50 p-3">
                <p className="text-xs font-bold text-blue-700">분석 근거</p>
                <div className="mt-2 space-y-2">
                  {canonicalEvidence.length > 0 ? (
                    canonicalEvidence.map((evidence) => (
                      <div key={evidence.id} className="rounded-md bg-white p-3">
                        <p className="font-semibold text-slate-900">{evidence.label}</p>
                        <p className="mt-1 text-xs text-slate-500">{formatEvidenceSource(evidence)}</p>
                        <p className="mt-2 text-sm leading-6 text-slate-600">{evidence.excerpt}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm leading-6 text-slate-600">분석을 시작하면 파일의 행, 열, 신뢰도가 이곳에 표시됩니다.</p>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-5">
              <p className="font-semibold text-slate-900">조회할 파일을 선택하세요</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">파일을 추가하면 미리보기와 다운로드 버튼이 표시됩니다.</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function fileStatusLabel(status: SourceFile["status"]): string {
  if (status === "parsed") {
    return "분석됨";
  }

  if (status === "uploaded") {
    return "업로드됨";
  }

  return "추가됨";
}

function filePreviewColumns(file: SourceFile): string[] {
  if (file.previewColumns && file.previewColumns.length > 0) {
    return file.previewColumns;
  }

  if (file.name.includes("마진") || file.name.includes("상품")) {
    return ["상품군", "공급사", "마진율", "할인율"];
  }

  return ["주문번호", "고객군", "상태", "소요 시간"];
}

function filePreviewRows(file: SourceFile): string[][] {
  if (file.previewRows && file.previewRows.length > 0) {
    return file.previewRows;
  }

  if (file.name.includes("마진") || file.name.includes("상품")) {
    return [
      ["P-42", "공급업체 A사", "13.8%", "6.4%"],
      ["P-17", "공급업체 B사", "21.2%", "2.1%"],
      ["P-08", "공급업체 A사", "15.1%", "4.7%"]
    ];
  }

  return [
    ["O-184", "핵심 고객군", "출고 지연", "41시간"],
    ["O-205", "핵심 고객군", "클레임 접수", "18시간"],
    ["O-231", "일반 고객군", "정상 출고", "22시간"]
  ];
}

function downloadSourceFile(file: SourceFile): void {
  if (file.dataUrl) {
    const anchor = document.createElement("a");
    anchor.href = file.dataUrl;
    anchor.download = file.name;
    anchor.click();
    return;
  }

  const columns = filePreviewColumns(file);
  const rows = filePreviewRows(file);
  const csv = [columns, ...rows].map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = file.name;
  anchor.click();
  URL.revokeObjectURL(url);
}

function formatEvidenceSource(evidence: EvidenceReference): string {
  const parts = [
    evidence.sourceName ?? evidence.location,
    evidence.sheetName ? `${evidence.sheetName} 시트` : undefined,
    evidence.rowNumbers && evidence.rowNumbers.length > 0 ? `${evidence.rowNumbers.join(", ")}행` : undefined,
    evidence.columns && evidence.columns.length > 0 ? evidence.columns.join(", ") : undefined,
    typeof evidence.confidence === "number" ? `신뢰도 ${Math.round(evidence.confidence * 100)}%` : undefined
  ].filter(Boolean);

  return parts.join(" · ");
}

async function readSourceFileUpload(file: File): Promise<SourceFileUploadDraft> {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  const dataUrl = await readFileAsDataUrl(file);
  const base = {
    dataUrl,
    mimeType: file.type,
    name: file.name,
    size: file.size
  };

  if (extension === "csv" || extension === "tsv") {
    const textContent = await file.text();
    try {
      const preview = parseDelimitedPreview(textContent, extension === "tsv" ? "\t" : ",");
      return {
        ...base,
        textContent,
        previewColumns: preview.columns,
        previewRows: preview.rows,
        rowCount: preview.rowCount
      };
    } catch {
      return { ...base, textContent };
    }
  }

  if (extension === "xlsx") {
    try {
      const preview = await parseXlsxPreview(await file.arrayBuffer());
      return {
        ...base,
        previewColumns: preview.columns,
        previewRows: preview.rows,
        rowCount: preview.rowCount
      };
    } catch {
      return base;
    }
  }

  return base;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function parseDelimitedPreview(text: string, delimiter: string): { columns: string[]; rowCount: number; rows: string[][] } {
  const rows = parseDelimitedRows(text, delimiter).filter((row) => row.some((cell) => cell.trim().length > 0));
  const [columns = [], ...bodyRows] = rows;
  return {
    columns: columns.slice(0, 8),
    rowCount: bodyRows.length,
    rows: bodyRows.slice(0, 5).map((row) => row.slice(0, 8))
  };
}

function parseDelimitedRows(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      quoted = !quoted;
      continue;
    }

    if (char === delimiter && !quoted) {
      row.push(cell);
      cell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") {
        index += 1;
      }
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += char;
  }

  row.push(cell);
  rows.push(row);
  return rows;
}

async function parseXlsxPreview(buffer: ArrayBuffer): Promise<{ columns: string[]; rowCount: number; rows: string[][] }> {
  const entries = await readZipEntries(buffer);
  const firstSheet = entries.get("xl/worksheets/sheet1.xml");
  if (!firstSheet) {
    return { columns: [], rowCount: 0, rows: [] };
  }

  const sharedStrings = parseSharedStrings(entries.get("xl/sharedStrings.xml"));
  const xml = new TextDecoder("utf-8").decode(firstSheet);
  const document = new DOMParser().parseFromString(xml, "application/xml");
  const parsedRows = Array.from(document.getElementsByTagName("row")).map((rowNode) =>
    Array.from(rowNode.getElementsByTagName("c")).map((cellNode) => parseXlsxCell(cellNode, sharedStrings))
  );
  const [columns = [], ...bodyRows] = parsedRows.filter((row) => row.length > 0);
  return {
    columns: columns.slice(0, 8),
    rowCount: bodyRows.length,
    rows: bodyRows.slice(0, 5).map((row) => row.slice(0, 8))
  };
}

async function readZipEntries(buffer: ArrayBuffer): Promise<Map<string, Uint8Array>> {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  const decoder = new TextDecoder("utf-8");
  const entries = new Map<string, Uint8Array>();
  const endDirectoryOffset = findEndOfCentralDirectory(view);

  if (endDirectoryOffset >= 0) {
    const entryCount = view.getUint16(endDirectoryOffset + 10, true);
    let centralOffset = view.getUint32(endDirectoryOffset + 16, true);

    for (let index = 0; index < entryCount && centralOffset + 46 < bytes.length; index += 1) {
      if (view.getUint32(centralOffset, true) !== 0x02014b50) {
        break;
      }

      const method = view.getUint16(centralOffset + 10, true);
      const compressedSize = view.getUint32(centralOffset + 20, true);
      const fileNameLength = view.getUint16(centralOffset + 28, true);
      const extraLength = view.getUint16(centralOffset + 30, true);
      const commentLength = view.getUint16(centralOffset + 32, true);
      const localHeaderOffset = view.getUint32(centralOffset + 42, true);
      const nameStart = centralOffset + 46;
      const nameEnd = nameStart + fileNameLength;
      const name = decoder.decode(bytes.slice(nameStart, nameEnd));
      const localNameLength = view.getUint16(localHeaderOffset + 26, true);
      const localExtraLength = view.getUint16(localHeaderOffset + 28, true);
      const dataStart = localHeaderOffset + 30 + localNameLength + localExtraLength;
      const payload = bytes.slice(dataStart, dataStart + compressedSize);
      const decoded = await decodeZipPayload(payload, method);
      if (decoded) {
        entries.set(name, decoded);
      }

      centralOffset = nameEnd + extraLength + commentLength;
    }

    return entries;
  }

  let offset = 0;

  while (offset + 30 < bytes.length && view.getUint32(offset, true) === 0x04034b50) {
    const method = view.getUint16(offset + 8, true);
    const compressedSize = view.getUint32(offset + 18, true);
    const fileNameLength = view.getUint16(offset + 26, true);
    const extraLength = view.getUint16(offset + 28, true);
    const nameStart = offset + 30;
    const nameEnd = nameStart + fileNameLength;
    const dataStart = nameEnd + extraLength;
    const dataEnd = dataStart + compressedSize;
    const name = decoder.decode(bytes.slice(nameStart, nameEnd));
    const payload = bytes.slice(dataStart, dataEnd);
    const decoded = await decodeZipPayload(payload, method);
    if (decoded) {
      entries.set(name, decoded);
    }

    offset = dataEnd;
  }

  return entries;
}

function findEndOfCentralDirectory(view: DataView): number {
  for (let offset = view.byteLength - 22; offset >= 0; offset -= 1) {
    if (view.getUint32(offset, true) === 0x06054b50) {
      return offset;
    }
  }

  return -1;
}

async function decodeZipPayload(payload: Uint8Array, method: number): Promise<Uint8Array | undefined> {
  if (method === 0) {
    return payload;
  }

  if (method === 8 && "DecompressionStream" in window) {
    const payloadCopy = new Uint8Array(payload.byteLength);
    payloadCopy.set(payload);
    const stream = new Blob([payloadCopy.buffer]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  return undefined;
}

function parseSharedStrings(bytes?: Uint8Array): string[] {
  if (!bytes) {
    return [];
  }

  const xml = new TextDecoder("utf-8").decode(bytes);
  const document = new DOMParser().parseFromString(xml, "application/xml");
  return Array.from(document.getElementsByTagName("si")).map((item) =>
    Array.from(item.getElementsByTagName("t")).map((node) => node.textContent ?? "").join("")
  );
}

function parseXlsxCell(cellNode: Element, sharedStrings: string[]): string {
  const type = cellNode.getAttribute("t");
  if (type === "s") {
    const value = cellNode.getElementsByTagName("v")[0]?.textContent ?? "";
    return sharedStrings[Number(value)] ?? value;
  }

  const inlineText = cellNode.getElementsByTagName("t")[0]?.textContent;
  if (inlineText !== undefined) {
    return inlineText;
  }

  return cellNode.getElementsByTagName("v")[0]?.textContent ?? "";
}

export function ManagedObjectsScreen() {
  const { commands, state } = usePrototype();
  const hasFiles = state.sourceFiles.length > 0;
  const canPrepareAnalysis = can(state.session.role, "source:upload") && can(state.session.role, "analysis:start");
  const focusedObjectId = state.navigationFocus?.screen === "objects" ? state.navigationFocus.focusId : undefined;
  const [activeCategoryId, setActiveCategoryId] = useState(focusedObjectId ?? "");
  const [selectedGraphItemId, setSelectedGraphItemId] = useState<string | undefined>(undefined);
  const view = getManagedObjectView(state, activeCategoryId || focusedObjectId);

  useEffect(() => {
    if (view.categories.length === 0) {
      setActiveCategoryId("");
      return;
    }

    if (!activeCategoryId || !view.categories.some((category) => category.id === activeCategoryId)) {
      setActiveCategoryId(view.activeCategoryId);
    }
  }, [activeCategoryId, view.activeCategoryId, view.categories]);

  useEffect(() => {
    setSelectedGraphItemId(view.detail.defaultGraphItemId);
  }, [view.activeCategoryId, view.detail.defaultGraphItemId]);

  if (state.entities.length === 0) {
    return (
      <div className="space-y-8">
        <SectionTitle eyebrow="관리 대상" title="아직 정의된 관리 대상이 없습니다" description="관리 대상은 고객군, 공급사, 상품군처럼 의사결정의 기준이 되는 업무 객체입니다." />
        <EmptyAnalysisState
          body={hasFiles ? "추가된 파일을 분석하면 관리 대상 후보를 검토하고 확정할 수 있습니다." : "데이터 보관함에 업무 파일을 추가하면 관리 대상 후보를 추출할 수 있습니다."}
          buttonLabel={canPrepareAnalysis ? hasFiles ? "업로드 및 분석 시작" : "데이터 보관함에서 파일 추가" : undefined}
          onClick={canPrepareAnalysis ? hasFiles ? commands.uploadSampleFiles : () => commands.navigate("vault") : undefined}
          title={hasFiles ? "파일 분석이 필요합니다" : "등록된 파일이 없습니다"}
        />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <SectionTitle eyebrow="관리 대상" title="관리 대상 카테고리와 연결 구조" description="고객군, 공급사, 상품군 단위로 목록을 보고 상세에서 하위 대상과 업무흐름 그래프를 확인합니다." />
      <div className="grid items-start gap-5 lg:grid-cols-[360px_1fr]">
        <Card className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-slate-950">관리 대상 목록</h2>
            <Badge tone="info">{view.categories.length}개</Badge>
          </div>
          {view.categories.map((category) => (
            <button
              key={category.id}
              className={`w-full rounded-md border p-4 text-left transition ${
                view.activeCategoryId === category.id ? "border-blue-500 bg-blue-50" : "border-slate-200 bg-white hover:bg-slate-50"
              }`}
              onClick={() => setActiveCategoryId(category.id)}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Badge tone="info">{category.kind}</Badge>
                  <h2 className="mt-2 text-lg font-bold text-slate-950">{category.label}</h2>
                </div>
                <Badge tone={category.tone}>{category.statusLabel}</Badge>
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-600">{category.summary}</p>
              <p className="mt-2 text-xs font-semibold text-slate-500">하위 대상 {category.instanceCount}개</p>
            </button>
          ))}
        </Card>
        <Card className="min-w-0 space-y-5">
          {view.detail.category ? (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <Badge tone="info">{view.detail.category.kind}</Badge>
                  <h2 className="mt-3 text-2xl font-bold text-slate-950">{view.detail.category.label}</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{view.detail.category.description}</p>
                </div>
                <Badge tone={view.detail.category.tone}>{view.detail.category.statusLabel}</Badge>
              </div>
              <div className="grid gap-3 md:grid-cols-4">
                <DetailStat label="하위 대상" value={`${view.detail.instances.length}개`} />
                <DetailStat label="업무 흐름" value={`${view.detail.events.length}단계`} />
                <DetailStat label="연결" value={`${view.detail.graphEdges.length}개`} />
                <DetailStat label="지표" value={`${view.detail.metrics.length}개`} />
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {view.detail.instances.map((instance) => (
                  <div key={instance.id} className="rounded-md border border-slate-200 bg-white p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Badge tone="info">{instance.kind}</Badge>
                      <Badge tone={instance.status.includes("주의") || instance.status.includes("필요") ? "warning" : "success"}>{instance.status}</Badge>
                    </div>
                    <h3 className="mt-3 font-bold text-slate-950">{instance.name}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{instance.summary}</p>
                    <p className="mt-2 text-xs font-semibold text-slate-500">담당: {instance.owner}</p>
                  </div>
                ))}
              </div>
              <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="font-bold text-slate-950">Knowledge Graph</h3>
                  <Badge tone="neutral">탐색형 그래프</Badge>
                </div>
                <div className="mt-4">
                  <KnowledgeGraph
                    detail={view.detail}
                    evidence={state.evidence}
                    metrics={state.metricDefinitions}
                    selectedItemId={selectedGraphItemId}
                    onSelectItem={setSelectedGraphItemId}
                  />
                </div>
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <LinkedList
                  title="연결 지표"
                  items={view.detail.metrics.map(({ definition, value }) => `${definition.name}: ${value?.value ?? "-"}${definition.unit}`)}
                />
                <LinkedList
                  title="업무 흐름"
                  items={view.detail.events.map((event) => `${event.name} · ${event.status} · ${event.durationHours}시간`)}
                />
                <LinkedList
                  title="연결 요약"
                  items={view.detail.graphEdges.map((edge) => {
                    const from = view.detail.graphNodes.find((node) => node.id === edge.fromId)?.label ?? edge.fromId;
                    const to = view.detail.graphNodes.find((node) => node.id === edge.toId)?.label ?? edge.toId;
                    const type = view.detail.graphLegend.find((item) => item.edgeType === edge.edgeType)?.label ?? edge.edgeType;
                    return `${type}: ${from} → ${to} · ${edge.label}`;
                  })}
                />
                <LinkedList
                  title="인사이트와 결정 이력"
                  items={[
                    ...view.detail.insights.map((insight) => `인사이트: ${insight.title}`),
                    ...view.detail.decisions.map((decision) => `결정: ${decision.title}`)
                  ]}
                />
              </div>
            </>
          ) : (
            <p className="text-sm text-slate-600">조회할 관리 대상 카테고리를 선택하세요.</p>
          )}
        </Card>
      </div>
    </div>
  );
}

function DetailStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-3">
      <p className="text-xs font-bold text-slate-500">{label}</p>
      <p className="mt-2 text-xl font-bold text-slate-950">{value}</p>
    </div>
  );
}

export function WorkflowScreen() {
  const { commands, state } = usePrototype();
  const hasFiles = state.sourceFiles.length > 0;
  const canPrepareAnalysis = can(state.session.role, "source:upload") && can(state.session.role, "analysis:start");
  const focusedEventId = state.navigationFocus?.screen === "workflow" ? state.navigationFocus.focusId : undefined;

  if (state.events.length === 0) {
    return (
      <div className="space-y-8">
        <SectionTitle eyebrow="업무 흐름" title="아직 정의된 업무 이벤트가 없습니다" description="업무 이벤트는 주문 접수, 출고, 클레임 처리처럼 시간과 상태가 있는 업무 흐름입니다." />
        <EmptyAnalysisState
          body={hasFiles ? "추가된 파일을 분석하면 업무 이벤트와 병목 후보가 표시됩니다." : "업무 파일을 먼저 추가하면 주문, 출고, 클레임 흐름을 추출할 수 있습니다."}
          buttonLabel={canPrepareAnalysis ? hasFiles ? "업로드 및 분석 시작" : "데이터 보관함에서 파일 추가" : undefined}
          onClick={canPrepareAnalysis ? hasFiles ? commands.uploadSampleFiles : () => commands.navigate("vault") : undefined}
          title={hasFiles ? "파일 분석이 필요합니다" : "등록된 파일이 없습니다"}
        />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <SectionTitle eyebrow="업무 흐름" title="최근 이벤트와 병목" description="주문, 출고, 클레임 흐름을 증거와 함께 확인합니다." />
      <Card className="space-y-3">
        {state.events.map((event) => {
          const entity = state.entities.find((item) => item.id === event.objectId);
          const bindings = state.workflowMetricBindings.filter((binding) => binding.eventId === event.id);
          const connectedObjectIds = new Set([event.objectId, ...bindings.flatMap((binding) => binding.sourceManagedObjectIds)]);
          const connectedEntities = state.entities.filter((item) => connectedObjectIds.has(item.id));
          const connectedMetrics = state.metricDefinitions.filter((metric) => bindings.some((binding) => binding.metricId === metric.id));
          const connectedRelations = state.relations.filter((relation) => connectedObjectIds.has(relation.fromId) || connectedObjectIds.has(relation.toId));

          return (
            <div
              key={event.id}
              className={`grid items-start gap-3 rounded-md border p-4 md:grid-cols-[1fr_190px_120px] ${
                focusedEventId === event.id ? "border-blue-500 bg-blue-50" : "border-slate-200 bg-white"
              }`}
            >
              <div>
                <p className="font-bold text-slate-950">{event.name}</p>
                <p className="mt-1 text-sm text-slate-600">대표 관리 대상: {entity ? `${entity.kind} · ${entity.name}` : "확인 필요"}</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  연결 관리 대상: {connectedEntities.map((item) => `${item.kind} ${item.name}`).join(", ") || "없음"}
                </p>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  관계 연결: {connectedRelations.map((relation) => relation.type).join(", ") || "없음"}
                </p>
              </div>
              <div className="space-y-1 text-sm text-slate-600">
                <p>소요 {event.durationHours}시간</p>
                <p>지표 {connectedMetrics.map((metric) => metric.name).join(", ") || "없음"}</p>
              </div>
              <div>
                <Badge tone={event.status === "지연" ? "warning" : "info"}>{event.status}</Badge>
              </div>
            </div>
          );
        })}
      </Card>
    </div>
  );
}

export function MetricsScreen() {
  const { commands, state } = usePrototype();
  const hasFiles = state.sourceFiles.length > 0;
  const canPrepareAnalysis = can(state.session.role, "source:upload") && can(state.session.role, "analysis:start");
  const canOpenInsightDetail = can(state.session.role, "insight:proposal");
  const focusedMetricId = state.navigationFocus?.screen === "metrics" ? state.navigationFocus.focusId : undefined;

  if (state.metricDefinitions.length === 0) {
    return (
      <div className="space-y-8">
        <SectionTitle eyebrow="지표" title="아직 계산할 지표가 없습니다" description="지표는 업무 파일에서 도출된 수치 기준이며, 연결 관계와 함께 의사결정 안건의 근거가 됩니다." />
        <EmptyAnalysisState
          body={hasFiles ? "추가된 파일을 분석하면 마진율, 처리 시간, 클레임률 같은 지표 후보를 확인할 수 있습니다." : "데이터 보관함에 파일을 추가하면 지표 후보를 추출할 수 있습니다."}
          buttonLabel={canPrepareAnalysis ? hasFiles ? "업로드 및 분석 시작" : "데이터 보관함에서 파일 추가" : undefined}
          onClick={canPrepareAnalysis ? hasFiles ? commands.uploadSampleFiles : () => commands.navigate("vault") : undefined}
          title={hasFiles ? "파일 분석이 필요합니다" : "등록된 파일이 없습니다"}
        />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <SectionTitle eyebrow="지표" title="계산 기준과 관련 안건" description="각 지표는 증거 위치, 계산식, 관련 인사이트와 연결됩니다." />
      <div className="grid gap-4 lg:grid-cols-3">
        {state.metricDefinitions.map((definition) => {
          const value = state.metricValues.find((item) => item.metricId === definition.id);
          const relatedInsights = state.insights.filter((insight) => insight.relatedMetricIds.includes(definition.id));
          const relatedProposals = state.proposals.filter((proposal) => relatedInsights.some((insight) => insight.id === proposal.insightId));
          const relatedRelations = state.relations.filter((relation) => relation.metricIds?.includes(definition.id));
          const evidenceLabels = state.evidence.filter((evidence) => value?.evidenceIds.includes(evidence.id)).map((evidence) => evidence.label);
          const basisItems = value?.basis ? Object.entries(value.basis).map(([key, basisValue]) => `${basisLabel(key)} ${basisValue}`) : [];
          return (
            <Card key={definition.id} className={`space-y-4 ${focusedMetricId === definition.id ? "border-blue-500 bg-blue-50" : ""}`}>
              <Badge tone={value?.status === "critical" ? "danger" : value?.status === "warning" ? "warning" : "success"}>{value?.status === "critical" ? "위험" : value?.status === "warning" ? "주의" : "정상"}</Badge>
              <h2 className="text-xl font-bold text-slate-950">{definition.name}</h2>
              <p className="text-3xl font-bold text-slate-950">
                {value?.value}
                <span className="ml-1 text-base text-slate-500">{definition.unit}</span>
              </p>
              <p className="text-sm leading-6 text-slate-600">계산식: {definition.formula}</p>
              <p className="text-sm text-slate-500">이전 값 {value?.previousValue}{definition.unit}</p>
              {value && <MetricTrendChart value={value} unit={definition.unit} />}
              <LinkedList title="계산 근거" items={basisItems} />
              <LinkedList title="근거 위치" items={evidenceLabels} />
              <LinkedList
                title="관련 연결"
                items={relatedRelations.map((relation) => {
                  const from = domainNodeLabel(state, relation.fromId);
                  const to = domainNodeLabel(state, relation.toId);
                  const confidence = typeof relation.confidence === "number" ? ` · 신뢰도 ${Math.round(relation.confidence * 100)}%` : "";
                  return `${from} → ${to} · ${relation.type}${confidence}`;
                })}
              />
              <LinkedList title="관련 인사이트" items={relatedInsights.map((insight) => insight.title)} />
              <LinkedList title="관련 안건" items={relatedProposals.length > 0 ? relatedProposals.map((proposal) => proposal.title) : ["아직 생성된 안건 없음"]} />
              {relatedInsights.length > 0 && canOpenInsightDetail && (
                <Button
                  variant="secondary"
                  onClick={() => commands.navigateToTarget({ screen: "insightDetail", focusId: relatedInsights[0].id, label: "연결 인사이트 보기" })}
                >
                  연결 인사이트 보기
                </Button>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function MetricTrendChart({ unit, value }: { unit: string; value: MetricValue }) {
  const points = value.series?.length > 0
    ? value.series
    : [
        { label: "이전", value: value.previousValue },
        { label: "현재", value: value.value }
      ];
  const maxValue = Math.max(1, Math.max(...points.map((point) => point.value)));
  const color = value.status === "critical" ? "bg-rose-500" : value.status === "warning" ? "bg-amber-500" : "bg-blue-500";

  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-bold text-slate-500">그래프</p>
        <Badge tone="info">{chartTypeLabel(value.chartType)}</Badge>
      </div>
      <div className="mt-4 flex h-28 items-end gap-2">
        {points.map((point, index) => {
          const isCurrent = index === points.length - 1;
          const heightPercent = Math.max(10, (point.value / maxValue) * 100);

          return (
            <div key={`${value.id}-${point.label}`} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
              <span className={`text-xs font-bold ${isCurrent ? "text-slate-900" : "text-slate-500"}`}>
                {point.value}{unit}
              </span>
              <div className={`w-full rounded-t-md ${isCurrent ? color : "bg-slate-200"}`} style={{ height: `${heightPercent}%` }} />
              <p className="mt-1 w-full truncate text-center text-xs font-semibold text-slate-600">{point.label}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EmptyAnalysisState({
  body,
  buttonLabel,
  onClick,
  title
}: {
  body: string;
  buttonLabel?: string;
  onClick?: () => void;
  title: string;
}) {
  return (
    <Card className="space-y-4 border-dashed bg-slate-50">
      <Badge tone="neutral">준비 필요</Badge>
      <div>
        <h2 className="text-xl font-bold text-slate-950">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
      </div>
      <div className="grid gap-3 md:grid-cols-4">
        {["파일 추가", "구조 분석", "후보 검토", "운영 반영"].map((step, index) => (
          <div key={step} className="rounded-md border border-slate-200 bg-white p-3">
            <Badge tone={index === 0 ? "warning" : "neutral"}>{index === 0 ? "다음 단계" : "대기"}</Badge>
            <p className="mt-2 text-sm font-semibold text-slate-900">{step}</p>
          </div>
        ))}
      </div>
      {buttonLabel && onClick && <Button onClick={onClick}>{buttonLabel}</Button>}
    </Card>
  );
}

function LinkedList({ items, title }: { items: string[]; title: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-3">
      <p className="text-xs font-bold text-slate-500">{title}</p>
      <ul className="mt-2 space-y-1 text-sm leading-6 text-slate-600">
        {items.length > 0 ? items.map((item) => <li key={item}>{item}</li>) : <li>연결 항목 없음</li>}
      </ul>
    </div>
  );
}

function chartTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    bar: "막대",
    line: "선",
    pie: "비율",
    table: "표",
    time_series: "시계열"
  };

  return labels[type] ?? "차트";
}

function basisLabel(key: string): string {
  const labels: Record<string, string> = {
    averageMarginPercent: "평균마진율",
    averageWaitHours: "평균대기",
    claimRows: "클레임 행",
    customerSegment: "고객군",
    delayedRows: "지연 행",
    delayRatePercent: "지연률",
    discountRange: "할인율",
    p42ClaimRows: "P-42 클레임",
    p42OrderRows: "P-42 주문",
    returnCost: "반품비용",
    rows: "계산 행",
    source: "원본"
  };

  return labels[key] ?? key;
}

function domainNodeLabel(state: ReturnType<typeof usePrototype>["state"], nodeId: string): string {
  return (
    state.entities.find((entity) => entity.id === nodeId)?.name ??
    state.events.find((event) => event.id === nodeId)?.name ??
    state.metricDefinitions.find((metric) => metric.id === nodeId)?.name ??
    state.insights.find((insight) => insight.id === nodeId)?.title ??
    nodeId
  );
}
