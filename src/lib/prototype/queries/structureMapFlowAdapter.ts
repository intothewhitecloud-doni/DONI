import type { Edge, Node } from "@xyflow/react";
import type { StructureMapEdgeType, StructureMapNodeType } from "../../domain/types";
import type { StructureMapFocusSemantics } from "./structureMapGraphSemantics";
import { structureMapEdgeMeta, structureMapNodeMeta } from "./structureMapLayerMeta";
import type { StructureMapGraphEdge, StructureMapGraphNode, StructureMapPoint } from "./structureMapQueries";

export { structureMapEdgeMeta, structureMapNodeMeta } from "./structureMapLayerMeta";

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
  searchFocused: boolean;
  searchMatch: boolean;
  searchQuery: string;
  selected: boolean;
  stroke: string;
  type: StructureMapNodeType;
};

export type StructureMapFlowEdgeData = Record<string, unknown> & {
  directFocus: boolean;
  dimmed: boolean;
  focused: boolean;
  labelVisible: boolean;
  manual: boolean;
  original: StructureMapGraphEdge;
  primaryPath: boolean;
  readOnly: boolean;
  related: boolean;
  routeCount: number;
  routeIndex: number;
  selected: boolean;
  visualPriority: "context" | "direct" | "manual" | "primary" | "related" | "selected";
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
  x: 1.9,
  y: 1.42
} as const;

export function buildStructureMapFlowModel(
  nodes: StructureMapGraphNode[],
  edges: StructureMapGraphEdge[],
  semantics: StructureMapFocusSemantics
): StructureMapFlowModel {
  const routeHints = buildEdgeRouteHints(edges);
  return {
    edgeTypes: { structureMapEdge: "structureMapEdge" },
    edges: edges.map((edge) => flowEdge(edge, semantics, routeHints.get(edge.id) ?? { routeCount: 1, routeIndex: 0 })),
    nodeTypes: { structureMapNode: "structureMapNode" },
    nodes: nodes.map((node) => flowNode(node, semantics))
  };
}

function flowNode(node: StructureMapGraphNode, semantics: StructureMapFocusSemantics): StructureMapFlowNode {
  const meta = structureMapNodeMeta[node.type];
  const selected = semantics.selectedItemId === node.id;
  const primaryPath = semantics.primaryPathIds.has(node.id);
  const searchMatch = semantics.searchMatchNodeIds.has(node.id);
  const searchFocused = semantics.searchFocusNodeIds.has(node.id);
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
      searchFocused,
      searchMatch,
      searchQuery: searchMatch ? semantics.searchQuery ?? "" : "",
      selected,
      stroke: selected ? "#db2777" : searchMatch ? "#f59e0b" : related ? "#2563eb" : primaryPath ? meta.accent : meta.stroke,
      type: node.type
    },
    id: node.id,
    position: toStructureMapFlowPosition(node.position),
    selected,
    type: "structureMapNode",
    zIndex: nodeZIndex({ primaryPath, related, searchMatch, selected })
  };
}

