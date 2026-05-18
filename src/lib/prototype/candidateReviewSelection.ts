import { relatedCandidateIdsByManagedObject } from "../domain/result-scenarios";
import type { CandidateType, ExtractionCandidate } from "../domain/types";

export type CandidateSelectionMap = Record<CandidateType, string[]>;

export const emptyCandidateSelection: CandidateSelectionMap = {
  managed_object: [],
  workflow_event: [],
  relation: [],
  metric: []
};

export function rowsForReviewStep(candidates: ExtractionCandidate[], candidateType: CandidateType, managedCandidateIds: string[]): ExtractionCandidate[] {
  const rows = candidates.filter((candidate) => candidate.type === candidateType && candidate.status !== "excluded");
  if (candidateType === "managed_object") {
    return rows;
  }

  if (managedCandidateIds.length === 0) {
    return [];
  }

  const relatedIds = Array.from(
    new Set(managedCandidateIds.flatMap((managedCandidateId) => relatedCandidateIdsByManagedObject[managedCandidateId]?.[candidateType] ?? []))
  );
  return rows.filter((candidate) => relatedIds.includes(candidate.id));
}

export function buildCandidateSelectionDefaults(
  candidates: ExtractionCandidate[],
  current?: CandidateSelectionMap,
  manualExcludedCandidateIds: string[] = []
): CandidateSelectionMap {
  const managedRows = rowsForReviewStep(candidates, "managed_object", []);
  const manualExclusions = new Set(manualExcludedCandidateIds);
  const selectedManagedCandidateIds = (current?.managed_object ?? []).filter((candidateId) =>
    managedRows.some((candidate) => candidate.id === candidateId)
  );
  const managedCandidateIds = current ? selectedManagedCandidateIds : managedRows.map((candidate) => candidate.id);
  const next: CandidateSelectionMap = {
    managed_object: managedCandidateIds,
    workflow_event: [],
    relation: [],
    metric: []
  };

  (["workflow_event", "relation", "metric"] as CandidateType[]).forEach((candidateType) => {
    const rows = rowsForReviewStep(candidates, candidateType, managedCandidateIds);
    next[candidateType] = rows.map((candidate) => candidate.id).filter((candidateId) => !manualExclusions.has(candidateId));
  });

  return next;
}
