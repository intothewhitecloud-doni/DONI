"use client";

import {
  Background,
  BaseEdge,
  Controls,
  MarkerType,
  Position,
  ReactFlow,
  getSmoothStepPath,
  useEdgesState,
  useNodesState,
  type Edge,
  type EdgeProps,
  type Node
} from "@xyflow/react";
import type { CSSProperties, ReactNode } from "react";
import { useEffect, useMemo } from "react";
import { Badge } from "../../components/ui/Badge";
import {
  getManagedObjectGraphItemDetail,
  type ManagedObjectDetail,
  type ManagedObjectGraphEdge,
  type ManagedObjectGraphNode
} from "../../lib/prototype/queries/managedObjectQueries";
import {
  buildManagedObjectGraphLayout,
  type ManagedObjectGraphEdgeRoute,
  type ManagedObjectGraphEdgeVisual,
  type ManagedObjectGraphLayout
} from "../../lib/prototype/queries/managedObjectGraphLayout";
import type { EvidenceReference, MetricDefinition } from "../../lib/domain/types";

type KnowledgeGraphProps = {
  detail: ManagedObjectDetail;
  evidence: EvidenceReference[];
  metrics: MetricDefinition[];
  selectedItemId?: string;
  onSelectItem: (itemId: string) => void;
};

type GraphNodeData = {
  label: ReactNode;
};

type GraphEdgeData = {
  borderRadius: number;
  route: ManagedObjectGraphEdgeRoute;
};

type FlowNode = Node<GraphNodeData, "default">;
type FlowEdge = Edge<GraphEdgeData, "knowledge">;

const nodeWidth = 172;
const fallbackEdgeRoute: ManagedObjectGraphEdgeRoute = { offset: 20, parallelOffset: 0, stepPosition: 0.5 };

const nodeLegend: Array<{
  type: ManagedObjectGraphNode["type"];
  label: string;
  description: string;
}> = [
  { type: "managed_object", label: "관리 대상", description: "영향관계 탐색의 중심 객체" },
  { type: "workflow", label: "업무흐름", description: "관리 대상과 연결된 업무 단계" },
  { type: "metric", label: "지표", description: "업무흐름을 측정하는 수치 기준" },
  { type: "insight", label: "인사이트", description: "지표 변화에서 생성된 운영 신호" }
];

