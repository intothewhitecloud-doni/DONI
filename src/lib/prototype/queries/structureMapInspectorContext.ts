import type { StructureMapDepth } from "../../domain/types";
import type { StructureMapPathSummary } from "./structureMapGraphSemantics";
import { getStructureMapPathSummary, getStructureMapRelatedIds } from "./structureMapGraphSemantics";
import type { StructureMapGraphEdge, StructureMapGraphNode, StructureMapItemDetail } from "./structureMapQueries";

export type StructureMapInspectorContext = {
  connectedDecisionLabels: string[];
  directEdgeCount: number;
  evidenceLabels: string[];
  generatedEdgeCount: number;
  incomingCount: number;
  manualEdgeCount: number;
  metricLabels: string[];
  outgoingCount: number;
  pathSummary: StructureMapPathSummary;
  primaryPath: boolean;
  sourceLabels: string[];
};

export function buildStructureMapInspectorContext({
  depth,
  detail,
  edges,
  evidenceLabelById,
  metricLabelById,
  nodes,
  primaryPathIds
}: {
  depth: StructureMapDepth;
  detail?: StructureMapItemDetail;
  edges: StructureMapGraphEdge[];
  evidenceLabelById: Map<string, string>;
  metricLabelById: Map<string, string>;
  nodes: StructureMapGraphNode[];
  primaryPathIds: Set<string>;
}): StructureMapInspectorContext {
  const selectedIds = detail ? getStructureMapRelatedIds(nodes, edges, detail.id, depth) : new Set(primaryPathIds);
  const pathSummary = getStructureMapPathSummary(nodes, edges, selectedIds);
  const directEdges = detail
    ? detail.kind === "edge"
      ? edges.filter((edge) => edge.id === detail.id)
      : edges.filter((edge) => edge.fromId === detail.id || edge.toId === detail.id)
    : edges.filter((edge) => primaryPathIds.has(edge.id));
  const pathEdges = edges.filter((edge) => selectedIds.has(edge.id));
  const contextEdges = uniqueGraphEdges([...directEdges, ...pathEdges]);
  const decisionLabels = nodes.filter((node) => node.type === "insight" && selectedIds.has(node.id)).map((node) => node.label);
  const metricNodeLabels = nodes.filter((node) => node.type === "metric" && selectedIds.has(node.id)).map((node) => node.label);
  const metricIds = uniqueStrings([...pathSummary.metricIds, ...contextEdges.flatMap((edge) => edge.metricIds)]);
  const evidenceIds = uniqueStrings([...pathSummary.evidenceIds, ...(detail?.evidenceIds ?? []), ...contextEdges.flatMap((edge) => edge.evidenceIds)]);
  const primaryPath = [...selectedIds].some((id) => primaryPathIds.has(id));

  return {
    connectedDecisionLabels: uniqueStrings(decisionLabels).slice(0, 4),
    directEdgeCount: directEdges.length,
    evidenceLabels: evidenceIds.map((id) => evidenceLabelById.get(id) ?? id).slice(0, 4),
    generatedEdgeCount: contextEdges.filter((edge) => edge.readOnly).length,
    incomingCount: detail?.kind === "node" ? directEdges.filter((edge) => edge.toId === detail.id).length : 0,
    manualEdgeCount: contextEdges.filter((edge) => !edge.readOnly).length,
    metricLabels: uniqueStrings([...metricIds.map((id) => metricLabelById.get(id) ?? id), ...metricNodeLabels]).slice(0, 4),
    outgoingCount: detail?.kind === "node" ? directEdges.filter((edge) => edge.fromId === detail.id).length : 0,
    pathSummary: {
      ...pathSummary,
      evidenceIds,
      metricIds
    },
    primaryPath,
    sourceLabels: uniqueStrings(contextEdges.map((edge) => edgeSourceLabel(edge.source))).slice(0, 3)
  };
}

function uniqueGraphEdges(edges: StructureMapGraphEdge[]): StructureMapGraphEdge[] {
  const seen = new Set<string>();
  return edges.filter((edge) => {
    if (seen.has(edge.id)) {
      return false;
    }
    seen.add(edge.id);
    return true;
  });
}

function edgeSourceLabel(source: StructureMapGraphEdge["source"]): string {
  const labels: Record<StructureMapGraphEdge["source"], string> = {
    event_object: "Event 원천",
    metric_insight: "Metric→Decision",
    relation: "수동 Relation",
    workflow_metric_binding: "Event→Metric",
    workflow_sequence: "Event 순서"
  };
  return labels[source];
}

function uniqueStrings(items: string[]): string[] {
  return [...new Set(items.filter(Boolean))];
}
