import type { StructureMapDepth, StructureMapNodeType } from "../../domain/types";
import type { StructureMapGraphEdge, StructureMapGraphNode, StructureMapSearchFocus } from "./structureMapQueries";

export type StructureMapRelatedSets = {
  edgeIds: Set<string>;
  nodeIds: Set<string>;
  allIds: Set<string>;
};

export type StructureMapPathItem = {
  id: string;
  label: string;
  type: StructureMapNodeType;
};

export type StructureMapPathSummary = {
  countsByType: Record<StructureMapNodeType, number>;
  edgeIds: string[];
  evidenceIds: string[];
  metricIds: string[];
  nodeIds: string[];
  pathItems: StructureMapPathItem[];
};

export type StructureMapFocusSemantics = {
  activeIds: Set<string>;
  dimmedIds: Set<string>;
  primaryEdgeIds: Set<string>;
  primaryNodeIds: Set<string>;
  primaryPathReason: string;
  primaryPathIds: Set<string>;
  relatedIds: Set<string>;
  searchFocusEdgeIds: Set<string>;
  searchFocusNodeIds: Set<string>;
  searchMatchNodeIds: Set<string>;
};

export type StructureMapPrimaryInsightSelector = (nodes: StructureMapGraphNode[]) => StructureMapGraphNode | undefined;

export type StructureMapPrimaryPath = {
  edgeIds: Set<string>;
  nodeIds: Set<string>;
  reason: string;
  targetInsightId?: string;
  allIds: Set<string>;
};

export function getStructureMapRelatedIds(
  nodes: StructureMapGraphNode[],
  edges: StructureMapGraphEdge[],
  selectedItemId: string,
  depth: StructureMapDepth
): Set<string> {
  return getStructureMapRelatedSets(nodes, edges, selectedItemId, depth).allIds;
}

export function getStructureMapRelatedSets(
  nodes: StructureMapGraphNode[],
  edges: StructureMapGraphEdge[],
  selectedItemId: string,
  depth: StructureMapDepth
): StructureMapRelatedSets {
  const nodeIds = new Set<string>();
  const edgeIds = new Set<string>();
  const allIds = new Set<string>([selectedItemId]);
  const selectedEdge = edges.find((edge) => edge.id === selectedItemId);

  if (selectedEdge) {
    edgeIds.add(selectedEdge.id);
    nodeIds.add(selectedEdge.fromId);
    nodeIds.add(selectedEdge.toId);
    const relatedNodeIds = traverseGraphNodeIds(edges, [selectedEdge.fromId, selectedEdge.toId], depth);
    relatedNodeIds.forEach((id) => nodeIds.add(id));
    collectEdgesWithinNodes(edges, relatedNodeIds).forEach((id) => edgeIds.add(id));
    return mergeRelatedSets(nodeIds, edgeIds, allIds);
  }

  if (!nodes.some((node) => node.id === selectedItemId)) {
    return { allIds, edgeIds, nodeIds };
  }

  nodeIds.add(selectedItemId);
  const relatedNodeIds = traverseGraphNodeIds(edges, [selectedItemId], depth);
  relatedNodeIds.forEach((id) => nodeIds.add(id));
  collectEdgesWithinNodes(edges, relatedNodeIds).forEach((id) => edgeIds.add(id));
  return mergeRelatedSets(nodeIds, edgeIds, allIds);
}

export function getStructureMapPrimaryPathIds(nodes: StructureMapGraphNode[], edges: StructureMapGraphEdge[]): Set<string> {
  return getStructureMapPrimaryPath(nodes, edges).allIds;
}