export function KnowledgeGraph({ detail, evidence, metrics, onSelectItem, selectedItemId }: KnowledgeGraphProps) {
  const graph = useMemo(() => buildFlowModel(detail, selectedItemId), [detail, selectedItemId]);
  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNode>(graph.nodes);
  const [edges, setEdges] = useEdgesState<FlowEdge>(graph.edges);
  const edgeTypes = useMemo(() => ({ knowledge: KnowledgeEdge }), []);
  const selectedDetail = getManagedObjectGraphItemDetail(detail, selectedItemId);

  useEffect(() => {
    setNodes(graph.nodes);
    setEdges(graph.edges);
  }, [graph.edges, graph.nodes, setEdges, setNodes]);

  return (
    <div className="space-y-4">
      <div className="h-[560px] overflow-hidden rounded-md border border-slate-200 bg-white">
        <ReactFlow
          key={detail.defaultGraphItemId ?? "empty-graph"}
          nodes={nodes}
          edges={edges}
          defaultViewport={graph.layout.defaultViewport}
          minZoom={0.35}
          maxZoom={1.35}
          onNodesChange={onNodesChange}
          nodesDraggable
          nodesConnectable={false}
          edgesReconnectable={false}
          elementsSelectable
          onNodeClick={(event, node) => {
            event.stopPropagation();
            onSelectItem(node.id);
          }}
          onEdgeClick={(event, edge) => {
            event.stopPropagation();
            onSelectItem(edge.id);
          }}
          edgeTypes={edgeTypes}
          proOptions={{ hideAttribution: true }}
        >
          <Background color="#e2e8f0" gap={28} size={1} />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>

      <div className="grid gap-3 xl:grid-cols-[1fr_1.35fr]">
        <div className="rounded-md border border-slate-200 bg-white p-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-bold text-slate-500">엔터티 유형</p>
            <Badge tone="neutral">{nodeLegend.length}개</Badge>
          </div>
          <p className="mt-2 text-xs leading-5 text-slate-500">엔터티는 드래그로 잠시 옮겨 볼 수 있으며 위치는 저장되지 않습니다.</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
            {nodeLegend.map((item) => (
              <div key={item.type} className="flex gap-3 rounded-md border border-slate-100 bg-slate-50 p-3">
                <span
                  className="mt-1 h-3 w-3 shrink-0 rounded-full border"
                  style={{ backgroundColor: nodeFill(item.type), borderColor: nodeStroke(item.type) }}
                />
                <span>
                  <span className="block text-xs font-bold text-slate-900">{item.label}</span>
                  <span className="mt-1 block text-xs leading-5 text-slate-500">{item.description}</span>
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-md border border-slate-200 bg-white p-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-bold uppercase text-slate-500">연결 유형</p>
            <Badge tone="neutral">{detail.graphLegend.length}개</Badge>
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {detail.graphLegend.map((item) => (
              <button
                key={item.edgeType}
                className={`rounded-md border p-3 text-left transition ${
                  selectedDetail?.subtitle === item.label ? "border-blue-500 bg-blue-50" : "border-slate-100 bg-white hover:bg-slate-50"
                }`}
                onClick={() => {
                  const edge = detail.graphEdges.find((candidate) => candidate.edgeType === item.edgeType);
                  if (edge) {
                    onSelectItem(edge.id);
                  }
                }}
              >
                <span className="flex items-center gap-2">
                  <span className="inline-block h-1.5 w-8 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-xs font-bold text-slate-900">{item.label}</span>
                </span>
                <span className="mt-1 block text-xs leading-5 text-slate-500">{item.description}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <GraphDetailPanel detail={selectedDetail} evidence={evidence} metrics={metrics} />
    </div>
  );
}

function GraphDetailPanel({
  detail,
  evidence,
  metrics
}: {
  detail?: ReturnType<typeof getManagedObjectGraphItemDetail>;
  evidence: EvidenceReference[];
  metrics: MetricDefinition[];
}) {
  if (!detail) {
    return (
      <div className="rounded-md border border-slate-200 bg-white p-4">
        <p className="text-sm text-slate-600">그래프 엔터티나 연결을 선택하면 상세 정보가 표시됩니다.</p>
      </div>
    );
  }

  const evidenceLabels = evidence.filter((item) => detail.evidenceIds.includes(item.id)).map((item) => item.label);
  const metricLabels = metrics.filter((metric) => detail.metricIds.includes(metric.id)).map((metric) => metric.name);

  return (
    <div className="rounded-md border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={detail.kind === "edge" ? "info" : "neutral"}>{detail.kind === "edge" ? "연결" : "엔터티"}</Badge>
        <Badge tone="neutral">{detail.subtitle}</Badge>
        {detail.badges.map((badge) => (
          <Badge key={badge} tone="info">{badge}</Badge>
        ))}
      </div>
      <h3 className="mt-3 text-lg font-bold text-slate-950">{detail.title}</h3>
      {detail.body && <p className="mt-2 text-sm leading-6 text-slate-600">{detail.body}</p>}
      {detail.kind === "edge" && (
        <p className="mt-3 text-xs leading-5 text-slate-500">
          근거: {evidenceLabels.join(", ") || "없음"} · 지표: {metricLabels.join(", ") || "없음"}
        </p>
      )}
    </div>
  );
}

function buildFlowModel(detail: ManagedObjectDetail, selectedItemId?: string): { edges: FlowEdge[]; layout: ManagedObjectGraphLayout; nodes: FlowNode[] } {
  const layout = buildManagedObjectGraphLayout(detail);
  const relatedIds = selectedItemId ? selectedRelatedIds(detail, selectedItemId) : new Set<string>();
  const hasSelection = Boolean(selectedItemId);

  const nodes: FlowNode[] = detail.graphNodes.map((node) => {
    const position = layout.positionsByNodeId[node.id] ?? { x: 0, y: 0 };
    const selected = selectedItemId === node.id;
    const related = relatedIds.has(node.id);

    return {
      id: node.id,
      type: "default",
      position,
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      selected,
      data: {
        label: <GraphNodeLabel node={node} />
      },
      style: nodeStyle(node, selected, related, hasSelection)
    };
  });

  const edges: FlowEdge[] = detail.graphEdges.map((edge) => {
    const selected = selectedItemId === edge.id;
    const related = relatedIds.has(edge.id);
    const route = layout.edgeRouteByEdgeId[edge.id] ?? fallbackEdgeRoute;
    const visual = edgeVisualForState(layout.edgePriorityByEdgeId[edge.id], selected, related, hasSelection);

    return {
      id: edge.id,
      source: edge.fromId,
      target: edge.toId,
      type: "knowledge",
      data: {
        borderRadius: visual.priority === "primaryInfluence" ? 18 : 10,
        route
      },
      selected,
      label: visual.labelVisible || selected ? edge.label : undefined,
      labelShowBg: true,
      labelBgBorderRadius: 6,
      labelBgPadding: [6, 3],
      labelBgStyle: { fill: "#ffffff", fillOpacity: 0.92 },
      labelStyle: {
        fill: visual.color,
        fontSize: 11,
        fontWeight: 700
      },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: visual.color,
        width: visual.markerSize,
        height: visual.markerSize
      },
      interactionWidth: visual.priority === "primaryInfluence" ? 18 : 14,
      style: {
        stroke: visual.color,
        strokeWidth: visual.strokeWidth,
        opacity: visual.opacity
      }
    };
  });

  return { edges, layout, nodes };
}

function KnowledgeEdge({
  data,
  id,
  interactionWidth,
  label,
  labelBgBorderRadius,
  labelBgPadding,
  labelBgStyle,
  labelShowBg,
  labelStyle,
  markerEnd,
  markerStart,
  sourcePosition,
  sourceX,
  sourceY,
  style,
  targetPosition,
  targetX,
  targetY
}: EdgeProps<FlowEdge>) {
  const route = data?.route ?? fallbackEdgeRoute;
  const [path, labelX, labelY] = getSmoothStepPath({
    borderRadius: data?.borderRadius ?? 10,
    offset: route.offset,
    sourcePosition,
    sourceX,
    sourceY: sourceY + route.parallelOffset,
    stepPosition: route.stepPosition,
    targetPosition,
    targetX,
    targetY: targetY + route.parallelOffset
  });

  return (
    <BaseEdge
      id={id}
      interactionWidth={interactionWidth}
      label={label}
      labelBgBorderRadius={labelBgBorderRadius}
      labelBgPadding={labelBgPadding}
      labelBgStyle={labelBgStyle}
      labelShowBg={labelShowBg}
      labelStyle={labelStyle}
      labelX={labelX}
      labelY={labelY}
      markerEnd={markerEnd}
      markerStart={markerStart}
      path={path}
      style={style}
    />
  );
}

function GraphNodeLabel({ node }: { node: ManagedObjectGraphNode }) {
  return (
    <div className="min-w-0 text-left">
      <span className="mb-1 inline-flex rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-bold text-slate-500">
        {nodeTypeLabel(node.type)}
      </span>
      <span className="block truncate text-[13px] font-bold leading-5 text-slate-950">{node.label}</span>
      <span className="block truncate text-[11px] font-semibold leading-4 text-slate-500">{node.caption}</span>
    </div>
  );
}

function selectedRelatedIds(detail: ManagedObjectDetail, selectedItemId: string): Set<string> {
  const related = new Set<string>([selectedItemId]);
  const selectedEdge = detail.graphEdges.find((edge) => edge.id === selectedItemId);

  if (selectedEdge) {
    related.add(selectedEdge.fromId);
    related.add(selectedEdge.toId);
    return related;
  }

  const selectedNode = detail.graphNodes.find((node) => node.id === selectedItemId);
  if (!selectedNode) {
    return related;
  }

  for (const edge of detail.graphEdges) {
    if (edge.fromId === selectedNode.id || edge.toId === selectedNode.id) {
      related.add(edge.id);
      related.add(edge.fromId);
      related.add(edge.toId);
    }
  }

  return related;
}

function edgeVisualForState(
  base: ManagedObjectGraphEdgeVisual,
  selected: boolean,
  related: boolean,
  hasSelection: boolean
): ManagedObjectGraphEdgeVisual {
  if (selected) {
    return {
      ...base,
      labelVisible: true,
      markerSize: Math.max(base.markerSize, 11),
      opacity: 1,
      strokeWidth: Math.max(base.strokeWidth + 0.8, 2.8)
    };
  }

  return {
    ...base,
    opacity: hasSelection && !related && base.priority !== "primaryInfluence" ? Math.min(base.opacity, 0.26) : base.opacity
  };
}

function nodeStyle(node: ManagedObjectGraphNode, selected: boolean, related: boolean, hasSelection: boolean): CSSProperties {
  const dimmed = hasSelection && !selected && !related;
  const managedObject = node.type === "managed_object";

  return {
    width: nodeWidth,
    minHeight: managedObject ? 76 : 68,
    borderColor: selected ? "#2563eb" : nodeStroke(node.type),
    borderRadius: 8,
    borderWidth: selected ? 2 : managedObject ? 1.5 : 1,
    background: nodeFill(node.type),
    boxShadow: selected
      ? "0 14px 34px rgba(37, 99, 235, 0.2)"
      : managedObject
        ? "0 10px 24px rgba(15, 23, 42, 0.08)"
        : "0 6px 16px rgba(15, 23, 42, 0.05)",
    opacity: dimmed ? managedObject ? 0.72 : 0.42 : managedObject ? 1 : 0.86,
    padding: 12
  };
}

function nodeFill(type: ManagedObjectGraphNode["type"]): string {
  const fills: Record<ManagedObjectGraphNode["type"], string> = {
    category: "#eef2ff",
    insight: "#fff1f2",
    managed_object: "#eff6ff",
    metric: "#fffbeb",
    workflow: "#f0fdfa"
  };

  return fills[type];
}

function nodeStroke(type: ManagedObjectGraphNode["type"]): string {
  const strokes: Record<ManagedObjectGraphNode["type"], string> = {
    category: "#6366f1",
    insight: "#fb7185",
    managed_object: "#2563eb",
    metric: "#f59e0b",
    workflow: "#0f766e"
  };

  return strokes[type];
}

function nodeTypeLabel(type: ManagedObjectGraphNode["type"]): string {
  const labels: Record<ManagedObjectGraphNode["type"], string> = {
    category: "범위",
    insight: "인사이트",
    managed_object: "관리 대상",
    metric: "지표",
    workflow: "업무흐름"
  };

  return labels[type];
}
