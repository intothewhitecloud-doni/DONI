import type { Dispatch } from "react";
import { canonicalJson } from "../../policies/canonical-json";
import { sha256Hex } from "../../policies/hash";
import type { PrototypeState, VerificationMethod } from "../../domain/types";
import { commandMeta } from "../events";
import { canCurrentUser } from "../permissions";
import type { PrototypeAction } from "../store";

export async function generateVerificationRecord(
  state: PrototypeState,
  dispatch: Dispatch<PrototypeAction>,
  decisionId: string
): Promise<boolean> {
  if (!canCurrentUser(state, "verification:create")) {
    dispatch({ type: "SET_PERMISSION_DENIED", message: "현재 역할은 검증 기록을 생성할 수 없습니다." });
    return false;
  }

  const decision = state.decisions.find((item) => item.id === decisionId);
  const proposal = state.proposals.find((item) => item.decisionId === decisionId);

  if (!decision || !proposal) {
    dispatch({ type: "SET_SIMULATED_ERROR", message: "확정된 의사결정 결과를 찾을 수 없습니다." });
    return false;
  }

  const history = state.verificationRecords
    .filter((record) => record.decisionId === decisionId)
    .sort((left, right) => right.revision - left.revision || Date.parse(right.verifiedAt) - Date.parse(left.verifiedAt));
  const previousVerification = history[0];
  const revision = (previousVerification?.revision ?? 0) + 1;
  const verificationMethod: VerificationMethod = "xrpl_ready";
  const scopeHash = await hashSelectionScope(state);
  const latestVotes = state.votes
    .filter((vote) => vote.proposalId === proposal.id)
    .map((vote) => ({
      choice: vote.choice,
      reason: vote.reason,
      votedAt: vote.votedAt,
      voterId: vote.voterId
    }))
    .sort((left, right) => left.voterId.localeCompare(right.voterId));
  const canonicalPayload = {
    decision: {
      finalizedAt: decision.finalizedAt,
      id: decision.id,
      result: decision.result,
      title: decision.title
    },
    latestVotes,
    previousVerificationId: previousVerification?.id,
    proposal: {
      id: proposal.id,
      insightId: proposal.insightId,
      status: proposal.status,
      title: proposal.title
    },
    revision,
    selectionScopeHash: scopeHash,
    verificationMethod
  };
  const canonical = canonicalJson(canonicalPayload);
  const hash = await sha256Hex(canonical);
  const recordId = `verification-${decisionId.replace(/^decision-/, "").replace(/[^a-z0-9가-힣-]+/gi, "-")}-${revision}`;
  const generatedAt = new Date().toISOString();

  dispatch({
    type: "ADD_VERIFICATION",
    record: {
      id: recordId,
      decisionId,
      generatedAt,
      previousVerificationId: previousVerification?.id,
      revision,
      status: "verified",
      scopeHash,
      trustCertificationStatus: "pending",
      verificationMethod,
      hash,
      canonicalJson: canonical,
      reference: `검증 원장 준비 / ${hash.slice(0, 12)}`,
      verifiedAt: generatedAt
    },
    ...commandMeta(state, "검증 기록 생성", "verification_record", recordId, "확정된 의사결정 결과의 표준 JSON과 검증 해시를 생성했습니다.")
  });

  return true;
}

async function hashSelectionScope(state: PrototypeState): Promise<string> {
  const scopePayload = {
    entities: sortById(state.entities).map((entity) => ({
      decisionIds: [...entity.decisionIds].sort(),
      eventIds: [...entity.eventIds].sort(),
      id: entity.id,
      insightIds: [...entity.insightIds].sort(),
      kind: entity.kind,
      metricIds: [...entity.metricIds].sort(),
      name: entity.name,
      owner: entity.owner,
      relationIds: [...entity.relationIds].sort(),
      status: entity.status,
      summary: entity.summary
    })),
    events: sortById(state.events).map((event) => ({
      durationHours: event.durationHours,
      evidenceIds: [...event.evidenceIds].sort(),
      id: event.id,
      name: event.name,
      objectId: event.objectId,
      occurredAt: event.occurredAt,
      workflowType: event.workflowType
    })),
    evidence: sortById(state.evidence).map((evidence) => ({
      excerpt: evidence.excerpt,
      id: evidence.id,
      label: evidence.label,
      location: evidence.location,
      sourceFileId: evidence.sourceFileId
    })),
    insightIds: state.insights.map((insight) => insight.id).sort(),
    metricDefinitions: sortById(state.metricDefinitions).map((metric) => ({
      formula: metric.formula,
      id: metric.id,
      name: metric.name,
      relatedObjectIds: [...metric.relatedObjectIds].sort(),
      unit: metric.unit
    })),
    metricValues: sortById(state.metricValues).map((value) => ({
      calculatedAt: value.calculatedAt,
      chartType: value.chartType,
      evidenceIds: [...value.evidenceIds].sort(),
      id: value.id,
      metricId: value.metricId,
      previousValue: value.previousValue,
      series: [...(value.series ?? [])].sort(compareMetricSeriesPoints),
      status: value.status,
      trend: value.trend,
      value: value.value
    })),
    proposalIds: state.proposals.map((proposal) => proposal.id).sort(),
    relations: sortById(state.relations).map((relation) => ({
      description: relation.description,
      evidenceIds: [...relation.evidenceIds].sort(),
      fromId: relation.fromId,
      id: relation.id,
      impact: relation.impact,
      status: relation.status,
      toId: relation.toId,
      type: relation.type
    })),
    scope: state.scope,
    selection: state.selection,
    workflowMetricBindings: sortById(state.workflowMetricBindings ?? []).map((binding) => ({
      eventId: binding.eventId,
      id: binding.id,
      metricId: binding.metricId,
      sourceManagedObjectIds: [...binding.sourceManagedObjectIds].sort()
    }))
  };

  return sha256Hex(canonicalJson(scopePayload));
}

function sortById<T extends { id: string }>(items: T[]): T[] {
  return [...items].sort((left, right) => left.id.localeCompare(right.id));
}

function compareMetricSeriesPoints(
  left: PrototypeState["metricValues"][number]["series"][number],
  right: PrototypeState["metricValues"][number]["series"][number]
): number {
  const leftTime = left.observedAt ? Date.parse(left.observedAt) : Number.NaN;
  const rightTime = right.observedAt ? Date.parse(right.observedAt) : Number.NaN;

  if (!Number.isNaN(leftTime) && !Number.isNaN(rightTime)) {
    return leftTime - rightTime;
  }

  return left.label.localeCompare(right.label);
}
