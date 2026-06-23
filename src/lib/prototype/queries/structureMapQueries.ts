import type { AIInsight, EntityInstance, EventRecord, MetricDefinition, MetricValue, PrototypeState, Relation, StructureMapDepth, StructureMapLayoutMode } from "../../domain/types";
import { defaultStructureMapEdgeTypes, defaultStructureMapNodeTypes } from "../../domain/types";
import { displayTypeLabel } from "../../domain/type-catalog";
import { currentCompanyData } from "../selectors";
import {
  managedObjectGraphLegend,
  type ManagedObjectGraphEdgeType,
  type ManagedObjectGraphLegendItem,
  type ManagedObjectGraphNodeType
} from "./managedObjectQueries";
import { sortEventsByWorkflowSequence, workflowSequence } from "./graphRules";

type CompanyData = ReturnType<typeof currentCompanyData>;

export type { StructureMapDepth, StructureMapLayoutMode } from "../../domain/types";
export type StructureMapItemKind = "node" | "edge";
export type StructureMapEdgeSource =
  | "relation"
  | "event_object"
  | "workflow_sequence"
  | "workflow_metric_binding"
  | "metric_insight";

export type StructureMapPoint = {
  x: number;
  y: number;
};

export type StructureMapGraphNode = {
  id: string;
  label: string;
  caption: string;
  type: ManagedObjectGraphNodeType;
  tone: "primary" | "warning" | "info" | "neutral" | "success" | "danger";
  body?: string;
  editorDraft: {
    primary: string;
    secondary: string;
    body: string;
  };
  position: StructureMapPoint;
};

export type StructureMapGraphEdge = {
  id: string;
  fromId: string;
  toId: string;
  label: string;
  edgeType: ManagedObjectGraphEdgeType;
  kind: ManagedObjectGraphEdgeType;
  source: StructureMapEdgeSource;
  readOnly: boolean;
  readOnlyReason?: string;
  relationId?: string;
  description?: string;
  evidenceIds: string[];
  impact?: string;
  metricIds: string[];
  confidence?: number;
  strength?: "weak" | "medium" | "strong";
  relationKind?: string;
};

export type StructureMapItemDetail = {
  kind: StructureMapItemKind;
  id: string;
  title: string;
  subtitle: string;
  body?: string;
  badges: string[];
  evidenceIds: string[];
  metricIds: string[];
  editable: boolean;
  readOnlyReason?: string;
};

export type StructureMapSummary = {
  totalNodes: number;
  totalEdges: number;
  visibleNodes: number;
  visibleEdges: number;
  hiddenNodes: number;
  hiddenEdges: number;
  relationEdges: number;
  generatedEdges: number;
  byNodeType: Record<ManagedObjectGraphNodeType, number>;
  byEdgeType: Record<ManagedObjectGraphEdgeType, number>;
};

export type StructureMapSearchFocus = {
  edgeIds: string[];
  matchNodeIds: string[];
  nodeIds: string[];
  query: string;
};

export type StructureMapViewOptions = {
  searchQuery?: string;
  nodeTypes?: ManagedObjectGraphNodeType[];
  edgeTypes?: ManagedObjectGraphEdgeType[];
  depth?: StructureMapDepth;
  layoutMode?: StructureMapLayoutMode;
  selectedItemId?: string;
  hiddenNodeIds?: string[];
  hiddenEdgeIds?: string[];
  savedPositions?: Record<StructureMapLayoutMode, Record<string, StructureMapPoint>>;
};

export type StructureMapView = {
  nodes: StructureMapGraphNode[];
  edges: StructureMapGraphEdge[];
  legend: ManagedObjectGraphLegendItem[];
  searchFocus: StructureMapSearchFocus;
  summary: StructureMapSummary;
  selectedDetail?: StructureMapItemDetail;
  defaultItemId?: string;
};

const defaultDepth: StructureMapDepth = "all";
const defaultNodeTypes: ManagedObjectGraphNodeType[] = [...defaultStructureMapNodeTypes];
const defaultEdgeTypes: ManagedObjectGraphEdgeType[] = [...defaultStructureMapEdgeTypes];

