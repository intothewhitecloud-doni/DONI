import type { SourceFile } from "../domain/types";

export const BINARY_SOURCE_FILE_LIMIT_BYTES = 2 * 1024 * 1024;
export const SUPPORTED_SOURCE_FILE_ACCEPT = ".csv,.doc,.docx,.pdf,.tsv,.xls,.xlsx,.png,.jpg,.jpeg,.webp,.gif";

const imageExtensions = new Set(["gif", "jpeg", "jpg", "png", "webp"]);
const parsedTableExtensions = new Set(["csv", "tsv", "xlsx"]);
const tabularKindExtensions = new Set(["csv", "tsv", "xls", "xlsx"]);
const documentExtensions = new Set(["doc", "docx", "pdf"]);

type SourceFileLike = Pick<SourceFile, "name"> &
  Partial<Pick<SourceFile, "mimeType" | "previewColumns" | "previewRows">>;

type UploadFileLike = {
  name: string;
  size: number;
  type?: string;
};

export type SourceFileRenderType = "file" | "image" | "pdf" | "table";

export function sourceFileExtension(name: string): string {
  const trimmed = name.trim();
  const lastDotIndex = trimmed.lastIndexOf(".");
  if (lastDotIndex <= 0 || lastDotIndex === trimmed.length - 1) {
    return "";
  }

  return trimmed.slice(lastDotIndex + 1).toLowerCase();
}

export function hasParsedTablePreview(file: Partial<Pick<SourceFile, "previewColumns" | "previewRows">>): boolean {
  return Boolean(file.previewColumns?.length && file.previewRows?.length);
}

function isSupportedImageSource(file: SourceFileLike): boolean {
  return Boolean(file.mimeType?.toLowerCase().startsWith("image/")) || imageExtensions.has(sourceFileExtension(file.name));
}

function isPdfSource(file: SourceFileLike): boolean {
  return file.mimeType?.toLowerCase() === "application/pdf" || sourceFileExtension(file.name) === "pdf";
}

export function deriveSourceFileRenderType(file: SourceFileLike): SourceFileRenderType {
  if (hasParsedTablePreview(file)) {
    return "table";
  }

  if (isPdfSource(file)) {
    return "pdf";
  }

  if (isSupportedImageSource(file)) {
    return "image";
  }

  return "file";
}

export function sourceFileKindForName(name: string): string {
  const extension = sourceFileExtension(name);

  if (tabularKindExtensions.has(extension)) {
    return "표 형식 데이터";
  }

  if (documentExtensions.has(extension)) {
    return "업무 문서";
  }

  return "업무 파일";
}

export function isBinaryLimitedUpload(file: Pick<UploadFileLike, "name" | "type">): boolean {
  const extension = sourceFileExtension(file.name);
  if (parsedTableExtensions.has(extension)) {
    return false;
  }

  return imageExtensions.has(extension) || documentExtensions.has(extension) || extension === "xls" || Boolean(file.type && !file.type.startsWith("text/"));
}

export function findOversizedBinarySourceFile(files: UploadFileLike[]): UploadFileLike | undefined {
  return files.find((file) => isBinaryLimitedUpload(file) && file.size > BINARY_SOURCE_FILE_LIMIT_BYTES);
}

export function validateSourceFileRename(currentName: string, nextName: string): { name: string; valid: true } | { message: string; valid: false } {
  const name = nextName.trim();
  if (!name) {
    return { valid: false, message: "파일명을 입력해 주세요." };
  }

  if (sourceFileExtension(currentName) !== sourceFileExtension(name)) {
    return { valid: false, message: "파일 확장자는 변경할 수 없습니다." };
  }

  return { name, valid: true };
}
