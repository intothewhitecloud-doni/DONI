import assert from "node:assert/strict";
import test from "node:test";
import {
  canCompleteDeferredDataVaultApply,
  completeDeferredDataVaultApply,
  dataVaultApplyStatusForFile,
  markDeferredDataVaultApplyAnalyzing,
  startDeferredDataVaultApply,
  type DataVaultLocalApplyStatusMap
} from "./dataVaultApplyStatus";

test("deferred data vault apply calls global apply only at final completion", () => {
  const fileId = "file-1";
  let applyCalls = 0;
  let statuses: DataVaultLocalApplyStatusMap = {};

  statuses = startDeferredDataVaultApply(statuses, fileId);
  assert.equal(statuses[fileId], "pending");

  statuses = markDeferredDataVaultApplyAnalyzing(statuses, fileId);
  assert.equal(statuses[fileId], "analyzing");
  assert.equal(applyCalls, 0);
  assert.equal(canCompleteDeferredDataVaultApply(statuses, fileId), true);

  const applied = ((appliedFileId: string) => {
    applyCalls += 1;
    assert.equal(appliedFileId, fileId);
    return true;
  })(fileId);

  statuses = completeDeferredDataVaultApply(statuses, fileId, applied);

  assert.equal(statuses[fileId], "applied");
  assert.equal(applyCalls, 1);
});

test("deferred data vault apply resets when the global apply fails", () => {
  const fileId = "file-1";
  let statuses: DataVaultLocalApplyStatusMap = { [fileId]: "analyzing" };

  statuses = completeDeferredDataVaultApply(statuses, fileId, false);

  assert.equal(statuses[fileId], "idle");
});

test("deferred data vault apply ignores duplicate or out-of-order completion", () => {
  const fileId = "file-1";
  let applyCalls = 0;
  const statuses: DataVaultLocalApplyStatusMap = { [fileId]: "pending" };

  if (canCompleteDeferredDataVaultApply(statuses, fileId)) {
    applyCalls += 1;
  }
  const next = completeDeferredDataVaultApply(statuses, fileId, true);

  assert.equal(next, statuses);
  assert.equal(applyCalls, 0);
  assert.equal(dataVaultApplyStatusForFile({ appliedAt: "2026-06-23T00:00:00.000Z" }, "pending"), "applied");
});
