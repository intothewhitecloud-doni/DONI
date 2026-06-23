import assert from "node:assert/strict";
import test from "node:test";
import { sampleEvidence, sampleSourceFiles } from "./sample-analysis";

test("P-08 comparison evidence matches the canonical order row", () => {
  const orders = sampleSourceFiles.find((file) => file.id === "source-orders");
  const evidence = sampleEvidence.find((item) => item.id === "evidence-customer-b-p08");

  assert.ok(orders);
  assert.ok(evidence);
  assert.ok(evidence.rowNumbers);

  const rowNumber = evidence.rowNumbers[0];
  const row = orders.previewRows?.[rowNumber - 2];
  assert.ok(row);

  const rowByColumn = new Map(orders.previewColumns?.map((column, index) => [column, row[index]]) ?? []);
  assert.equal(rowByColumn.get("고객군"), "신규 고객군");
  assert.equal(rowByColumn.get("상품군"), "P-08");
  assert.equal(rowByColumn.get("공급사"), "공급업체 A사");
  assert.equal(rowByColumn.get("주문상태"), "정상 출고");
  assert.equal(rowByColumn.get("클레임유형"), "");
  assert.match(evidence.excerpt, /신규 고객군/);
  assert.doesNotMatch(evidence.excerpt, /고객B/);
});
