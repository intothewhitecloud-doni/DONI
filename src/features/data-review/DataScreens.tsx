"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card, SectionTitle } from "../../components/ui/Card";
import { MetricChart } from "../../components/ui/MetricChart";
import { Popup } from "../../components/ui/Popup";
import type { DomainTypeColor, DomainTypeDefinition, EvidenceReference, MetricValue, SourceFile } from "../../lib/domain/types";
import { UNASSIGNED_ORGANIZATION_CATEGORY_ID } from "../../lib/domain/types";
import {
  displayTypeLabel,
  domainTypeColorHex,
  normalizeHexColor,
  normalizeTypeColor
} from "../../lib/domain/type-catalog";
import { canCurrentUser } from "../../lib/prototype/permissions";
import { getManagedObjectView } from "../../lib/prototype/queries/managedObjectQueries";
import { usePrototype } from "../../lib/prototype/PrototypeProvider";
import { visibleOrganizationCategories } from "../../lib/prototype/organizationCategories";
import {
  BINARY_SOURCE_FILE_LIMIT_BYTES,
  findOversizedBinarySourceFile,
  SUPPORTED_SOURCE_FILE_ACCEPT,
  validateSourceFileRename
} from "../../lib/prototype/sourceFiles";
import { KnowledgeGraph } from "./KnowledgeGraph";
import { DataVaultRevisionWorkbench } from "./DataVaultRevisionWorkbench";
import { DataVaultUploadPopup } from "./DataVaultUploadPopup";
import type { VaultTabId } from "./dataVaultRevisionFixtures";
import {
  downloadSourceFile
} from "./SourceFilePreviewPanel";

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
  const canManageFiles = canCurrentUser(state, "source:upload");
  const inputRef = useRef<HTMLInputElement>(null);
  const [activeFileId, setActiveFileId] = useState("");
  const [isReadingFiles, setIsReadingFiles] = useState(false);
  const [editingFile, setEditingFile] = useState({ kind: "", name: "" });
  const [fileFeedback, setFileFeedback] = useState("");
  const [activeOrganizationCategoryId, setActiveOrganizationCategoryId] = useState("");
  const [activeVaultTab, setActiveVaultTab] = useState<VaultTabId>("source");
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const organizationCategories = useMemo(
    () => visibleOrganizationCategories(state.organizationCategories, { sourceFiles: state.sourceFiles }),
    [state.organizationCategories, state.sourceFiles]
  );
  const selectedOrganizationCategoryId = organizationCategories.some((category) => category.id === activeOrganizationCategoryId)
    ? activeOrganizationCategoryId
    : organizationCategories[0]?.id ?? UNASSIGNED_ORGANIZATION_CATEGORY_ID;
  const selectedOrganizationCategoryName =
    organizationCategories.find((category) => category.id === selectedOrganizationCategoryId)?.name ?? "미지정";
  const visibleSourceFiles = useMemo(
    () => state.sourceFiles.filter((file) => (file.organizationCategoryId ?? UNASSIGNED_ORGANIZATION_CATEGORY_ID) === selectedOrganizationCategoryId),
    [selectedOrganizationCategoryId, state.sourceFiles]
  );
  const activeFile = useMemo(
    () => visibleSourceFiles.find((file) => file.id === activeFileId) ?? visibleSourceFiles[0],
    [activeFileId, visibleSourceFiles]
  );
  const fileEvidence = activeFile
    ? state.evidence.filter((item) => item.sourceKind !== canonicalSourceKind && item.sourceFileId === activeFile.id)
    : [];
  const canonicalEvidence = state.evidence.filter((item) => item.sourceKind === canonicalSourceKind);

  useEffect(() => {
    if (activeFileId && visibleSourceFiles.some((file) => file.id === activeFileId)) {
      return;
    }

    setActiveFileId(visibleSourceFiles[0]?.id ?? "");
  }, [activeFileId, visibleSourceFiles]);

  useEffect(() => {
    if (organizationCategories.some((category) => category.id === activeOrganizationCategoryId)) {
      return;
    }

    setActiveOrganizationCategoryId(organizationCategories[0]?.id ?? "");
  }, [activeOrganizationCategoryId, organizationCategories]);

  useEffect(() => {
    setEditingFile({
      kind: activeFile?.kind ?? "",
      name: activeFile?.name ?? ""
    });
  }, [activeFile]);

  async function handleFileInputChange(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const selectedFiles = Array.from(event.target.files ?? []);
    if (selectedFiles.length === 0) {
      return;
    }

    const oversizedFile = findOversizedBinarySourceFile(selectedFiles);
    if (oversizedFile) {
      setFileFeedback(
        `${oversizedFile.name} 파일은 ${(BINARY_SOURCE_FILE_LIMIT_BYTES / 1024 / 1024).toLocaleString("ko-KR")}MB 이하만 추가할 수 있습니다. 선택한 파일 묶음은 추가되지 않았습니다.`
      );
      input.value = "";
      return;
    }

    setFileFeedback("");
    setIsReadingFiles(true);
    try {
      const results = await Promise.allSettled(selectedFiles.map(readSourceFileUpload));
      const files = results
        .filter((result): result is PromiseFulfilledResult<SourceFileUploadDraft> => result.status === "fulfilled")
        .map((result) => result.value);

      if (files.length > 0) {
        if (commands.addSourceFiles(files, selectedOrganizationCategoryId)) {
          input.value = "";
          setFileFeedback("");
          setIsUploadOpen(false);
        } else {
          setFileFeedback("파일을 추가하지 못했습니다. 화면 상단의 알림 내용을 확인해 주세요.");
        }
      }

      if (files.length === 0) {
        setFileFeedback("선택한 파일을 읽지 못했습니다.");
      }
    } catch {
      setFileFeedback("선택한 파일을 읽지 못했습니다.");
    } finally {
      setIsReadingFiles(false);
    }
  }

  function handleSaveFileInfo() {
    if (!activeFile) {
      return;
    }

    const renameResult = validateSourceFileRename(activeFile.name, editingFile.name);
    if (!renameResult.valid) {
      setFileFeedback(renameResult.message);
      return;
    }

    setFileFeedback("");
    commands.updateSourceFile(activeFile.id, { ...editingFile, name: renameResult.name });
  }

  function handleRemoveFile(fileId: string) {
    if (commands.removeSourceFile(fileId)) {
      setActiveFileId("");
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <SectionTitle eyebrow="데이터 보관함" title="원천 데이터 영향과 변화 흐름" />
        </div>
        {canManageFiles && (
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button disabled={isReadingFiles} onClick={() => setIsUploadOpen(true)}>
              + 업로드
            </Button>
          </div>
        )}
      </div>
      {isUploadOpen && (
        <DataVaultUploadPopup
          accept={SUPPORTED_SOURCE_FILE_ACCEPT}
          fileFeedback={fileFeedback}
          inputRef={inputRef}
          isReadingFiles={isReadingFiles}
          selectedCategoryName={selectedOrganizationCategoryName}
          onClose={() => setIsUploadOpen(false)}
          onFileInputChange={handleFileInputChange}
        />
      )}
      {state.sourceFiles.length === 0 ? (
        <DataVaultEmptyState canManageFiles={canManageFiles} isReadingFiles={isReadingFiles} onUpload={() => setIsUploadOpen(true)} />
      ) : (
        <DataVaultRevisionWorkbench
          activeFile={activeFile}
          activeTab={activeVaultTab}
          allSourceFiles={state.sourceFiles}
          canManageFiles={canManageFiles}
          canonicalEvidence={canonicalEvidence}
          editingFile={editingFile}
          fileEvidence={fileEvidence}
          fileFeedback={fileFeedback}
          organizationCategories={organizationCategories}
          selectedOrganizationCategoryId={selectedOrganizationCategoryId}
          sourceFileKindOptions={sourceFileKindOptions}
          sourceFiles={visibleSourceFiles}
          onChangeEditingFile={setEditingFile}
          onDownloadFile={downloadSourceFile}
          onRemoveFile={handleRemoveFile}
          onSaveFileInfo={handleSaveFileInfo}
          onSelectFile={setActiveFileId}
          onSelectOrganizationCategory={setActiveOrganizationCategoryId}
          onSelectTab={setActiveVaultTab}
        />
      )}
    </div>
  );
}

