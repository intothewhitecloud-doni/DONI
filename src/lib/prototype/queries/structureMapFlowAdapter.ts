import type { Edge, Node } from "@xyflow/react";
import type { StructureMapEdgeType, StructureMapNodeType } from "../../domain/types";
import type { StructureMapFocusSemantics } from "./structureMapGraphSemantics";
import type { StructureMapGraphEdge, StructureMapGraphNode, StructureMapPoint } from "./structureMapQueries";

export type StructureMapFlowNodeData = Record<string, unknown> & {
  accent: string;
  caption: string;
  dimmed: boolean;
  fill: string;
  iconLabel: string;
  label: string;
  labelVisible: boolean;
  original: StructureMapGraphNode;
  primaryPath: boolean;
  related: boolean;
  searchMatch: boolean;
  selected: boolean;
  stroke: string;
  type: StructureMapNodeType;
};

export type StructureMapFlowEdgeData = Record<string, unknown> & {
  dimmed: boolean;
  focused: boolean;
  labelVisible: boolean;
  manual: boolean;
  original: StructureMapGraphEdge;
  primaryPath: boolean;
  readOnly: boolean;
  related: boolean;
  selected: boolean;
  visualPriority: "context" | "manual" | "primary" | "related";
};

export type StructureMapFlowNode = Node<StructureMapFlowNodeData, "structureMapNode">;

export type StructureMapFlowEdge = Edge<StructureMapFlowEdgeData, "structureMapEdge"> & {
  data: StructureMapFlowEdgeData;
};

export type StructureMapFlowModel = {
  edgeTypes: Record<string, "structureMapEdge">;
  edges: StructureMapFlowEdge[];
  nodeTypes: Record<string, "structureMapNode">;
  nodes: StructureMapFlowNode[];
};

export const structureMapFlowPositionScale = {
  x: 1.8,
  y: 1.42
} as const;

export const structureMapNodeMeta: Record<
  StructureMapNodeType,
  {
    accent: string;
    fill: string;
    icon: string;
    label: string;
    stroke: string;
  }
> = {
  category: {
    accent: "#6366f1",
    fill: "#eef2ff",
    icon: "C",
    label: "유형",
    stroke: "#6366f1"
  },
  insight: {
    accent: "#f97316",
    fill: "#fff7ed",
    icon: "D",
    label: "의사결정",
    stroke: "#f97316"
  },
  managed_object: {
    accent: "#2563eb",
    fill: "#eff6ff",
    icon: "E",
    label: "관리 대상",
    stroke: "#2563eb"
  },
  metric: {
    accent: "#0f766e",
    fill: "#f0fdfa",
    icon: "M",
    label: "지표",
    stroke: "#0f766e"
  },
  workflow: {
    accent: "#7c3aed",
    fill: "#f5f3ff",
    icon: "Ev",
    label: "업무 흐름",
    stroke: "#7c3aed"
  }
};

export const structureMapEdgeMeta: Record<
  StructureMapEdgeType,
  {
    color: string;
    label: string;
  }
> = {
  managed_object_structural: {
    color: "#2563eb",
    label: "구조 관계"
  },
  managed_object_workflow: {
    color: "#7c3aed",
    label: "업무 연결"
  },
  metric_insight: {
    color: "#dc2626",
    label: "지표-인사이트"
  },
  workflow_metric: {
    color: "#d97706",
    label: "업무-지표"
  },
  workflow_sequence: {
    color: "#0f766e",
    label: "업무 순서"
  }
};

export function buildStructureMapFlowModel(
  nodes: StructureMapGraphNode[],
  edges: StructureMapGraphEdge[],
  semantics: StructureMapFocusSemantics
): StructureMapFlowModel {
  return {
    edgeTypes: { structureMapEdge: "structureMapEdge" },
    edges: edges.map((edge) => flowEdge(edge, semantics)),
    nodeTypes: { structureMapNode: "structureMapNode" },
    nodes: nodes.map((node) => flowNode(node, semantics))
  };
}