const generatedEdgeReason = "업무흐름, 지표, 인사이트 원천 컬렉션에서 생성된 읽기 전용 연결입니다.";

export function getStructureMapView(state: PrototypeState, options: StructureMapViewOptions = {}): StructureMapView {
  const data = currentCompanyData(state);
  const allNodes = buildStructureMapNodes(data);
  const allEdges = buildStructureMapEdges(data, allNodes);
  const filtered = filterStructureMap({
    edges: allEdges,
    nodes: allNodes,
    options
  });
  const nodes = applyLayout(filtered.nodes, filtered.edges, options);
  const edges = filtered.edges;
  const defaultItemId = resolveDefaultItemId(nodes, edges, options.selectedItemId);

  return {
    nodes,
    edges,
    legend: managedObjectGraphLegend,
    searchFocus: filtered.searchFocus,
    summary: summarizeStructureMap(allNodes, allEdges, nodes, edges, options),
    selectedDetail: getStructureMapItemDetail({ nodes, edges }, defaultItemId),
    defaultItemId
  };
}

export function getStructureMapItemDetail(
  view: Pick<StructureMapView, "edges" | "nodes">,
  itemId?: string
): StructureMapItemDetail | undefined {
  if (!itemId) {
    return undefined;
  }

  const node = view.nodes.find((item) => item.id === itemId);
  if (node) {
    return {
      kind: "node",
      id: node.id,
      title: node.label,
      subtitle: node.caption,
      body: node.body,
      badges: [nodeTypeLabel(node.type), toneLabel(node.tone)],
      evidenceIds: [],
      metricIds: [],
      editable: node.type !== "category"
    };
  }

  const edge = view.edges.find((item) => item.id === itemId);
  if (!edge) {
    return undefined;
  }

  const from = view.nodes.find((item) => item.id === edge.fromId)?.label ?? edge.fromId;
  const to = view.nodes.find((item) => item.id === edge.toId)?.label ?? edge.toId;

  return {
    kind: "edge",
    id: edge.id,
    title: `${from} -> ${to}`,
    subtitle: edgeTypeLabel(edge.edgeType),
    body: edge.description ?? edge.impact,
    badges: [
      edge.label,
      edge.readOnly ? "읽기 전용" : "관계 편집 가능",
      typeof edge.confidence === "number" ? `신뢰도 ${Math.round(edge.confidence * 100)}%` : undefined,
      edge.strength
    ].filter((item): item is string => Boolean(item)),
    evidenceIds: edge.evidenceIds,
    metricIds: edge.metricIds,
    editable: !edge.readOnly,
    readOnlyReason: edge.readOnlyReason
  };
}

function buildStructureMapNodes(data: CompanyData): StructureMapGraphNode[] {
  return [
    ...data.entities.map(entityNode),
    ...orderedEvents(data.events).map(eventNode),
    ...data.metricDefinitions.map((definition) => metricNode(definition, data.metricValues.find((value) => value.metricId === definition.id))),
    ...data.insights.map(insightNode)
  ];
}

function entityNode(entity: EntityInstance): StructureMapGraphNode {
  return {
    id: entity.id,
    label: entity.name,
    caption: displayTypeLabel(entity.kind),
    type: "managed_object",
    tone: entity.status.includes("주의") || entity.status.includes("필요") ? "warning" : "primary",
    body: entity.summary,
    editorDraft: {
      primary: entity.name,
      secondary: entity.status,
      body: entity.summary
    },
    position: { x: 0, y: 0 }
  };
}

function eventNode(event: EventRecord): StructureMapGraphNode {
  return {
    id: event.id,
    label: event.name,
    caption: displayTypeLabel(event.workflowType),
    type: "workflow",
    tone: event.workflowType === "지연" || event.workflowType === "증가" ? "warning" : "info",
    body: `소요 ${event.durationHours}시간`,
    editorDraft: {
      primary: event.name,
      secondary: event.workflowType,
      body: event.occurredAt
    },
    position: { x: 0, y: 0 }
  };
}