export function getStructureMapPrimaryPath(
  nodes: StructureMapGraphNode[],
  edges: StructureMapGraphEdge[],
  selectPrimaryInsight: StructureMapPrimaryInsightSelector = choosePrimaryInsight
): StructureMapPrimaryPath {
  const targetInsight = selectPrimaryInsight(nodes);
  if (!targetInsight) {
    return {
      allIds: new Set<string>(),
      edgeIds: new Set<string>(),
      nodeIds: new Set<string>(),
      reason: "의사결정 노드 없음"
    };
  }

  const primaryNodeIds = new Set<string>([targetInsight.id]);
  const primaryEdgeIds = new Set<string>();

  collectIncoming(edges, [targetInsight.id], (edge) => edge.edgeType === "metric_insight").forEach((edge) => {
    primaryEdgeIds.add(edge.id);
    primaryNodeIds.add(edge.fromId);
  });

  collectIncoming(edges, [...primaryNodeIds], (edge) => edge.edgeType === "workflow_metric").forEach((edge) => {
    primaryEdgeIds.add(edge.id);
    primaryNodeIds.add(edge.fromId);
    primaryNodeIds.add(edge.toId);
  });

  collectIncoming(edges, [...primaryNodeIds], (edge) => edge.edgeType === "managed_object_workflow").forEach((edge) => {
    primaryEdgeIds.add(edge.id);
    primaryNodeIds.add(edge.fromId);
    primaryNodeIds.add(edge.toId);
  });

  edges
    .filter((edge) => edge.source === "relation" && (edge.strength === "strong" || primaryNodeIds.has(edge.fromId) || primaryNodeIds.has(edge.toId)))
    .filter((edge) => primaryNodeIds.has(edge.fromId) || primaryNodeIds.has(edge.toId))
    .forEach((edge) => {
      primaryEdgeIds.add(edge.id);
      primaryNodeIds.add(edge.fromId);
      primaryNodeIds.add(edge.toId);
    });

  edges
    .filter((edge) => primaryNodeIds.has(edge.fromId) && primaryNodeIds.has(edge.toId))
    .forEach((edge) => primaryEdgeIds.add(edge.id));

  return {
    allIds: new Set([...primaryNodeIds, ...primaryEdgeIds]),
    edgeIds: primaryEdgeIds,
    nodeIds: primaryNodeIds,
    reason: `${targetInsight.label} 의사결정으로 이어지는 기본 운영 경로`,
    targetInsightId: targetInsight.id
  };
}

export function buildStructureMapFocusSemantics({
  depth,
  edges,
  nodes,
  searchFocus,
  selectedItemId,
  selectPrimaryInsight
}: {
  depth: StructureMapDepth;
  edges: StructureMapGraphEdge[];
  nodes: StructureMapGraphNode[];
  searchFocus: StructureMapSearchFocus;
  selectedItemId?: string;
  selectPrimaryInsight?: StructureMapPrimaryInsightSelector;
}): StructureMapFocusSemantics {
  const relatedIds = selectedItemId ? getStructureMapRelatedIds(nodes, edges, selectedItemId, depth) : new Set<string>();
  const primaryPath = getStructureMapPrimaryPath(nodes, edges, selectPrimaryInsight);
  const primaryPathIds = primaryPath.allIds;
  const searchMatchNodeIds = new Set(searchFocus.matchNodeIds);
  const searchFocusNodeIds = new Set(searchFocus.nodeIds);
  const searchFocusEdgeIds = new Set(searchFocus.edgeIds);
  const hasSearch = Boolean(searchFocus.query);
  const hasSearchMatches = searchMatchNodeIds.size > 0;
  const activeIds = new Set<string>([...primaryPathIds]);
  const dimmedIds = new Set<string>();

  relatedIds.forEach((id) => activeIds.add(id));
  searchMatchNodeIds.forEach((id) => activeIds.add(id));
  searchFocusNodeIds.forEach((id) => activeIds.add(id));
  searchFocusEdgeIds.forEach((id) => activeIds.add(id));

  if (selectedItemId) {
    for (const node of nodes) {
      if (!relatedIds.has(node.id)) {
        dimmedIds.add(node.id);
      }
    }
    for (const edge of edges) {
      if (!relatedIds.has(edge.id)) {
        dimmedIds.add(edge.id);
      }
    }
  } else if (hasSearch) {
    for (const node of nodes) {
      if (!hasSearchMatches || (!searchFocusNodeIds.has(node.id) && !searchMatchNodeIds.has(node.id))) {
        dimmedIds.add(node.id);
      }
    }
    for (const edge of edges) {
      if (!hasSearchMatches || !searchFocusEdgeIds.has(edge.id)) {
        dimmedIds.add(edge.id);
      }
    }
  } else {
    for (const node of nodes) {
      if (!primaryPathIds.has(node.id)) {
        dimmedIds.add(node.id);
      }
    }
    for (const edge of edges) {
      if (!primaryPathIds.has(edge.id)) {
        dimmedIds.add(edge.id);
      }
    }
  }

  return {
    activeIds,
    dimmedIds,
    primaryEdgeIds: primaryPath.edgeIds,
    primaryNodeIds: primaryPath.nodeIds,
    primaryPathReason: primaryPath.reason,
    primaryPathIds,
    relatedIds,
    searchFocusEdgeIds,
    searchFocusNodeIds,
    searchMatchNodeIds
  };
}

