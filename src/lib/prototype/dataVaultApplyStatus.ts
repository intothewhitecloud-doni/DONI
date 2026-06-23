import type { SourceFile } from "../domain/types";

export type DataVaultLocalApplyStatus = "idle" | "pending" | "analyzing" | "applied";
export type DataVaultLocalApplyStatusMap = Record<string, DataVaultLocalApplyStatus>;

export function dataVaultApplyStatusForFile(
  file: Pick<SourceFile, "appliedAt"> | undefined,
  localStatus: DataVaultLocalApplyStatus | undefined
): DataVaultLocalApplyStatus {
  if (file?.appliedAt) {
    return "applied";
  }

  return localStatus ?? "idle";
}

export function startDeferredDataVaultApply(
  current: DataVaultLocalApplyStatusMap,
  fileId: string
): DataVaultLocalApplyStatusMap {
  return { ...current, [fileId]: "pending" };
}

export function markDeferredDataVaultApplyAnalyzing(
  current: DataVaultLocalApplyStatusMap,
  fileId: string
): DataVaultLocalApplyStatusMap {
  if (current[fileId] !== "pending") {
    return current;
  }

  return { ...current, [fileId]: "analyzing" };
}

export function canCompleteDeferredDataVaultApply(
  current: DataVaultLocalApplyStatusMap,
  fileId: string
): boolean {
  return current[fileId] === "analyzing";
}

export function completeDeferredDataVaultApply(
  current: DataVaultLocalApplyStatusMap,
  fileId: string,
  applied: boolean
): DataVaultLocalApplyStatusMap {
  if (!canCompleteDeferredDataVaultApply(current, fileId)) {
    return current;
  }

  return { ...current, [fileId]: applied ? "applied" : "idle" };
}