function flowNode(node: StructureMapGraphNode, semantics: StructureMapFocusSemantics): StructureMapFlowNode {
  const meta = structureMapNodeMeta[node.type];
  const selected = semantics.relatedIds.has(node.id) && semantics.activeIds.has(node.id);
  const primaryPath = semantics.primaryPathIds.has(node.id);
  const searchMatch = semantics.searchMatchNodeIds.has(node.id);
  const related = semantics.relatedIds.has(node.id);
  const dimmed = semantics.dimmedIds.has(node.id);

  return {
    data: {
      accent: meta.accent,
      caption: node.caption,
      dimmed,
      fill: nodeFill(node, meta.fill),
      iconLabel: meta.icon,
      label: node.label,
      labelVisible: primaryPath || searchMatch || selected || node.tone === "danger" || node.tone === "warning",
      original: node,
      primaryPath,
      related,
      searchMatch,
      selected,
      stroke: selected ? "#2563eb" : primaryPath ? meta.accent : meta.stroke,
      type: node.type
    },
    id: node.id,
    position: toStructureMapFlowPosition(node.position),
    selected,
    type: "structureMapNode"
  };
}

function flowEdge(edge: StructureMapGraphEdge, semantics: StructureMapFocusSemantics): StructureMapFlowEdge {
  const meta = structureMapEdgeMeta[edge.edgeType];
  const selected = semantics.relatedIds.has(edge.id) && semantics.activeIds.has(edge.id);
  const focused = semantics.searchFocusEdgeIds.has(edge.id);
  const related = semantics.relatedIds.has(edge.id);
  const primaryPath = semantics.primaryPathIds.has(edge.id);
  const dimmed = semantics.dimmedIds.has(edge.id);
  const visualPriority = edgePriority({ edge, primaryPath, related, selected });
  const stroke = selected ? "#1d4ed8" : primaryPath ? meta.color : focused ? "#14b8a6" : meta.color;
  const strokeWidth = visualPriority === "primary" ? 2.7 : visualPriority === "related" ? 2.1 : visualPriority === "manual" ? 1.7 : 1.1;
  const opacity = dimmed ? 0.12 : visualPriority === "context" ? 0.28 : 0.82;
  const labelVisible =
    semantics.selectedItemId === edge.id ||
    focused ||
    (!dimmed && primaryPath && !edge.readOnly && edge.edgeType === "metric_insight");

  return {
    animated: primaryPath,
    data: {
      dimmed,
      focused,
      labelVisible,
      manual: !edge.readOnly,
      original: edge,
      primaryPath,
      readOnly: edge.readOnly,
      related,
      selected,
      visualPriority
    },
    id: edge.id,
    label: labelVisible ? edge.label : undefined,
    markerEnd: {
      color: stroke,
      height: visualPriority === "primary" ? 16 : 12,
      type: "arrowclosed",
      width: visualPriority === "primary" ? 16 : 12
    },
    source: edge.fromId,
    style: {
      opacity,
      stroke,
      strokeDasharray: edge.readOnly || edge.strength === "weak" ? "6 4" : undefined,
      strokeWidth
    },
    target: edge.toId,
    type: "structureMapEdge"
  };
}

function nodeFill(node: StructureMapGraphNode, baseFill: string): string {
  if (node.tone === "danger") {
    return "#fff1f2";
  }
  if (node.tone === "warning") {
    return "#fffbeb";
  }
  return baseFill;
}

export function toStructureMapFlowPosition(position: StructureMapPoint): StructureMapPoint {
  return {
    x: Math.round(position.x * structureMapFlowPositionScale.x),
    y: Math.round(position.y * structureMapFlowPositionScale.y)
  };
}

export function toStructureMapDomainPosition(position: StructureMapPoint): StructureMapPoint {
  return {
    x: Math.round(position.x / structureMapFlowPositionScale.x),
    y: Math.round(position.y / structureMapFlowPositionScale.y)
  };
}

function edgePriority({
  edge,
  primaryPath,
  related,
  selected
}: {
  edge: StructureMapGraphEdge;
  primaryPath: boolean;
  related: boolean;
  selected: boolean;
}): StructureMapFlowEdgeData["visualPriority"] {
  if (primaryPath) {
    return "primary";
  }
  if (selected || related) {
    return "related";
  }
  if (!edge.readOnly) {
    return "manual";
  }
  return "context";
}
