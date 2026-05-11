import type { EntityInstance, EventRecord, MetricDefinition, MetricValue, PrototypeState, Relation } from "../../domain/types";
import { currentWorkspaceData } from "../selectors";

type WorkspaceData = ReturnType<typeof currentWorkspaceData>;

export type ManagedObjectCategoryId = "category-customer" | "category-supplier" | "category-product";

export type ManagedObjectCategory = {
  id: ManagedObjectCategoryId;
  kind: string;
  label: string;
  description: string;
  summary: string;
  instanceCount: number;
  statusLabel: string;
  tone: "info" | "warning" | "success";
};

export type ManagedObjectGraphNodeType = "category" | "managed_object" | "workflow" | "metric" | "insight";
export type ManagedObjectGraphEdgeType =
  | "managed_object_structural"
  | "managed_object_workflow"
  | "workflow_sequence"
  | "workflow_metric"
  | "metric_insight";

export type ManagedObjectGraphNode = {
  id: string;
  label: string;
  caption: string;
  type: ManagedObjectGraphNodeType;
  tone: "primary" | "warning" | "info" | "neutral" | "success" | "danger";
};

export type ManagedObjectGraphEdge = {
  id: string;
  fromId: string;
  toId: string;
  label: string;
  edgeType: ManagedObjectGraphEdgeType;
  kind: ManagedObjectGraphEdgeType;
  description?: string;
  evidenceIds?: string[];
  impact?: string;
  metricIds?: string[];
  confidence?: number;
  strength?: "weak" | "medium" | "strong";
  relationKind?: string;
};

export type ManagedObjectGraphLegendItem = {
  edgeType: ManagedObjectGraphEdgeType;
  label: string;
  description: string;
  color: string;
};

export type ManagedObjectGraphItemDetail = {
  kind: "node" | "edge";
  title: string;
  subtitle: string;
  body?: string;
  badges: string[];
  evidenceIds: string[];
  metricIds: string[];
};

export type ManagedObjectDetail = {
  category?: ManagedObjectCategory;
  instances: EntityInstance[];
  events: PrototypeState["events"];
  relations: PrototypeState["relations"];
  metrics: Array<{
    definition: MetricDefinition;
    value?: MetricValue;
  }>;
  insights: PrototypeState["insights"];
  decisions: PrototypeState["decisions"];
  graphNodes: ManagedObjectGraphNode[];
  graphEdges: ManagedObjectGraphEdge[];
  graphLegend: ManagedObjectGraphLegendItem[];
  defaultGraphItemId?: string;
};

const categoryDefinitions: Array<Omit<ManagedObjectCategory, "instanceCount" | "statusLabel" | "tone">> = [
  {
    id: "category-customer",
    kind: "고객군",
    label: "고객군",
    description: "고객군별 클레임, 보상 요청, 이탈 위험을 추적하는 관리 기준입니다.",
    summary: "고객 영향과 대응 우선순위를 판단하는 상위 관리 대상"
  },
  {
    id: "category-supplier",
    kind: "공급사",
    label: "공급사",
    description: "납품준수율, 출고 대기, 공급 집중도를 추적하는 관리 기준입니다.",
    summary: "공급 지연과 비용 압박의 원천을 확인하는 상위 관리 대상"
  },
  {
    id: "category-product",
    kind: "상품군",
    label: "상품군",
    description: "상품별 마진, 주문 지연, 클레임 발생을 묶어 보는 관리 기준입니다.",
    summary: "수익성과 운영 리스크를 함께 판단하는 상위 관리 대상"
  }
];

export const managedObjectGraphLegend: ManagedObjectGraphLegendItem[] = [
  {
    edgeType: "managed_object_structural",
    label: "관리대상 간 구조",
    description: "공급사와 상품군처럼 업무 객체끼리 직접 맺는 구조 관계",
    color: "#2563eb"
  },
  {
    edgeType: "managed_object_workflow",
    label: "관리대상-업무흐름",
    description: "상품군의 주문 접수, 고객군의 클레임 접수처럼 객체와 프로세스를 연결",
    color: "#7c3aed"
  },
  {
    edgeType: "workflow_sequence",
    label: "업무흐름 순서",
    description: "주문 접수에서 출고, 배송, 클레임, 보상으로 이어지는 흐름",
    color: "#0f766e"
  },
  {
    edgeType: "workflow_metric",
    label: "업무흐름-지표",
    description: "업무흐름이 어떤 지표로 측정되는지 보여주는 연결",
    color: "#d97706"
  },
  {
    edgeType: "metric_insight",
    label: "지표-인사이트",
    description: "지표 악화가 어떤 의사결정 인사이트를 만든 것인지 보여주는 연결",
    color: "#dc2626"
  }
];