function metricNode(definition: MetricDefinition, value?: MetricValue): StructureMapGraphNode {
  return {
    id: definition.id,
    label: definition.name,
    caption: typeof value?.value === "number" ? `${value.value}${definition.unit}` : definition.unit,
    type: "metric",
    tone: value?.status === "critical" ? "danger" : value?.status === "warning" ? "warning" : "success",
    body: `계산식: ${definition.formula}`,
    editorDraft: {
      primary: definition.name,
      secondary: definition.unit,
      body: definition.formula
    },
    position: { x: 0, y: 0 }
  };
}

function insightNode(insight: AIInsight): StructureMapGraphNode {
  return {
    id: insight.id,
    label: insight.title,
    caption: insight.severity === "high" ? "고위험 인사이트" : "인사이트",
    type: "insight",
    tone: insight.severity === "high" ? "danger" : "warning",
    body: insight.reason,
    editorDraft: {
      primary: insight.title,
      secondary: insight.status,
      body: insight.reason
    },
    position: { x: 0, y: 0 }
  };
}

function buildStructureMapEdges(data: CompanyData, nodes: StructureMapGraphNode[]): StructureMapGraphEdge[] {
  const nodeIds = new Set(nodes.map((node) => node.id));
  const edges: StructureMapGraphEdge[] = [];

  for (const relation of data.relations) {
    if (!nodeIds.has(relation.fromId) || !nodeIds.has(relation.toId)) {
      continue;
    }

    const edgeType = relationEdgeType(relation);
    edges.push({
      id: `edge-${relation.id}`,
      fromId: relation.fromId,
      toId: relation.toId,
      label: relation.type,
      edgeType,
      kind: edgeType,
      source: "relation",
      readOnly: false,
      relationId: relation.id,
      description: relation.description,
      evidenceIds: relation.evidenceIds,
      impact: relation.impact,
      metricIds: relation.metricIds ?? [],
      confidence: relation.confidence,
      strength: relation.strength,
      relationKind: relation.relationKind
    });
  }

  for (const event of data.events) {
    if (!nodeIds.has(event.objectId) || !nodeIds.has(event.id)) {
      continue;
    }

    edges.push({
      id: `edge-workflow-${event.objectId}-${event.id}`,
      fromId: event.objectId,
      toId: event.id,
      label: "업무 대상",
      edgeType: "managed_object_workflow",
      kind: "managed_object_workflow",
      source: "event_object",
      readOnly: true,
      readOnlyReason: generatedEdgeReason,
      evidenceIds: event.evidenceIds,
      metricIds: []
    });
  }

  for (const binding of data.workflowMetricBindings) {
    if (!nodeIds.has(binding.eventId) || !nodeIds.has(binding.metricId)) {
      continue;
    }

    for (const objectId of binding.sourceManagedObjectIds) {
      if (!nodeIds.has(objectId)) {
        continue;
      }

      edges.push({
        id: `edge-workflow-source-${objectId}-${binding.eventId}-${binding.metricId}`,
        fromId: objectId,
        toId: binding.eventId,
        label: "업무 연결",
        edgeType: "managed_object_workflow",
        kind: "managed_object_workflow",
        source: "workflow_metric_binding",
        readOnly: true,
        readOnlyReason: generatedEdgeReason,
        evidenceIds: [],
        metricIds: [binding.metricId]
      });
    }

    edges.push({
      id: `edge-${binding.id}`,
      fromId: binding.eventId,
      toId: binding.metricId,
      label: "측정",
      edgeType: "workflow_metric",
      kind: "workflow_metric",
      source: "workflow_metric_binding",
      readOnly: true,
      readOnlyReason: generatedEdgeReason,
      evidenceIds: [],
      metricIds: [binding.metricId]
    });
  }

  for (let index = 0; index < workflowSequence.length - 1; index += 1) {
    const fromId = workflowSequence[index];
    const toId = workflowSequence[index + 1];
    if (!nodeIds.has(fromId) || !nodeIds.has(toId)) {
      continue;
    }

    edges.push({
      id: `edge-sequence-${fromId}-${toId}`,
      fromId,
      toId,
      label: "다음 흐름",
      edgeType: "workflow_sequence",
      kind: "workflow_sequence",
      source: "workflow_sequence",
      readOnly: true,
      readOnlyReason: generatedEdgeReason,
      evidenceIds: [],
      metricIds: []
    });
  }

  for (const insight of data.insights) {
    for (const metricId of insight.relatedMetricIds) {
      if (!nodeIds.has(metricId) || !nodeIds.has(insight.id)) {
        continue;
      }

      edges.push({
        id: `edge-metric-insight-${metricId}-${insight.id}`,
        fromId: metricId,
        toId: insight.id,
        label: "인사이트 근거",
        edgeType: "metric_insight",
        kind: "metric_insight",
        source: "metric_insight",
        readOnly: true,
        readOnlyReason: generatedEdgeReason,
        evidenceIds: insight.evidenceIds,
        metricIds: [metricId]
      });
    }
  }

  return uniqueEdges(edges);
}