export function getStructureMapPathSummary(
  nodes: StructureMapGraphNode[],
  edges: StructureMapGraphEdge[],
  itemIds: Set<string>
): StructureMapPathSummary {
  const nodeIds = nodes.filter((node) => itemIds.has(node.id)).map((node) => node.id);
  const edgeIds = edges.filter((edge) => itemIds.has(edge.id)).map((edge) => edge.id);
  const countsByType = countNodesByType(nodes.filter((node) => itemIds.has(node.id)));
  const edgeItems = edges.filter((edge) => itemIds.has(edge.id));
  const evidenceIds = unique(edgeItems.flatMap((edge) => edge.evidenceIds));
  const metricIds = unique([
    ...edgeItems.flatMap((edge) => edge.metricIds),
    ...nodes.filter((node) => itemIds.has(node.id) && node.type === "metric").map((node) => node.id)
  ]);
  const pathItems = nodes
    .filter((node) => itemIds.has(node.id))
    .sort((left, right) => nodeTypeOrder(left.type) - nodeTypeOrder(right.type) || left.label.localeCompare(right.label, "ko"))
    .map((node) => ({
      id: node.id,
      label: node.label,
      type: node.type
    }));

  return {
    countsByType,
    edgeIds,
    evidenceIds,
    metricIds,
    nodeIds,
    pathItems
  };
}

function choosePrimaryInsight(nodes: StructureMapGraphNode[]): StructureMapGraphNode | undefined {
  return (
    nodes.find((node) => node.id === "insight-product-margin") ??
    nodes.find((node) => node.type === "insight" && node.tone === "danger") ??
    nodes.find((node) => node.type === "insight")
  );
}

function collectIncoming(
  edges: StructureMapGraphEdge[],
  targetIds: string[],
  predicate: (edge: StructureMapGraphEdge) => boolean
): StructureMapGraphEdge[] {
  const targetSet = new Set(targetIds);
  return edges.filter((edge) => targetSet.has(edge.toId) && predicate(edge));
}

function traverseGraphNodeIds(edges: StructureMapGraphEdge[], rootIds: string[], depth: StructureMapDepth): Set<string> {
  const visited = new Set(rootIds);
  if (depth === "all") {
    let changed = true;
    while (changed) {
      changed = expandGraphOneHop(edges, visited);
    }
    return visited;
  }

  for (let level = 0; level < depth; level += 1) {
    expandGraphOneHop(edges, visited);
  }
  return visited;
}

function expandGraphOneHop(edges: StructureMapGraphEdge[], visited: Set<string>): boolean {
  let changed = false;
  for (const edge of edges) {
    if (visited.has(edge.fromId) && !visited.has(edge.toId)) {
      visited.add(edge.toId);
      changed = true;
    }
    if (visited.has(edge.toId) && !visited.has(edge.fromId)) {
      visited.add(edge.fromId);
      changed = true;
    }
  }
  return changed;
}

function collectEdgesWithinNodes(edges: StructureMapGraphEdge[], nodeIds: Set<string>): Set<string> {
  return new Set(edges.filter((edge) => nodeIds.has(edge.fromId) && nodeIds.has(edge.toId)).map((edge) => edge.id));
}

function mergeRelatedSets(nodeIds: Set<string>, edgeIds: Set<string>, allIds: Set<string>): StructureMapRelatedSets {
  nodeIds.forEach((id) => allIds.add(id));
  edgeIds.forEach((id) => allIds.add(id));
  return { allIds, edgeIds, nodeIds };
}

function countNodesByType(nodes: StructureMapGraphNode[]): Record<StructureMapNodeType, number> {
  const counts: Record<StructureMapNodeType, number> = {
    category: 0,
    insight: 0,
    managed_object: 0,
    metric: 0,
    workflow: 0
  };
  for (const node of nodes) {
    counts[node.type] += 1;
  }
  return counts;
}

function nodeTypeOrder(type: StructureMapNodeType): number {
  const order: Record<StructureMapNodeType, number> = {
    category: 0,
    managed_object: 1,
    workflow: 2,
    metric: 3,
    insight: 4
  };
  return order[type];
}

function unique(items: string[]): string[] {
  return [...new Set(items)];
}