const workflowSequence = ["event-order", "event-outbound", "event-delivery", "event-claim", "event-compensation"];

export function getManagedObjectView(state: PrototypeState, focusId?: string) {
  const data = currentWorkspaceData(state);
  const categories = buildManagedObjectCategories(data);
  const activeCategoryId = resolveActiveCategoryId(data.entities, categories, focusId);
  const detail = buildManagedObjectDetail(state, activeCategoryId);

  return {
    categories,
    activeCategoryId,
    detail
  };
}

export function getManagedObjectGraphItemDetail(detail: ManagedObjectDetail, itemId?: string): ManagedObjectGraphItemDetail | undefined {
  const resolvedId = itemId ?? detail.defaultGraphItemId;
  if (!resolvedId) {
    return undefined;
  }

  const node = detail.graphNodes.find((item) => item.id === resolvedId);
  if (node) {
    return {
      kind: "node",
      title: node.label,
      subtitle: node.caption,
      body: nodeBody(detail, node),
      badges: [nodeTypeLabel(node.type)],
      evidenceIds: [],
      metricIds: []
    };
  }

  const edge = detail.graphEdges.find((item) => item.id === resolvedId);
  if (!edge) {
    return undefined;
  }

  const from = detail.graphNodes.find((item) => item.id === edge.fromId)?.label ?? knownNodeLabel(edge.fromId);
  const to = detail.graphNodes.find((item) => item.id === edge.toId)?.label ?? knownNodeLabel(edge.toId);

  return {
    kind: "edge",
    title: `${from} -> ${to}`,
    subtitle: edgeTypeLabel(edge.edgeType),
    body: edge.description ?? edge.impact,
    badges: [
      edge.label,
      typeof edge.confidence === "number" ? `신뢰도 ${Math.round(edge.confidence * 100)}%` : undefined,
      edge.strength
    ].filter((item): item is string => Boolean(item)),
    evidenceIds: edge.evidenceIds ?? [],
    metricIds: edge.metricIds ?? []
  };
}

function buildManagedObjectCategories(data: WorkspaceData): ManagedObjectCategory[] {
  return categoryDefinitions
    .map((definition): ManagedObjectCategory | undefined => {
      const instances = data.entities.filter((entity) => entity.kind === definition.kind);
      if (instances.length === 0) {
        return undefined;
      }

      const hasWarning = instances.some((instance) => instance.status.includes("주의") || instance.status.includes("필요"));
      return {
        ...definition,
        instanceCount: instances.length,
        statusLabel: hasWarning ? "점검 필요" : "정상",
        tone: hasWarning ? "warning" : "success"
      };
    })
    .filter((category): category is ManagedObjectCategory => Boolean(category));
}

function resolveActiveCategoryId(
  entities: EntityInstance[],
  categories: ManagedObjectCategory[],
  focusId?: string
): ManagedObjectCategoryId | "" {
  if (focusId && categories.some((category) => category.id === focusId)) {
    return focusId as ManagedObjectCategoryId;
  }

  const focusedEntity = focusId ? entities.find((entity) => entity.id === focusId) : undefined;
  const focusedCategory = focusedEntity ? categoryDefinitions.find((category) => category.kind === focusedEntity.kind) : undefined;
  if (focusedCategory && categories.some((category) => category.id === focusedCategory.id)) {
    return focusedCategory.id;
  }

  return categories[0]?.id ?? "";
}