function DataVaultEmptyState({
  canManageFiles,
  isReadingFiles,
  onUpload
}: {
  canManageFiles: boolean;
  isReadingFiles: boolean;
  onUpload: () => void;
}) {
  return (
    <Card className="min-h-[420px] overflow-hidden" density="flush">
      <div className="grid min-h-[420px] lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col items-start justify-center p-8 sm:p-10">
          <Badge tone="neutral">원천 데이터 없음</Badge>
          <h2 className="mt-5 max-w-2xl text-title-lg text-ink md:text-display-sm">데이터 보관함에 등록된 파일이 없습니다</h2>
          <p className="mt-4 max-w-2xl text-body-sm leading-6 text-muted">
            파일을 추가하면 정보 보정, 구조 보기, 현재 기준 반영을 이어서 확인합니다.
          </p>
          {canManageFiles && (
            <div className="mt-6">
              <Button disabled={isReadingFiles} onClick={onUpload}>
                + 업로드
              </Button>
            </div>
          )}
        </div>
        <div className="border-t border-hairline bg-slate-50 p-6 lg:border-l lg:border-t-0">
          <div className="grid h-full content-center gap-3">
            {["파일 업로드", "정보 보정", "구조 보기", "현재 기준 반영"].map((label, index) => (
              <div key={label} className="flex items-center gap-3 rounded-md border border-slate-200 bg-white p-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-blue-50 text-sm font-bold text-blue-700">
                  {index + 1}
                </span>
                <span className="text-sm font-bold text-slate-900">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
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

  if (extension === "xlsx" || extension === "xls") {
    let preview = buildSpreadsheetPreview(file, extension);

    try {
      if (extension === "xlsx") {
        const parsedPreview = await parseXlsxPreview(await file.arrayBuffer());
        if (hasWorkbookPreview(parsedPreview)) {
          preview = parsedPreview;
        }
      }
    } catch {
      preview = buildSpreadsheetPreview(file, extension);
    }

    return {
      ...base,
      previewColumns: preview.columns,
      previewRows: preview.rows,
      rowCount: preview.rowCount
    };
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

function hasWorkbookPreview(preview: { columns: string[]; rowCount: number; rows: string[][] }): boolean {
  return preview.columns.length > 0 && preview.rows.length > 0;
}

function buildSpreadsheetPreview(file: File, extension: string): { columns: string[]; rowCount: number; rows: string[][] } {
  const rows = [
    ["Sheet1", "파일명", file.name, "업로드됨"],
    ["Sheet1", "파일 형식", extension.toUpperCase(), "표 형식 데이터"],
    ["Sheet1", "파일 크기", formatUploadPreviewSize(file.size), "보관됨"],
    ["Sheet1", "미리보기", "실제 행 파싱은 추후 구현", "샘플 흐름"]
  ];

  return {
    columns: ["시트", "항목", "원천값", "상태"],
    rowCount: rows.length,
    rows
  };
}

function formatUploadPreviewSize(size: number): string {
  if (size < 1024) {
    return `${size.toLocaleString("ko-KR")} bytes`;
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toLocaleString("ko-KR", { maximumFractionDigits: 1 })} KB`;
  }

  return `${(size / 1024 / 1024).toLocaleString("ko-KR", { maximumFractionDigits: 1 })} MB`;
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
  const firstSheet =
    entries.get("xl/worksheets/sheet1.xml") ??
    Array.from(entries.entries()).find(([name]) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name))?.[1];
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

function typeDefinitionForLabel(types: DomainTypeDefinition[], label?: string): DomainTypeDefinition | undefined {
  const displayLabel = displayTypeLabel(label);
  return types.find((type) => displayTypeLabel(type.label) === displayLabel);
}

function uniqueTypeLabelsFrom(types: DomainTypeDefinition[], labels: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const label of [...types.map((type) => type.label), ...labels]) {
    const displayLabel = displayTypeLabel(label);
    if (seen.has(displayLabel)) {
      continue;
    }

    seen.add(displayLabel);
    result.push(displayLabel);
  }

  return result;
}

function TypeBadge({ color, label }: { color?: string; label: string }) {
  const hex = domainTypeColorHex(color);

  return (
    <span
      className="inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-bold"
      style={{
        backgroundColor: colorWithAlpha(hex, 0.12),
        borderColor: colorWithAlpha(hex, 0.42),
        color: readableTypeTextColor(hex)
      }}
    >
      {label}
    </span>
  );
}

function colorWithAlpha(hex: string, alpha: number): string {
  const rgb = hexToRgb(hex);
  return rgb ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})` : hex;
}

function readableTypeTextColor(hex: string): string {
  const rgb = hexToRgb(hex);
  if (!rgb) {
    return "#334155";
  }

  const luminance = (0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b) / 255;
  return luminance > 0.72 ? "#334155" : hex;
}

function hexToRgb(hex: string): { b: number; g: number; r: number } | undefined {
  const normalized = normalizeHexColor(hex);
  if (!normalized) {
    return undefined;
  }

  const value = normalized.slice(1);
  return {
    r: Number.parseInt(value.slice(0, 2), 16),
    g: Number.parseInt(value.slice(2, 4), 16),
    b: Number.parseInt(value.slice(4, 6), 16)
  };
}

export function ManagedObjectsScreen() {
  const { commands, state } = usePrototype();
  const hasFiles = state.sourceFiles.length > 0;
  const canPrepareAnalysis = canCurrentUser(state, "source:upload") && canCurrentUser(state, "analysis:start");
  const canManageTypes = canCurrentUser(state, "company:type:manage");
  const focusedObjectId = state.navigationFocus?.screen === "objects" ? state.navigationFocus.focusId : undefined;
  const [activeObjectId, setActiveObjectId] = useState(focusedObjectId ?? "");
  const [selectedGraphItemId, setSelectedGraphItemId] = useState<string | undefined>(undefined);
  const [typeFilter, setTypeFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showTypeManager, setShowTypeManager] = useState(false);

  const typeOptions = useMemo(() => {
    return uniqueTypeLabelsFrom(state.managedObjectTypes, state.entities.map((entity) => entity.kind));
  }, [state.entities, state.managedObjectTypes]);
  const filteredObjects = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();
    return state.entities.filter((entity) => {
      const typeLabel = displayTypeLabel(entity.kind);
      const matchesType = typeFilter === "all" || typeLabel === typeFilter;
      const matchesSearch = !normalizedSearch || entity.name.toLowerCase().includes(normalizedSearch);
      return matchesType && matchesSearch;
    });
  }, [searchQuery, state.entities, typeFilter]);
  const selectedObject =
    state.entities.find((entity) => entity.id === activeObjectId) ??
    state.entities.find((entity) => entity.id === focusedObjectId) ??
    filteredObjects[0] ??
    state.entities[0];
  const visibleObjectIds = useMemo(() => filteredObjects.map((entity) => entity.id), [filteredObjects]);
  const view = getManagedObjectView(state, selectedObject?.id ?? activeObjectId ?? focusedObjectId, {
    visibleEntityIds: visibleObjectIds
  });

  useEffect(() => {
    if (focusedObjectId) {
      setActiveObjectId(focusedObjectId);
    }
  }, [focusedObjectId]);

  useEffect(() => {
    if (state.entities.length === 0) {
      setActiveObjectId("");
      return;
    }

    if (!selectedObject) {
      setActiveObjectId(filteredObjects[0]?.id ?? state.entities[0]?.id ?? "");
      return;
    }

    if (filteredObjects.length > 0 && !filteredObjects.some((entity) => entity.id === selectedObject.id)) {
      setActiveObjectId(filteredObjects[0].id);
    }
  }, [filteredObjects, selectedObject, state.entities]);

  useEffect(() => {
    setSelectedGraphItemId(view.detail.defaultGraphItemId);
  }, [selectedObject?.id, view.detail.defaultGraphItemId]);

  if (state.entities.length === 0) {
    return (
      <div className="space-y-8">
        <SectionTitle eyebrow="관리 대상" title="아직 정의된 관리 대상이 없습니다" />
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
      <SectionTitle eyebrow="관리 대상" title="관리 대상 목록과 유형" />
      <div className="grid items-start gap-5 xl:grid-cols-[380px_minmax(0,1fr)]">
        <div className="space-y-5">
          <Card className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-950">관리 대상 목록</h2>
                <p className="mt-1 text-xs font-semibold text-slate-500">{filteredObjects.length}/{state.entities.length}개</p>
              </div>
              <Button
                aria-label="관리대상 유형 관리 열기"
                className="h-9 gap-2 px-3"
                variant="secondary"
                onClick={() => setShowTypeManager(true)}
              >
                <SettingsIcon />
                <span>유형</span>
              </Button>
            </div>
            <div className="grid gap-3">
              <div className="flex flex-wrap gap-2" role="list" aria-label="관리대상 유형 필터">
                <button
                  className={`rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
                    typeFilter === "all" ? "ring-2 ring-primary ring-offset-2" : ""
                  }`}
                  onClick={() => setTypeFilter("all")}
                >
                  <Badge tone="neutral">전체</Badge>
                </button>
                {typeOptions.map((type) => {
                  const definition = typeDefinitionForLabel(state.managedObjectTypes, type);
                  return (
                    <button
                      key={type}
                      className={`rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
                        typeFilter === type ? "ring-2 ring-primary ring-offset-2" : ""
                      }`}
                      onClick={() => setTypeFilter(type)}
                    >
                      <TypeBadge color={definition?.color} label={type} />
                    </button>
                  );
                })}
              </div>
              <input
                aria-label="관리 대상명 검색"
                className="w-full rounded-md border border-hairline bg-white px-3 py-2 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                placeholder="예: 고객A, 공급업체 A사"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
            </div>
            {showTypeManager && (
              <Popup eyebrow="유형 관리" size="md" title="관리 대상 유형" tone="info" onClose={() => setShowTypeManager(false)}>
                <DomainTypeManager
                  canManage={canManageTypes}
                  description="관리 대상 유형은 인스턴스를 나누는 필터 기준입니다. 삭제된 유형은 연결 데이터를 유지한 채 미지정으로 표시됩니다."
                  onAdd={(label, color) => commands.addDomainType("managed_object", label, color)}
                  onDelete={(typeId) => commands.deleteDomainType("managed_object", typeId)}
                  onUpdate={(typeId, label, color) => commands.updateDomainType("managed_object", typeId, label, color)}
                  types={state.managedObjectTypes}
                />
              </Popup>
            )}
            <div className="space-y-3">
              {filteredObjects.map((entity) => {
                const active = selectedObject?.id === entity.id;
                return (
                  <button
                    key={entity.id}
                    className={`w-full rounded-md border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
                      active ? "border-blue-500 bg-blue-50" : "border-slate-200 bg-white hover:bg-slate-50"
                    }`}
                    onClick={() => setActiveObjectId(entity.id)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <TypeBadge color={typeDefinitionForLabel(state.managedObjectTypes, entity.kind)?.color} label={displayTypeLabel(entity.kind)} />
                        <h2 className="mt-2 truncate text-lg font-bold text-slate-950">{entity.name}</h2>
                        <p className="mt-1 text-xs font-semibold text-slate-500">개별 대상</p>
                      </div>
                      <Badge tone={entity.status.includes("주의") || entity.status.includes("필요") ? "warning" : "success"}>{entity.status}</Badge>
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">{entity.summary}</p>
                    <p className="mt-2 text-xs font-semibold text-slate-500">담당: {entity.owner}</p>
                  </button>
                );
              })}
              {filteredObjects.length === 0 && (
                <div className="rounded-md border border-dashed border-hairline bg-white p-4 text-sm text-slate-600">
                  조건에 맞는 관리 대상이 없습니다.
                </div>
              )}
            </div>
          </Card>
        </div>
        <Card className="min-w-0 space-y-5">
          {selectedObject && view.detail.category ? (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <TypeBadge color={typeDefinitionForLabel(state.managedObjectTypes, selectedObject.kind)?.color} label={displayTypeLabel(selectedObject.kind)} />
                  <h2 className="mt-3 text-2xl font-bold text-slate-950">{selectedObject.name}</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{selectedObject.summary}</p>
                  <p className="mt-2 text-xs font-semibold text-slate-500">담당: {selectedObject.owner}</p>
                </div>
                <Badge tone={selectedObject.status.includes("주의") || selectedObject.status.includes("필요") ? "warning" : "success"}>{selectedObject.status}</Badge>
              </div>
              <div className="grid gap-3 md:grid-cols-4">
                <DetailStat label="유형" value={displayTypeLabel(selectedObject.kind)} />
                <DetailStat label="업무 흐름" value={`${view.detail.events.length}단계`} />
                <DetailStat label="연결" value={`${view.detail.graphEdges.length}개`} />
                <DetailStat label="지표" value={`${view.detail.metrics.length}개`} />
              </div>
              <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="font-bold text-slate-950">연결 그래프</h3>
                  <Badge tone="neutral">선택 대상 연결 구조</Badge>
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
              <div className="grid gap-4 xl:grid-cols-2">
                <LinkedList
                  title="연결 지표"
                  items={view.detail.metrics.map(({ definition, value }) => `${definition.name}: ${value?.value ?? "-"}${definition.unit}`)}
                />
                <LinkedList
                  title="업무 흐름"
                  items={view.detail.events.map((event) => `${event.name} · ${displayTypeLabel(event.workflowType)} · ${event.durationHours}시간`)}
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
            <p className="text-sm text-slate-600">조회할 관리 대상을 선택하세요.</p>
          )}
        </Card>
      </div>
    </div>
  );
}

function DomainTypeManager({
  canManage,
  description,
  onAdd,
  onDelete,
  onUpdate,
  types
}: {
  canManage: boolean;
  description: string;
  onAdd: (label: string, color?: string) => boolean;
  onDelete: (typeId: string) => boolean;
  onUpdate: (typeId: string, label: string, color?: string) => boolean;
  types: DomainTypeDefinition[];
}) {
  const [draftLabel, setDraftLabel] = useState("");
  const [draftColor, setDraftColor] = useState<DomainTypeColor>("blue");
  const [editingId, setEditingId] = useState<string | undefined>();
  const [editingLabel, setEditingLabel] = useState("");
  const [editingColor, setEditingColor] = useState<DomainTypeColor>("blue");

  function submitAdd() {
    if (onAdd(draftLabel, draftColor)) {
      setDraftLabel("");
    }
  }

  function startEdit(typeDefinition: DomainTypeDefinition) {
    setEditingId(typeDefinition.id);
    setEditingLabel(typeDefinition.label);
    setEditingColor(normalizeTypeColor(typeDefinition.color));
  }

  function submitEdit(typeId: string) {
    if (onUpdate(typeId, editingLabel, editingColor)) {
      setEditingId(undefined);
      setEditingLabel("");
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm leading-6 text-slate-600">{description}</p>
      {canManage && (
        <div className="grid gap-2 rounded-md border border-slate-200 bg-white p-2 md:grid-cols-[minmax(0,1fr)_148px_auto]">
          <input
            className="h-9 min-w-0 rounded-md border border-hairline bg-white px-3 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            placeholder="새 유형 이름"
            value={draftLabel}
            onChange={(event) => setDraftLabel(event.target.value)}
          />
          <TypeColorPicker value={draftColor} onChange={setDraftColor} />
          <IconButton disabled={!draftLabel.trim()} label="유형 추가" variant="primary" onClick={submitAdd}>
            <PlusIcon />
          </IconButton>
        </div>
      )}
      <div className="space-y-2">
        {types.map((type) => (
          <div key={type.id} className="rounded-md border border-slate-200 bg-white p-2">
            {editingId === type.id ? (
              <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_148px_auto]">
                <input
                  className="h-9 min-w-0 flex-1 rounded-md border border-hairline bg-white px-3 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                  value={editingLabel}
                  onChange={(event) => setEditingLabel(event.target.value)}
                />
                <TypeColorPicker value={editingColor} onChange={setEditingColor} />
                <div className="flex flex-wrap gap-2">
                  <IconButton disabled={!editingLabel.trim()} label="유형 저장" variant="primary" onClick={() => submitEdit(type.id)}>
                    <CheckIcon />
                  </IconButton>
                  <IconButton label="수정 취소" variant="secondary" onClick={() => setEditingId(undefined)}>
                    <CloseIcon />
                  </IconButton>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-2">
                <TypeBadge color={type.color} label={type.label} />
                {canManage && (
                  <div className="flex shrink-0 gap-2">
                    <IconButton label={`${type.label} 수정`} variant="secondary" onClick={() => startEdit(type)}>
                      <PencilIcon />
                    </IconButton>
                    <IconButton label={`${type.label} 삭제`} variant="danger" onClick={() => onDelete(type.id)}>
                      <TrashIcon />
                    </IconButton>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
        {types.length === 0 && (
          <div className="rounded-md border border-dashed border-hairline bg-white p-3 text-sm text-slate-600">
            등록된 유형이 없습니다. 관리자가 유형을 추가하면 필터와 표기에 반영됩니다.
          </div>
        )}
      </div>
      {!canManage && <p className="text-xs font-semibold text-slate-500">기업 소유자만 유형을 추가/수정/삭제할 수 있습니다.</p>}
    </div>
  );
}

function TypeColorPicker({
  disabled = false,
  onChange,
  value
}: {
  disabled?: boolean;
  onChange: (color: DomainTypeColor) => void;
  value: DomainTypeColor;
}) {
  const [hexDraft, setHexDraft] = useState(domainTypeColorHex(value));
  const normalizedHexDraft = normalizeHexColor(hexDraft);
  const previewColor = normalizedHexDraft ?? domainTypeColorHex(value);

  useEffect(() => {
    setHexDraft(domainTypeColorHex(value));
  }, [value]);

  return (
    <div className="flex items-center gap-2">
      <label
        className={`relative grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2 ${
          disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"
        }`}
        title="색상 팔레트 열기"
      >
        <span aria-hidden="true" className="h-6 w-6 rounded-full border border-black/10" style={{ backgroundColor: previewColor }} />
        <input
          aria-label="색상 팔레트 열기"
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
          disabled={disabled}
          type="color"
          value={previewColor}
          onChange={(event) => {
            const normalized = normalizeHexColor(event.target.value);
            if (normalized) {
              setHexDraft(normalized);
              onChange(normalized);
            }
          }}
        />
      </label>
      <input
        aria-label="HEX 색상 입력"
        aria-invalid={Boolean(hexDraft.trim()) && !normalizedHexDraft}
        className={`h-9 min-w-0 flex-1 rounded-md border bg-white px-2 font-mono text-xs text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:bg-slate-100 ${
          Boolean(hexDraft.trim()) && !normalizedHexDraft ? "border-rose-400" : "border-hairline"
        }`}
        disabled={disabled}
        inputMode="text"
        placeholder="#2563eb"
        value={hexDraft}
        onBlur={() => {
          if (!normalizeHexColor(hexDraft)) {
            setHexDraft(domainTypeColorHex(value));
          }
        }}
        onChange={(event) => {
          const nextValue = event.target.value;
          setHexDraft(nextValue);
          const normalized = normalizeHexColor(nextValue);
          if (normalized) {
            onChange(normalized);
          }
        }}
      />
    </div>
  );
}

function IconButton({
  children,
  disabled = false,
  label,
  onClick,
  variant = "secondary"
}: {
  children: ReactNode;
  disabled?: boolean;
  label: string;
  onClick: () => void;
  variant?: "primary" | "secondary" | "danger" | "ghost";
}) {
  return (
    <Button
      aria-label={label}
      className="h-9 w-9 px-0"
      disabled={disabled}
      title={label}
      type="button"
      variant={variant}
      onClick={onClick}
    >
      <span aria-hidden="true">{children}</span>
    </Button>
  );
}

function SettingsIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4 text-slate-950" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
      <path strokeLinecap="round" d="M4 7h4M14 7h6M4 17h9M18 17h2" />
      <circle cx="11" cy="7" r="3" fill="currentColor" stroke="none" />
      <circle cx="16" cy="17" r="3" fill="currentColor" stroke="none" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="m16.9 4.9 2.2 2.2M4 20h4.2L19.6 8.6a1.6 1.6 0 0 0 0-2.2l-2-2a1.6 1.6 0 0 0-2.2 0L4 15.8V20Z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 7h14M10 11v6M14 11v6M8 7l1-3h6l1 3M7 7l1 13h8l1-13" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="m5 13 4 4L19 7" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6 6 18" />
    </svg>
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
  const canPrepareAnalysis = canCurrentUser(state, "source:upload") && canCurrentUser(state, "analysis:start");
  const canManageTypes = canCurrentUser(state, "company:type:manage");
  const focusedEventId = state.navigationFocus?.screen === "workflow" ? state.navigationFocus.focusId : undefined;
  const [typeFilter, setTypeFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showTypeManager, setShowTypeManager] = useState(false);
  const typeOptions = useMemo(() => uniqueTypeLabelsFrom(state.workflowTypes, state.events.map((event) => event.workflowType)), [state.events, state.workflowTypes]);
  const filteredEvents = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();
    return state.events.filter((event) => {
      const typeLabel = displayTypeLabel(event.workflowType);
      const matchesType = typeFilter === "all" || typeLabel === typeFilter;
      const matchesSearch = !normalizedSearch || event.name.toLowerCase().includes(normalizedSearch);
      return matchesType && matchesSearch;
    });
  }, [searchQuery, state.events, typeFilter]);

  if (state.events.length === 0) {
    return (
      <div className="space-y-8">
        <SectionTitle eyebrow="업무 흐름" title="아직 정의된 업무 이벤트가 없습니다" />
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
      <SectionTitle eyebrow="업무 흐름" title="업무흐름 이벤트와 유형" />
      <div className="grid items-start gap-5">
        <Card className="space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-950">업무흐름 목록</h2>
              <p className="text-xs font-semibold text-slate-500">({filteredEvents.length}/{state.events.length}개)</p>
            </div>
            <Button
              aria-label="업무흐름 유형 관리 열기"
              className="h-9 gap-2 px-3"
              variant="secondary"
              onClick={() => setShowTypeManager(true)}
            >
              <SettingsIcon />
              <span>유형</span>
            </Button>
          </div>
          <div className="grid gap-3">
            <div className="flex flex-wrap gap-2" role="list" aria-label="업무흐름 유형 필터">
              <button
                className={`rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
                  typeFilter === "all" ? "ring-2 ring-primary ring-offset-2" : ""
                }`}
                onClick={() => setTypeFilter("all")}
              >
                <Badge tone="neutral">전체</Badge>
              </button>
              {typeOptions.map((type) => {
                const definition = typeDefinitionForLabel(state.workflowTypes, type);
                return (
                  <button
                    key={type}
                    className={`rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
                      typeFilter === type ? "ring-2 ring-primary ring-offset-2" : ""
                    }`}
                    onClick={() => setTypeFilter(type)}
                  >
                    <TypeBadge color={definition?.color} label={type} />
                  </button>
                );
              })}
            </div>
            <input
              aria-label="업무흐름 이벤트명 검색"
              className="w-full rounded-md border border-hairline bg-white px-3 py-2 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              placeholder="예: 주문 접수, 클레임 접수"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
          </div>
          {showTypeManager && (
            <Popup eyebrow="유형 관리" size="md" title="업무흐름 유형" tone="info" onClose={() => setShowTypeManager(false)}>
              <DomainTypeManager
                canManage={canManageTypes}
                description="업무흐름 유형은 이벤트를 묶는 관리용 범주 정보입니다. 삭제된 유형은 이벤트를 유지한 채 미지정으로 표시됩니다."
                onAdd={(label, color) => commands.addDomainType("workflow", label, color)}
                onDelete={(typeId) => commands.deleteDomainType("workflow", typeId)}
                onUpdate={(typeId, label, color) => commands.updateDomainType("workflow", typeId, label, color)}
                types={state.workflowTypes}
              />
            </Popup>
          )}
          {filteredEvents.map((event) => {
            const entity = state.entities.find((item) => item.id === event.objectId);
            const bindings = state.workflowMetricBindings.filter((binding) => binding.eventId === event.id);
            const connectedObjectIds = new Set([event.objectId, ...bindings.flatMap((binding) => binding.sourceManagedObjectIds)]);
            const connectedEntities = state.entities.filter((item) => connectedObjectIds.has(item.id));
            const connectedMetrics = state.metricDefinitions.filter((metric) => bindings.some((binding) => binding.metricId === metric.id));
            const connectedRelations = state.relations.filter((relation) => connectedObjectIds.has(relation.fromId) || connectedObjectIds.has(relation.toId));

            return (
              <div
                key={event.id}
                className={`grid items-start gap-3 rounded-md border p-4 md:grid-cols-[1fr_190px] ${
                  focusedEventId === event.id ? "border-blue-500 bg-blue-50" : "border-slate-200 bg-white"
                }`}
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <TypeBadge color={typeDefinitionForLabel(state.workflowTypes, event.workflowType)?.color} label={displayTypeLabel(event.workflowType)} />
                    <p className="font-bold text-slate-950">{event.name}</p>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">대표 관리 대상: {entity ? `${displayTypeLabel(entity.kind)} · ${entity.name}` : "확인 필요"}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    연결 관리 대상: {connectedEntities.map((item) => `${displayTypeLabel(item.kind)} ${item.name}`).join(", ") || "없음"}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    관계 연결: {connectedRelations.map((relation) => relation.type).join(", ") || "없음"}
                  </p>
                </div>
                <div className="space-y-1 text-sm text-slate-600">
                  <p>소요 {event.durationHours}시간</p>
                  <p>지표 {connectedMetrics.map((metric) => metric.name).join(", ") || "없음"}</p>
                </div>
              </div>
            );
          })}
          {filteredEvents.length === 0 && (
            <div className="rounded-md border border-dashed border-hairline bg-white p-4 text-sm text-slate-600">
              선택한 유형과 검색어에 맞는 업무흐름이 없습니다.
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

export function MetricsScreen() {
  const { commands, state } = usePrototype();
  const hasFiles = state.sourceFiles.length > 0;
  const canPrepareAnalysis = canCurrentUser(state, "source:upload") && canCurrentUser(state, "analysis:start");
  const canOpenInsightDetail = canCurrentUser(state, "insight:proposal");
  const focusedMetricId = state.navigationFocus?.screen === "metrics" ? state.navigationFocus.focusId : undefined;

  if (state.metricDefinitions.length === 0) {
    return (
      <div className="space-y-8">
        <SectionTitle eyebrow="지표" title="아직 계산할 지표가 없습니다" />
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
      <SectionTitle eyebrow="지표" title="계산 기준과 관련 안건" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
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

  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-bold text-slate-500">그래프</p>
        <Badge tone="info">{chartTypeLabel(value.chartType)}</Badge>
      </div>
      <MetricChart chartType={value.chartType} id={value.id} points={points} status={value.status} unit={unit} />
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
  const uniqueItems = Array.from(new Set(items));

  return (
    <div className="rounded-md border border-slate-200 bg-white p-3">
      <p className="text-xs font-bold text-slate-500">{title}</p>
      <ul className="mt-2 space-y-1 text-sm leading-6 text-slate-600">
        {uniqueItems.length > 0 ? uniqueItems.map((item) => <li key={item}>{item}</li>) : <li>연결 항목 없음</li>}
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