function filterStructureMap({
  edges,
  nodes,
  options
}: {
  edges: StructureMapGraphEdge[];
  nodes: StructureMapGraphNode[];
  options: StructureMapViewOptions;
}) {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const selectedEdge = options.selectedItemId ? edges.find((edge) => edge.id === options.selectedItemId) : undefined;
  const selectedNode = options.selectedItemId ? nodeById.get(options.selectedItemId) : undefined;
  const searchQuery = normalizeSearch(options.searchQuery);
  const searchMatchIds = new Set(searchQuery ? nodes.filter((node) => searchableText(node).includes(searchQuery)).map((node) => node.id) : []);
  const nodeTypeSet = new Set(options.nodeTypes?.length ? options.nodeTypes : defaultNodeTypes);
  const edgeTypes = options.edgeTypes?.length ? options.edgeTypes : defaultEdgeTypes;
  const edgeTypeSet = new Set(edgeTypes);
  const hasNarrowedEdgeFilter = edgeTypes.length < defaultEdgeTypes.length;
  const hiddenNodeIds = new Set(options.hiddenNodeIds ?? []);
  const hiddenEdgeIds = new Set(options.hiddenEdgeIds ?? []);

  let visibleNodes = nodes.filter((node) => nodeTypeSet.has(node.type) && !hiddenNodeIds.has(node.id));
  let visibleNodeIds = new Set(visibleNodes.map((node) => node.id));
  let visibleEdges = edges.filter(
    (edge) =>
      !hiddenEdgeIds.has(edge.id) &&
      edgeTypeSet.has(edge.edgeType) &&
      visibleNodeIds.has(edge.fromId) &&
      visibleNodeIds.has(edge.toId)
  );

  if (selectedEdge && !hiddenEdgeIds.has(selectedEdge.id) && edgeTypeSet.has(selectedEdge.edgeType)) {
    const hasEndpoints = visibleNodeIds.has(selectedEdge.fromId) && visibleNodeIds.has(selectedEdge.toId);
    if (hasEndpoints && !visibleEdges.some((edge) => edge.id === selectedEdge.id)) {
      visibleEdges = [...visibleEdges, selectedEdge];
    }
  }

  const hasSearch = Boolean(searchQuery);
  const hasSelectedFocus = Boolean(selectedNode || selectedEdge);
  const depth = options.depth ?? defaultDepth;
  if (!hasSearch && !hasSelectedFocus && depth !== "all") {
    const rootIds = defaultDepthRootIds(visibleNodes, visibleEdges);
    const depthNodeIds = traverseDirectedNodeIds(visibleEdges, rootIds, depth);
    visibleNodes = visibleNodes.filter((node) => depthNodeIds.has(node.id));
    visibleNodeIds = new Set(visibleNodes.map((node) => node.id));
    visibleEdges = visibleEdges.filter((edge) => visibleNodeIds.has(edge.fromId) && visibleNodeIds.has(edge.toId));
  }

  const visibleSearchMatchIds = new Set([...searchMatchIds].filter((nodeId) => visibleNodeIds.has(nodeId)));
  const searchFocusNodeIds =
    searchQuery && visibleSearchMatchIds.size > 0 ? traverseNodeIds(visibleEdges, Array.from(visibleSearchMatchIds), depth) : new Set<string>();
  const searchFocusEdgeIds = new Set(
    searchFocusNodeIds.size > 0
      ? visibleEdges.filter((edge) => searchFocusNodeIds.has(edge.fromId) && searchFocusNodeIds.has(edge.toId)).map((edge) => edge.id)
      : []
  );

  const connectedNodeIds = new Set(visibleEdges.flatMap((edge) => [edge.fromId, edge.toId]));
  if (hasNarrowedEdgeFilter || selectedNode || selectedEdge) {
    const selectedContextNodeIds = new Set<string>([
      selectedNode?.id,
      selectedEdge?.fromId,
      selectedEdge?.toId
    ].filter((item): item is string => Boolean(item)));
    visibleNodes = visibleNodes.filter((node) => connectedNodeIds.has(node.id) || selectedContextNodeIds.has(node.id));
  }

  return {
    nodes: visibleNodes,
    edges: visibleEdges,
    searchFocus: {
      edgeIds: [...searchFocusEdgeIds],
      matchNodeIds: [...visibleSearchMatchIds],
      nodeIds: [...searchFocusNodeIds],
      query: searchQuery
    }
  };
}