function buildManagedObjectDetail(state: PrototypeState, categoryId?: string): ManagedObjectDetail {
  const data = currentWorkspaceData(state);
  const categories = buildManagedObjectCategories(data);
  const category = categories.find((item) => item.id === categoryId);

  if (!category) {
    return emptyManagedObjectDetail();
  }

  const instances = data.entities.filter((entity) => entity.kind === category.kind);
  const instanceIds = new Set(instances.map((entity) => entity.id));
  const insights = data.insights.filter(
    (insight) =>
      insight.relatedObjectIds.some((objectId) => instanceIds.has(objectId)) ||
      insight.relatedMetricIds.some((metricId) => instances.some((entity) => entity.metricIds.includes(metricId)))
  );
  const workflowEventIds = collectWorkflowEventIds(data, instances, insights);
  const relationIdsFromInsights = new Set(insights.flatMap((insight) => insight.relatedRelationIds));
  const relations = data.relations.filter(
    (relation) =>
      instanceIds.has(relation.fromId) ||
      instanceIds.has(relation.toId) ||
      workflowEventIds.has(relation.fromId) ||
      workflowEventIds.has(relation.toId) ||
      instances.some((entity) => entity.relationIds.includes(relation.id)) ||
      relationIdsFromInsights.has(relation.id)
  );
  const events = orderedEvents(data.events.filter((event) => workflowEventIds.has(event.id)));
  const metricIds = collectMetricIds(data, instances, events, insights, relations);
  const metrics = data.metricDefinitions
    .filter((definition) => metricIds.has(definition.id))
    .map((definition) => ({
      definition,
      value: data.metricValues.find((metricValue) => metricValue.metricId === definition.id)
    }));
  const decisions = data.decisions.filter((decision) => instances.some((entity) => entity.decisionIds.includes(decision.id)));
  const graphModel = buildGraphModel({
    category,
    data,
    events,
    insights,
    instances,
    metrics,
    relations
  });

  return {
    category,
    instances,
    events,
    relations,
    metrics,
    insights,
    decisions,
    graphNodes: graphModel.nodes,
    graphEdges: graphModel.edges,
    graphLegend: managedObjectGraphLegend,
    defaultGraphItemId: graphModel.edges[0]?.id ?? graphModel.nodes[0]?.id
  };
}

function emptyManagedObjectDetail(): ManagedObjectDetail {
  return {
    category: undefined,
    instances: [],
    events: [],
    relations: [],
    metrics: [],
    insights: [],
    decisions: [],
    graphNodes: [],
    graphEdges: [],
    graphLegend: managedObjectGraphLegend,
    defaultGraphItemId: undefined
  };
}

function collectWorkflowEventIds(
  data: WorkspaceData,
  instances: EntityInstance[],
  insights: PrototypeState["insights"]
): Set<string> {
  const instanceIds = new Set(instances.map((entity) => entity.id));
  const eventIds = new Set<string>();

  for (const entity of instances) {
    entity.eventIds.forEach((eventId) => eventIds.add(eventId));
  }

  for (const event of data.events) {
    if (instanceIds.has(event.objectId)) {
      eventIds.add(event.id);
    }
  }

  for (const binding of data.workflowMetricBindings) {
    if (binding.sourceManagedObjectIds.some((objectId) => instanceIds.has(objectId))) {
      eventIds.add(binding.eventId);
    }
  }

  for (const insight of insights) {
    insight.relatedEventIds.forEach((eventId) => eventIds.add(eventId));
  }

  return eventIds;
}

function collectMetricIds(
  data: WorkspaceData,
  instances: EntityInstance[],
  events: EventRecord[],
  insights: PrototypeState["insights"],
  relations: Relation[]
): Set<string> {
  const instanceIds = new Set(instances.map((entity) => entity.id));
  const eventIds = new Set(events.map((event) => event.id));
  const metricIds = new Set<string>();

  for (const entity of instances) {
    entity.metricIds.forEach((metricId) => metricIds.add(metricId));
  }

  for (const metric of data.metricDefinitions) {
    if (metric.relatedObjectIds.some((objectId) => instanceIds.has(objectId))) {
      metricIds.add(metric.id);
    }
  }

  for (const binding of data.workflowMetricBindings) {
    if (eventIds.has(binding.eventId)) {
      metricIds.add(binding.metricId);
    }
  }

  for (const insight of insights) {
    insight.relatedMetricIds.forEach((metricId) => metricIds.add(metricId));
  }

  for (const relation of relations) {
    relation.metricIds?.forEach((metricId) => metricIds.add(metricId));
  }

  return metricIds;
}