function flowEdge(
  edge: StructureMapGraphEdge,
  semantics: StructureMapFocusSemantics,
  routeHint: { routeCount: number; routeIndex: number }
): StructureMapFlowEdge {
  const meta = structureMapEdgeMeta[edge.edgeType];
  const selected = semantics.selectedItemId === edge.id;
  const focused = semantics.searchFocusEdgeIds.has(edge.id);
  const related = semantics.relatedIds.has(edge.id);
  const searchDirectFocus = focused && (semantics.searchMatchNodeIds.has(edge.fromId) || semantics.searchMatchNodeIds.has(edge.toId));
  const directFocus = selected || searchDirectFocus || Boolean(semantics.selectedItemId && (edge.fromId === semantics.selectedItemId || edge.toId === semantics.selectedItemId));
  const primaryPath = semantics.primaryPathIds.has(edge.id);
  const dimmed = semantics.dimmedIds.has(edge.id);
  const visualPriority = edgePriority({ directFocus, edge, primaryPath, related: related || focused, selected });
  const stroke = edgeStroke({ metaColor: meta.color, visualPriority });
  const strokeWidth =
    visualPriority === "selected" ? 3.45 :
    visualPriority === "direct" ? 2.85 :
    visualPriority === "primary" ? 2.35 :
    visualPriority === "related" ? 1.9 :
    visualPriority === "manual" ? 1.45 :
    0.85;
  const opacity =
    dimmed ? 0.08 :
    visualPriority === "selected" ? 1 :
    visualPriority === "direct" ? 0.94 :
    visualPriority === "context" ? 0.14 :
    visualPriority === "manual" ? 0.5 :
    visualPriority === "related" ? 0.66 :
    0.74;
  const hasUserFocus = Boolean(semantics.selectedItemId || semantics.searchFocusEdgeIds.size > 0 || semantics.searchMatchNodeIds.size > 0);
  const animated = hasUserFocus && directFocus;
  const labelVisible =
    selected ||
    directFocus ||
    (!dimmed && primaryPath && !edge.readOnly && edge.edgeType === "metric_insight");

  return {
    animated,
    data: {
      directFocus,
      dimmed,
      focused,
      labelVisible,
      manual: !edge.readOnly,
      original: edge,
      primaryPath,
      readOnly: edge.readOnly,
      related,
      routeCount: routeHint.routeCount,
      routeIndex: routeHint.routeIndex,
      selected,
      visualPriority
    },
    id: edge.id,
    label: labelVisible ? edge.label : undefined,
    markerEnd: {
      color: stroke,
      height: visualPriority === "selected" ? 18 : visualPriority === "direct" || visualPriority === "primary" ? 16 : 12,
      type: "arrowclosed",
      width: visualPriority === "selected" ? 18 : visualPriority === "direct" || visualPriority === "primary" ? 16 : 12
    },
    selected,
    source: edge.fromId,
    style: {
      opacity,
      stroke,
      strokeDasharray: edge.readOnly || edge.strength === "weak" ? "6 4" : undefined,
      strokeWidth
    },
    target: edge.toId,
    type: "structureMapEdge",
    zIndex: edgeZIndex(visualPriority)
  };
}

function buildEdgeRouteHints(edges: StructureMapGraphEdge[]): Map<string, { routeCount: number; routeIndex: number }> {
  const outgoingGroups = new Map<string, StructureMapGraphEdge[]>();
  for (const edge of edges) {
    const group = outgoingGroups.get(edge.fromId) ?? [];
    group.push(edge);
    outgoingGroups.set(edge.fromId, group);
  }

  const routeHints = new Map<string, { routeCount: number; routeIndex: number }>();
  for (const group of outgoingGroups.values()) {
    const sortedGroup = [...group].sort((left, right) => `${left.toId}:${left.id}`.localeCompare(`${right.toId}:${right.id}`));
    sortedGroup.forEach((edge, index) => {
      routeHints.set(edge.id, {
        routeCount: sortedGroup.length,
        routeIndex: index
      });
    });
  }

  return routeHints;
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
  directFocus,
  edge,
  primaryPath,
  related,
  selected
}: {
  directFocus: boolean;
  edge: StructureMapGraphEdge;
  primaryPath: boolean;
  related: boolean;
  selected: boolean;
}): StructureMapFlowEdgeData["visualPriority"] {
  if (selected) {
    return "selected";
  }
  if (directFocus) {
    return "direct";
  }
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

function edgeStroke({
  metaColor,
  visualPriority
}: {
  metaColor: string;
  visualPriority: StructureMapFlowEdgeData["visualPriority"];
}): string {
  if (visualPriority === "selected") {
    return "#db2777";
  }
  if (visualPriority === "direct") {
    return "#2563eb";
  }
  if (visualPriority === "related") {
    return "#0f766e";
  }
  return metaColor;
}

function edgeZIndex(visualPriority: StructureMapFlowEdgeData["visualPriority"]): number {
  if (visualPriority === "selected") {
    return 50;
  }
  if (visualPriority === "direct") {
    return 40;
  }
  if (visualPriority === "primary") {
    return 30;
  }
  if (visualPriority === "related") {
    return 20;
  }
  if (visualPriority === "manual") {
    return 10;
  }
  return 1;
}

function nodeZIndex({
  primaryPath,
  related,
  searchMatch,
  selected
}: {
  primaryPath: boolean;
  related: boolean;
  searchMatch: boolean;
  selected: boolean;
}): number {
  if (selected) {
    return 150;
  }
  if (searchMatch) {
    return 140;
  }
  if (related) {
    return 120;
  }
  if (primaryPath) {
    return 110;
  }
  return 100;
}
