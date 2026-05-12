import assert from "node:assert/strict";
import test from "node:test";
import {
  BINARY_SOURCE_FILE_LIMIT_BYTES,
  deriveSourceFileRenderType,
  findOversizedBinarySourceFile,
  sourceFileKindForName,
  validateSourceFileRename
} from "./sourceFiles";

test("source file render type is derived from real preview data first", () => {
  assert.equal(
    deriveSourceFileRenderType({
      name: "orders.csv",
      previewColumns: ["주문번호"],
      previewRows: [["O-1"]]
    }),
    "table"
  );
  assert.equal(deriveSourceFileRenderType({ name: "empty.csv", previewColumns: [], previewRows: [] }), "file");
  assert.equal(deriveSourceFileRenderType({ name: "columns-only.csv", previewColumns: ["주문번호"], previewRows: [] }), "file");
  assert.equal(deriveSourceFileRenderType({ name: "rows-only.csv", previewColumns: [], previewRows: [["O-1"]] }), "file");
});

test("supported image files derive image rendering from mime type or extension", () => {
  assert.equal(deriveSourceFileRenderType({ name: "diagram.bin", mimeType: "image/png" }), "image");
  assert.equal(deriveSourceFileRenderType({ name: "photo.JPG", mimeType: "" }), "image");
  assert.equal(deriveSourceFileRenderType({ name: "flow.webp" }), "image");
  assert.equal(deriveSourceFileRenderType({ name: "legacy.xls" }), "file");
});

test("supported PDF files derive PDF rendering from mime type or extension", () => {
  assert.equal(deriveSourceFileRenderType({ name: "manual.bin", mimeType: "application/pdf" }), "pdf");
  assert.equal(deriveSourceFileRenderType({ name: "sample.PDF", mimeType: "" }), "pdf");
});

test("source file business kind is display metadata and follows extension families", () => {
  assert.equal(sourceFileKindForName("orders.csv"), "표 형식 데이터");
  assert.equal(sourceFileKindForName("legacy.xls"), "표 형식 데이터");
  assert.equal(sourceFileKindForName("manual.pdf"), "업무 문서");
  assert.equal(sourceFileKindForName("photo.png"), "업무 파일");
});

test("binary source file limit applies before file reads", () => {
  const oversized = findOversizedBinarySourceFile([
    { name: "orders.csv", size: BINARY_SOURCE_FILE_LIMIT_BYTES + 100, type: "text/csv" },
    { name: "manual.pdf", size: BINARY_SOURCE_FILE_LIMIT_BYTES + 1, type: "application/pdf" }
  ]);

  assert.equal(oversized?.name, "manual.pdf");
  assert.equal(findOversizedBinarySourceFile([{ name: "photo.png", size: BINARY_SOURCE_FILE_LIMIT_BYTES, type: "image/png" }]), undefined);
});

test("source file rename keeps the original extension", () => {
  assert.deepEqual(validateSourceFileRename("sample.png", "hero.png"), { name: "hero.png", valid: true });
  assert.deepEqual(validateSourceFileRename("sample.png", "sample.pdf"), { message: "파일 확장자는 변경할 수 없습니다.", valid: false });
  assert.deepEqual(validateSourceFileRename("sample.png", "   "), { message: "파일명을 입력해 주세요.", valid: false });
});