function buildGraphModel({
  category,
  data,
  events,
  insights,
  instances,
  metrics,
  relations
}: {
  category: ManagedObjectCategory;
  data: WorkspaceData;
  events: EventRecord[];
  insights: PrototypeState["insights"];
  instances: EntityInstance[];
  metrics: Array<{ definition: MetricDefinition; value?: MetricValue }>;
  relations: Relation[];
}): { nodes: ManagedObjectGraphNode[]; edges: ManagedObjectGraphEdge[] } {
  const instanceIds = new Set(instances.map((entity) => entity.id));
  const eventIds = new Set(events.map((event) => event.id));
  const metricIds = new Set(metrics.map((metric) => metric.definition.id));
  const insightIds = new Set(insights.map((insight) => insight.id));
  const relatedEntityIds = new Set<string>(instanceIds);

  for (const relation of relations) {
    if (isEntityId(relation.fromId)) {
      relatedEntityIds.add(relation.fromId);
    }
    if (isEntityId(relation.toId)) {
      relatedEntityIds.add(relation.toId);
    }
  }

  for (const event of events) {
    if (isEntityId(event.objectId)) {
      relatedEntityIds.add(event.objectId);
    }
  }

  for (const binding of data.workflowMetricBindings) {
    if (eventIds.has(binding.eventId) && metricIds.has(binding.metricId)) {
      binding.sourceManagedObjectIds.forEach((objectId) => relatedEntityIds.add(objectId));
    }
  }

  for (const metric of metrics) {
    metric.definition.relatedObjectIds.forEach((objectId) => relatedEntityIds.add(objectId));
  }

  const entityNodes = Array.from(relatedEntityIds).map((entityId) => {
    const entity = data.entities.find((item) => item.id === entityId);
    return {
      id: entityId,
      label: entity?.name ?? knownNodeLabel(entityId),
      caption: entity?.kind ?? knownObjectKind(entityId),
      type: "managed_object",
      tone: instanceIds.has(entityId) ? "primary" : "neutral"
    } satisfies ManagedObjectGraphNode;
  });
  const eventNodes = events.map(
    (event) =>
      ({
        id: event.id,
        label: event.name,
        caption: event.status,
        type: "workflow",
        tone: event.status === "지연" || event.status === "증가" ? "warning" : "info"
      }) satisfies ManagedObjectGraphNode
  );
  const metricNodes = metrics.map(
    (metric) =>
      ({
        id: metric.definition.id,
        label: metric.definition.name,
        caption: `${metric.value?.value ?? "-"}${metric.definition.unit}`,
        type: "metric",
        tone: metric.value?.status === "critical" ? "danger" : metric.value?.status === "warning" ? "warning" : "success"
      }) satisfies ManagedObjectGraphNode
  );
  const insightNodes = insights.map(
    (insight) =>
      ({
        id: insight.id,
        label: insight.title,
        caption: insight.severity === "high" ? "고위험 인사이트" : "인사이트",
        type: "insight",
        tone: insight.severity === "high" ? "danger" : "warning"
      }) satisfies ManagedObjectGraphNode
  );
  const nodes = uniqueNodes([
    {
      id: category.id,
      label: category.label,
      caption: "관리 대상 카테고리",
      type: "category",
      tone: "primary"
    },
    ...entityNodes,
    ...eventNodes,
    ...metricNodes,
    ...insightNodes
  ]);

  const nodeIds = new Set(nodes.map((node) => node.id));
  const edges: ManagedObjectGraphEdge[] = [];

  for (const instance of instances) {
    edges.push({
      id: `edge-${category.id}-${instance.id}`,
      fromId: category.id,
      toId: instance.id,
      label: "포함",
      edgeType: "managed_object_structural",
      kind: "managed_object_structural"
    });
  }

  for (const relation of relations) {
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
      description: relation.description,
      evidenceIds: relation.evidenceIds,
      impact: relation.impact,
      metricIds: relation.metricIds,
      confidence: relation.confidence,
      strength: relation.strength,
      relationKind: relation.relationKind
    });
  }

  for (const event of events) {
    if (nodeIds.has(event.objectId) && nodeIds.has(event.id)) {
      edges.push({
        id: `edge-workflow-${event.objectId}-${event.id}`,
        fromId: event.objectId,
        toId: event.id,
        label: "업무 대상",
        edgeType: "managed_object_workflow",
        kind: "managed_object_workflow",
        evidenceIds: event.evidenceIds
      });
    }
  }

  for (const binding of data.workflowMetricBindings) {
    if (!eventIds.has(binding.eventId) || !metricIds.has(binding.metricId)) {
      continue;
    }

    for (const objectId of binding.sourceManagedObjectIds) {
      if (!nodeIds.has(objectId) || !nodeIds.has(binding.eventId)) {
        continue;
      }

      edges.push({
        id: `edge-workflow-source-${objectId}-${binding.eventId}`,
        fromId: objectId,
        toId: binding.eventId,
        label: "업무 연결",
        edgeType: "managed_object_workflow",
        kind: "managed_object_workflow",
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
      metricIds: [binding.metricId]
    });
  }

  for (let index = 0; index < workflowSequence.length - 1; index += 1) {
    const fromId = workflowSequence[index];
    const toId = workflowSequence[index + 1];
    if (nodeIds.has(fromId) && nodeIds.has(toId)) {
      edges.push({
        id: `edge-sequence-${fromId}-${toId}`,
        fromId,
        toId,
        label: "다음 흐름",
        edgeType: "workflow_sequence",
        kind: "workflow_sequence"
      });
    }
  }

  for (const insight of insights) {
    if (!insightIds.has(insight.id)) {
      continue;
    }

    for (const metricId of insight.relatedMetricIds) {
      if (nodeIds.has(metricId)) {
        edges.push({
          id: `edge-metric-insight-${metricId}-${insight.id}`,
          fromId: metricId,
          toId: insight.id,
          label: "인사이트 근거",
          edgeType: "metric_insight",
          kind: "metric_insight",
          metricIds: [metricId],
          evidenceIds: insight.evidenceIds
        });
      }
    }
  }

  return {
    nodes,
    edges: uniqueEdges(edges).filter((edge) => nodeIds.has(edge.fromId) && nodeIds.has(edge.toId))
  };
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
  const order = new Map(workflowSequence.map((eventId, index) => [eventId, index]));
  return [...events].sort((left, right) => (order.get(left.id) ?? 99) - (order.get(right.id) ?? 99));
}