function defaultDepthRootIds(nodes: StructureMapGraphNode[], edges: StructureMapGraphEdge[]): string[] {
  const focusEdge =
    edges.find((edge) => edge.source === "relation" && edge.strength === "strong") ??
    edges.find((edge) => edge.source === "relation") ??
    edges[0];
  if (focusEdge) {
    return [focusEdge.fromId];
  }

  const focusNode = nodes.find((node) => node.type === "managed_object") ?? nodes[0];
  return focusNode ? [focusNode.id] : [];
}

function traverseDirectedNodeIds(edges: StructureMapGraphEdge[], rootIds: string[], depth: Exclude<StructureMapDepth, "all">): Set<string> {
  const visited = new Set(rootIds);
  let frontier = new Set(rootIds);

  for (let level = 0; level < depth; level += 1) {
    const next = new Set<string>();
    for (const edge of edges) {
      if (frontier.has(edge.fromId) && !visited.has(edge.toId)) {
        next.add(edge.toId);
      }
    }
    next.forEach((id) => visited.add(id));
    frontier = next;
  }

  return visited;
}

function traverseNodeIds(edges: StructureMapGraphEdge[], rootIds: string[], depth: StructureMapDepth): Set<string> {
  const visited = new Set(rootIds);
  if (depth === "all") {
    let changed = true;
    while (changed) {
      changed = expandOneHop(edges, visited);
    }
    return visited;
  }

  for (let level = 0; level < depth; level += 1) {
    expandOneHop(edges, visited);
  }

  return visited;
}

