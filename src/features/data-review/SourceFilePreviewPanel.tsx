import type { EvidenceReference, SourceFile } from "../../lib/domain/types";
import {
  deriveSourceFileRenderType,
  hasParsedTablePreview,
  sourceFileExtension,
  type SourceFileRenderType
} from "../../lib/prototype/sourceFiles";

export function SourceFilePreviewPanel({ file, renderType }: { file: SourceFile; renderType: SourceFileRenderType }) {
  const previewRenderType = sourceFilePreviewRenderType(file, renderType);

  if (previewRenderType === "table") {
    return (
      <div className="overflow-x-auto rounded-md border border-slate-200">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs font-bold text-slate-500">
            <tr>
              {filePreviewColumns(file).map((column) => (
                <th key={column} className="whitespace-nowrap px-3 py-2">{column}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filePreviewRows(file).map((row) => (
              <tr key={row.join("-")}>
                {row.map((cell, index) => (
                  <td key={`${index}-${cell}`} className="whitespace-nowrap px-3 py-2 text-slate-700">{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (renderType === "image" && file.dataUrl) {
    return (
      <div className="space-y-3 rounded-md border border-slate-200 bg-slate-50 p-3">
        <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
          <img className="max-h-[420px] w-full object-contain" src={file.dataUrl} alt={file.name} />
        </div>
        <SourceFileMetadata file={file} />
      </div>
    );
  }

  if (renderType === "pdf" && file.dataUrl) {
    return (
      <div className="space-y-3 rounded-md border border-slate-200 bg-slate-50 p-3">
        <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
          <iframe
            className="h-[520px] w-full border-0"
            src={file.dataUrl}
            title={`${file.name} 미리보기`}
          />
        </div>
        <SourceFileMetadata file={file} />
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-md border border-slate-200 bg-slate-50 p-4">
      <div>
        <p className="font-bold text-slate-950">미리보기를 제공하지 않는 파일입니다</p>
      </div>
      <SourceFileMetadata file={file} />
    </div>
  );
}

export function SourceFileMetadata({ file }: { file: SourceFile }) {
  return (
    <dl className="grid gap-3 text-sm md:grid-cols-3">
      <div className="rounded-md border border-slate-200 bg-white p-3">
        <dt className="text-xs font-bold text-slate-500">파일 크기</dt>
        <dd className="mt-1 font-semibold text-slate-900">{formatFileSize(file.size)}</dd>
      </div>
      <div className="rounded-md border border-slate-200 bg-white p-3">
        <dt className="text-xs font-bold text-slate-500">파일 형식</dt>
        <dd className="mt-1 font-semibold text-slate-900">{formatFileType(file)}</dd>
      </div>
      <div className="rounded-md border border-slate-200 bg-white p-3">
        <dt className="text-xs font-bold text-slate-500">렌더 유형</dt>
        <dd className="mt-1 font-semibold text-slate-900">{sourceFileRenderTypeLabel(sourceFilePreviewRenderType(file))}</dd>
      </div>
    </dl>
  );
}

export function sourceFileListSummary(file: SourceFile): string {
  if (sourceFilePreviewRenderType(file) === "table") {
    const rowCountLabel = typeof file.rowCount === "number" && file.rowCount > 0
      ? `${file.rowCount.toLocaleString("ko-KR")}행`
      : "표 미리보기";
    return `${file.kind} · ${rowCountLabel}`;
  }

  return `${file.kind} · ${formatFileSize(file.size)} · ${formatFileType(file)}`;
}

export function sourceFileRenderTypeLabel(renderType: SourceFileRenderType): string {
  if (renderType === "table") {
    return "표 미리보기";
  }

  if (renderType === "image") {
    return "이미지";
  }

  if (renderType === "pdf") {
    return "PDF";
  }

  return "파일";
}

export function formatFileSize(size?: number): string {
  if (typeof size !== "number") {
    return "크기 확인 전";
  }

  if (size < 1024) {
    return `${size.toLocaleString("ko-KR")} bytes`;
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toLocaleString("ko-KR", { maximumFractionDigits: 1 })} KB`;
  }

  return `${(size / 1024 / 1024).toLocaleString("ko-KR", { maximumFractionDigits: 1 })} MB`;
}

export function formatFileType(file: SourceFile): string {
  return file.mimeType || sourceFileExtension(file.name).toUpperCase() || "형식 확인 전";
}

export function downloadSourceFile(file: SourceFile): void {
  if (file.dataUrl) {
    const anchor = document.createElement("a");
    anchor.href = file.dataUrl;
    anchor.download = file.name;
    anchor.click();
    return;
  }

  const blob = hasParsedTablePreview(file)
    ? new Blob(
        [
          `\uFEFF${[filePreviewColumns(file), ...filePreviewRows(file)]
            .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(","))
            .join("\n")}`
        ],
        { type: "text/csv;charset=utf-8" }
      )
    : new Blob([`${file.name}\n${formatFileType(file)}\n${formatFileSize(file.size)}\n`], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = file.name;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function formatEvidenceSource(evidence: EvidenceReference): string {
  const parts = [
    evidence.sourceName ?? evidence.location,
    evidence.sheetName ? `${evidence.sheetName} 시트` : undefined,
    evidence.rowNumbers && evidence.rowNumbers.length > 0 ? `${evidence.rowNumbers.join(", ")}행` : undefined,
    evidence.columns && evidence.columns.length > 0 ? evidence.columns.join(", ") : undefined,
    typeof evidence.confidence === "number" ? `신뢰도 ${Math.round(evidence.confidence * 100)}%` : undefined
  ].filter(Boolean);

  return parts.join(" · ");
}

function filePreviewColumns(file: SourceFile): string[] {
  if (hasParsedTablePreview(file)) {
    return file.previewColumns ?? [];
  }

  if (hasSpreadsheetFallbackPreview(file)) {
    return ["시트", "항목", "원천값", "상태"];
  }

  return [];
}

function filePreviewRows(file: SourceFile): string[][] {
  if (hasParsedTablePreview(file)) {
    return file.previewRows ?? [];
  }

  if (hasSpreadsheetFallbackPreview(file)) {
    return [
      ["Sheet1", "파일명", file.name, "보관됨"],
      ["Sheet1", "파일 형식", spreadsheetTypeLabel(file), "표 형식 데이터"],
      ["Sheet1", "파일 크기", formatFileSize(file.size), "보관됨"],
      ["Sheet1", "미리보기", "파일 구조 확인 중", "분석 흐름"]
    ];
  }

  return [];
}

function sourceFilePreviewRenderType(file: SourceFile, renderType = deriveSourceFileRenderType(file)): SourceFileRenderType {
  if (renderType === "file" && hasSpreadsheetFallbackPreview(file)) {
    return "table";
  }

  return renderType;
}

function hasSpreadsheetFallbackPreview(file: SourceFile): boolean {
  return !hasParsedTablePreview(file) && ["xls", "xlsx"].includes(sourceFileExtension(file.name));
}

function spreadsheetTypeLabel(file: SourceFile): string {
  return sourceFileExtension(file.name).toUpperCase() || formatFileType(file);
}