function uniqueNodes(nodes: ManagedObjectGraphNode[]): ManagedObjectGraphNode[] {
  const seen = new Set<string>();
  return nodes.filter((node) => {
    if (seen.has(node.id)) {
      return false;
    }

    seen.add(node.id);
    return true;
  });
}

function uniqueEdges(edges: ManagedObjectGraphEdge[]): ManagedObjectGraphEdge[] {
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

function nodeBody(detail: ManagedObjectDetail, node: ManagedObjectGraphNode): string | undefined {
  if (node.type === "category") {
    return detail.category?.description;
  }

  const instance = detail.instances.find((entity) => entity.id === node.id);
  if (instance) {
    return instance.summary;
  }

  const event = detail.events.find((item) => item.id === node.id);
  if (event) {
    return `소요 ${event.durationHours}시간`;
  }

  const metric = detail.metrics.find((item) => item.definition.id === node.id);
  if (metric) {
    return `계산식: ${metric.definition.formula}`;
  }

  const insight = detail.insights.find((item) => item.id === node.id);
  return insight?.reason;
}

function nodeTypeLabel(type: ManagedObjectGraphNodeType): string {
  const labels: Record<ManagedObjectGraphNodeType, string> = {
    category: "카테고리",
    managed_object: "관리 대상",
    workflow: "업무 흐름",
    metric: "지표",
    insight: "인사이트"
  };

  return labels[type];
}

function edgeTypeLabel(type: ManagedObjectGraphEdgeType): string {
  return managedObjectGraphLegend.find((item) => item.edgeType === type)?.label ?? type;
}

function isEntityId(id: string): boolean {
  return id.startsWith("entity-");
}

function isEventId(id: string): boolean {
  return id.startsWith("event-");
}

function knownObjectKind(objectId: string): string {
  const labels: Record<string, string> = {
    "entity-customer-core": "고객군",
    "entity-low-margin": "상품군",
    "entity-supplier-a": "공급사"
  };

  return labels[objectId] ?? "연결 대상";
}

function knownNodeLabel(nodeId: string): string {
  const labels: Record<string, string> = {
    "entity-customer-core": "핵심 고객군",
    "entity-low-margin": "P-42 산업용 센서 패키지",
    "entity-supplier-a": "공급업체 A사",
    "event-claim": "클레임 접수",
    "event-compensation": "보상 처리",
    "event-delivery": "배송 상태 확인",
    "event-order": "주문 접수",
    "event-outbound": "출고 처리"
  };

  return labels[nodeId] ?? "선택되지 않은 연결 대상";
}