function expandOneHop(edges: StructureMapGraphEdge[], visited: Set<string>): boolean {
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

function applyLayout(
  nodes: StructureMapGraphNode[],
  edges: StructureMapGraphEdge[],
  options: StructureMapViewOptions
): StructureMapGraphNode[] {
  const layoutMode = options.layoutMode ?? "semantic-lanes";
  const sorted = sortNodesForLayout(nodes, edges, layoutMode);
  const laneCounts = new Map<ManagedObjectGraphNodeType, number>();
  const savedPositions = options.savedPositions?.[layoutMode] ?? {};

  return sorted.map((node) => {
    const index = laneCounts.get(node.type) ?? 0;
    laneCounts.set(node.type, index + 1);
    return {
      ...node,
      position: savedPositions[node.id] ?? computedPosition(node, index, layoutMode)
    };
  });
}

function sortNodesForLayout(
  nodes: StructureMapGraphNode[],
  edges: StructureMapGraphEdge[],
  layoutMode: StructureMapLayoutMode
): StructureMapGraphNode[] {
  const degreeByNodeId = new Map<string, number>();
  for (const edge of edges) {
    degreeByNodeId.set(edge.fromId, (degreeByNodeId.get(edge.fromId) ?? 0) + 1);
    degreeByNodeId.set(edge.toId, (degreeByNodeId.get(edge.toId) ?? 0) + 1);
  }

  return [...nodes].sort((left, right) => {
    if (left.type !== right.type) {
      return nodeTypeOrder(left.type) - nodeTypeOrder(right.type);
    }

    if (layoutMode === "risk-first") {
      const riskDelta = toneRiskScore(right.tone) - toneRiskScore(left.tone);
      if (riskDelta !== 0) {
        return riskDelta;
      }
    }

    if (layoutMode === "clustered") {
      const degreeDelta = (degreeByNodeId.get(right.id) ?? 0) - (degreeByNodeId.get(left.id) ?? 0);
      if (degreeDelta !== 0) {
        return degreeDelta;
      }
    }

    return left.label.localeCompare(right.label, "ko");
  });
}

function computedPosition(node: StructureMapGraphNode, index: number, layoutMode: StructureMapLayoutMode): StructureMapPoint {
  const offsets: Record<ManagedObjectGraphNodeType, Array<{ x: number; y: number }>> = {
    category: [
      { x: -130, y: -82 },
      { x: 20, y: -124 },
      { x: 166, y: -62 }
    ],
    insight: [
      { x: -96, y: -88 },
      { x: 82, y: -24 },
      { x: -36, y: 102 },
      { x: 134, y: 82 }
    ],
    managed_object: [
      { x: -104, y: -196 },
      { x: 58, y: -160 },
      { x: -152, y: -78 },
      { x: 108, y: -34 },
      { x: -126, y: 58 },
      { x: 48, y: 118 },
      { x: -60, y: 196 },
      { x: 138, y: 166 }
    ],
    metric: [
      { x: -72, y: -128 },
      { x: 98, y: -72 },
      { x: -52, y: 82 },
      { x: 122, y: 116 },
      { x: 18, y: 8 }
    ],
    workflow: [
      { x: -104, y: -150 },
      { x: 88, y: -126 },
      { x: -34, y: -34 },
      { x: 124, y: 32 },
      { x: -100, y: 108 },
      { x: 64, y: 172 }
    ]
  };
  const centers: Record<ManagedObjectGraphNodeType, { x: number; y: number }> = {
    category: { x: 482, y: 88 },
    insight: { x: 800, y: 315 },
    managed_object: { x: 120, y: 310 },
    metric: { x: 590, y: 260 },
    workflow: { x: 370, y: 300 }
  };
  const modeShift: Record<StructureMapLayoutMode, { x: number; y: number }> = {
    clustered: { x: 0, y: 0 },
    "risk-first": { x: node.tone === "danger" || node.tone === "warning" ? -34 : 18, y: node.tone === "danger" || node.tone === "warning" ? -54 : 20 },
    "semantic-lanes": { x: 0, y: 0 }
  };
  const offset = offsets[node.type][index % offsets[node.type].length];
  const wrap = Math.floor(index / offsets[node.type].length);
  const center = centers[node.type];
  const shift = modeShift[layoutMode];

  return {
    x: center.x + offset.x + shift.x + wrap * 42,
    y: center.y + offset.y + shift.y + wrap * 46
  };
}

function summarizeStructureMap(
  allNodes: StructureMapGraphNode[],
  allEdges: StructureMapGraphEdge[],
  visibleNodes: StructureMapGraphNode[],
  visibleEdges: StructureMapGraphEdge[],
  options: StructureMapViewOptions
): StructureMapSummary {
  return {
    totalNodes: allNodes.length,
    totalEdges: allEdges.length,
    visibleNodes: visibleNodes.length,
    visibleEdges: visibleEdges.length,
    hiddenNodes: options.hiddenNodeIds?.length ?? 0,
    hiddenEdges: options.hiddenEdgeIds?.length ?? 0,
    relationEdges: visibleEdges.filter((edge) => edge.source === "relation").length,
    generatedEdges: visibleEdges.filter((edge) => edge.source !== "relation").length,
    byNodeType: countBy(defaultNodeTypesWithCategory(), visibleNodes, (node) => node.type),
    byEdgeType: countBy(defaultEdgeTypes, visibleEdges, (edge) => edge.edgeType)
  };
}

function countBy<T, K extends string>(keys: K[], items: T[], keyForItem: (item: T) => K): Record<K, number> {
  const counts = Object.fromEntries(keys.map((key) => [key, 0])) as Record<K, number>;
  for (const item of items) {
    counts[keyForItem(item)] += 1;
  }
  return counts;
}

function resolveDefaultItemId(nodes: StructureMapGraphNode[], edges: StructureMapGraphEdge[], selectedItemId?: string): string | undefined {
  if (selectedItemId && (nodes.some((node) => node.id === selectedItemId) || edges.some((edge) => edge.id === selectedItemId))) {
    return selectedItemId;
  }

  return edges.find((edge) => edge.source === "relation" && edge.strength === "strong")?.id ?? edges[0]?.id ?? nodes[0]?.id;
}

function relationEdgeType(relation: Relation): ManagedObjectGraphEdgeType {
  const fromEntity = isEntityId(relation.fromId);
  const toEntity = isEntityId(relation.toId);
  const fromEvent = isEventId(relation.fromId);
  const toEvent = isEventId(relation.toId);

  if (fromEntity && toEntity) {
    return "managed_object_structural";
  }

  if ((fromEntity && toEvent) || (fromEvent && toEntity)) {
    return "managed_object_workflow";
  }

  return "managed_object_structural";
}

function orderedEvents(events: EventRecord[]): EventRecord[] {
  return sortEventsByWorkflowSequence(events);
}

function uniqueEdges(edges: StructureMapGraphEdge[]): StructureMapGraphEdge[] {
  const seen = new Set<string>();
  return edges.filter((edge) => {
    const key = `${edge.id}:${edge.fromId}:${edge.toId}:${edge.edgeType}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function normalizeSearch(value = ""): string {
  return value.trim().toLocaleLowerCase("ko");
}

function searchableText(node: StructureMapGraphNode): string {
  return [node.label, node.caption, node.body].filter(Boolean).join(" ").toLocaleLowerCase("ko");
}

function edgeTypeLabel(type: ManagedObjectGraphEdgeType): string {
  return managedObjectGraphLegend.find((item) => item.edgeType === type)?.label ?? type;
}

function nodeTypeLabel(type: ManagedObjectGraphNodeType): string {
  const labels: Record<ManagedObjectGraphNodeType, string> = {
    category: "유형",
    insight: "인사이트",
    managed_object: "관리 대상",
    metric: "지표",
    workflow: "업무 흐름"
  };
  return labels[type];
}

function toneLabel(tone: StructureMapGraphNode["tone"]): string {
  const labels: Record<StructureMapGraphNode["tone"], string> = {
    danger: "위험",
    info: "정보",
    neutral: "중립",
    primary: "핵심",
    success: "정상",
    warning: "주의"
  };
  return labels[tone];
}

function nodeTypeOrder(type: ManagedObjectGraphNodeType): number {
  const order: Record<ManagedObjectGraphNodeType, number> = {
    category: 0,
    managed_object: 1,
    workflow: 2,
    metric: 3,
    insight: 4
  };
  return order[type];
}

function toneRiskScore(tone: StructureMapGraphNode["tone"]): number {
  const scores: Record<StructureMapGraphNode["tone"], number> = {
    danger: 5,
    warning: 4,
    primary: 3,
    info: 2,
    neutral: 1,
    success: 0
  };
  return scores[tone];
}

function defaultNodeTypesWithCategory(): ManagedObjectGraphNodeType[] {
  return ["category", ...defaultNodeTypes];
}

function isEntityId(id: string): boolean {
  return id.startsWith("entity-");
}

function isEventId(id: string): boolean {
  return id.startsWith("event-");
}
