"use client";

import {
  Background,
  BaseEdge,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
  getSmoothStepPath,
  useEdgesState,
  useNodesState,
  type EdgeProps,
  type NodeProps,
  type ReactFlowInstance
} from "@xyflow/react";
import { useEffect, useMemo, useState } from "react";
import { Badge, type BadgeTone } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { SectionTitle } from "../../components/ui/Card";
import type { StructureMapDepth, StructureMapEdgeType, StructureMapNodePatch, StructureMapNodeType, StructureMapRelationPatch } from "../../lib/domain/types";
import { defaultStructureMapEdgeTypes, defaultStructureMapNodeTypes } from "../../lib/domain/types";
import {
  getStructureMapView,
  type StructureMapGraphEdge,
  type StructureMapGraphNode,
  type StructureMapItemDetail,
  type StructureMapLayoutMode,
  type StructureMapSearchFocus
} from "../../lib/prototype/queries/structureMapQueries";
import {
  buildStructureMapFlowModel,
  structureMapEdgeMeta,
  structureMapNodeMeta,
  toStructureMapDomainPosition,
  type StructureMapFlowEdge,
  type StructureMapFlowModel,
  type StructureMapFlowNode
} from "../../lib/prototype/queries/structureMapFlowAdapter";
import {
  buildStructureMapFocusSemantics,
  getStructureMapRelatedIds,
} from "../../lib/prototype/queries/structureMapGraphSemantics";
import {
  buildStructureMapInspectorContext,
  type StructureMapInspectorContext
} from "../../lib/prototype/queries/structureMapInspectorContext";
import { usePrototype } from "../../lib/prototype/PrototypeProvider";
import { currentCompanyData } from "../../lib/prototype/selectors";

type RelationDraft = {
  fromId: string;
  toId: string;
  type: string;
  status: string;
  description: string;
};

const nodeLabels: Record<StructureMapNodeType, string> = {
  category: "유형",
  insight: "인사이트",
  managed_object: "관리 대상",
  metric: "지표",
  workflow: "업무 흐름"
};

const edgeLabels: Record<StructureMapEdgeType, string> = {
  managed_object_structural: "구조 관계",
  managed_object_workflow: "업무 연결",
  metric_insight: "지표-인사이트",
  workflow_metric: "업무-지표",
  workflow_sequence: "업무 순서"
};

const edgeDescriptions: Record<StructureMapEdgeType, string> = {
  managed_object_structural: "관리 대상 사이의 공급, 고객, 소유 관계",
  managed_object_workflow: "관리 대상이 참여하거나 영향을 주는 업무 흐름",
  metric_insight: "지표 변화가 만든 인사이트 근거",
  workflow_metric: "업무 흐름을 측정하는 지표 연결",
  workflow_sequence: "업무가 진행되는 순서"
};

const layoutLabels: Record<StructureMapLayoutMode, string> = {
  clustered: "연결 밀도",
  "risk-first": "위험 우선",
  "semantic-lanes": "의미 레인"
};

export function StructureMapScreen() {
  const { commands, state } = usePrototype();
  const view = useMemo(() => getStructureMapView(state, state.structureMapView), [state]);
  const companyData = currentCompanyData(state);
  const graphSemantics = useMemo(
    () =>
      buildStructureMapFocusSemantics({
        depth: state.structureMapView.depth,
        edges: view.edges,
        nodes: view.nodes,
        searchFocus: view.searchFocus,
        selectedItemId: state.structureMapView.selectedItemId
      }),
    [state.structureMapView.depth, state.structureMapView.selectedItemId, view.edges, view.nodes, view.searchFocus]
  );
  const graph = useMemo(
    () => buildStructureMapFlowModel(view.nodes, view.edges, graphSemantics),
    [graphSemantics, view.edges, view.nodes]
  );
  const [relationDraft, setRelationDraft] = useState<RelationDraft>(() => createRelationDraft(view.nodes));

  useEffect(() => {
    setRelationDraft((current) => ensureRelationDraft(current, view.nodes));
  }, [view.nodes]);

  const selectedDetail =
    state.structureMapView.selectedItemId && view.selectedDetail?.id === state.structureMapView.selectedItemId ? view.selectedDetail : undefined;
  const hiddenCount = state.structureMapView.hiddenNodeIds.length + state.structureMapView.hiddenEdgeIds.length;
  const evidenceLabelById = useMemo(
    () => new Map(companyData.evidence.map((evidence) => [evidence.id, evidence.label])),
    [companyData.evidence]
  );
  const metricLabelById = useMemo(
    () => new Map(companyData.metricDefinitions.map((metric) => [metric.id, metric.name])),
    [companyData.metricDefinitions]
  );
  const inspectorContext = useMemo(
    () =>
      buildStructureMapInspectorContext({
        depth: state.structureMapView.depth,
        detail: selectedDetail,
        edges: view.edges,
        evidenceLabelById,
        metricLabelById,
        nodes: view.nodes,
        primaryPathIds: graphSemantics.primaryPathIds
      }),
    [evidenceLabelById, graphSemantics.primaryPathIds, metricLabelById, selectedDetail, state.structureMapView.depth, view.edges, view.nodes]
  );

  const resetView = () =>
    commands.setStructureMapView({
      hiddenEdgeIds: [],
      hiddenNodeIds: [],
      savedPositions: { clustered: {}, "risk-first": {}, "semantic-lanes": {} },
      searchQuery: "",
      selectedItemId: undefined
    });

  const depthSummary = depthScopeSummary({
    depth: state.structureMapView.depth,
    edges: view.edges,
    nodes: view.nodes,
    searchFocus: view.searchFocus,
    selectedItemId: state.structureMapView.selectedItemId
  });

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 text-ink">
      <div className="shrink-0">
        <SectionTitle title="구조맵" />
      </div>

      <section className="min-h-0 flex-1 overflow-hidden rounded-lg border border-hairline bg-white shadow-soft">
        <div className="flex h-full min-h-0 flex-col">
        <header className="shrink-0 border-b border-hairline bg-white">
          <div className="flex flex-wrap items-center gap-2 bg-surface-soft/60 px-4 py-2">
            <label className="relative min-w-[240px] flex-1 lg:max-w-[360px]">
              <span className="sr-only">검색</span>
              <input
                className="h-9 w-full rounded-md border border-hairline bg-white px-9 text-caption font-semibold text-ink outline-none transition focus:border-brand-accent"
                placeholder="노드명, ID, 유형, 설명, 태그"
                value={state.structureMapView.searchQuery}
                onChange={(event) => commands.setStructureMapView({ searchQuery: event.target.value })}
              />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted">⌕</span>
            </label>
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              <StatusChip tone="info" label="엔터티" value={view.summary.byNodeType.managed_object} />
              <StatusChip tone="violet" label="이벤트" value={view.summary.byNodeType.workflow} />
              <StatusChip tone="emerald" label="지표" value={view.summary.byNodeType.metric} />
              <StatusChip tone="orange" label="의사결정" value={view.summary.byNodeType.insight} />
              <StatusChip tone="neutral" label="외부/검증" value={hiddenCount} />
            </div>
            <div className="ml-auto flex shrink-0 items-center gap-2">
              <select
                className="h-9 rounded-md border border-hairline bg-white px-3 text-caption font-bold text-ink"
                value={state.structureMapView.depth}
                onChange={(event) => commands.setStructureMapView({ depth: depthValue(event.target.value) })}
              >
                <option value="all">관계 깊이: 전체</option>
                <option value="1">관계 깊이: 1단계</option>
                <option value="2">관계 깊이: 2단계</option>
                <option value="3">관계 깊이: 3단계</option>
              </select>
              <select
                className="h-9 rounded-md border border-hairline bg-white px-3 text-caption font-bold text-ink"
                value={state.structureMapView.layoutMode}
                onChange={(event) => commands.setStructureMapView({ layoutMode: event.target.value as StructureMapLayoutMode })}
              >
                {Object.entries(layoutLabels).map(([value, label]) => (
                  <option key={value} value={value}>레이아웃: {label}</option>
                ))}
              </select>
              <button className="h-9 rounded-md border border-hairline bg-white px-3 text-caption font-bold text-ink" type="button" onClick={resetView}>초기 화면</button>
            </div>
          </div>
        </header>

        <section className="flex min-h-0 flex-1 bg-white">
          <div className="flex min-w-0 flex-1 flex-col">
            <div
              data-structure-map-filterbar="true"
              className="shrink-0 border-b border-hairline bg-white px-4 py-2"
            >
              <div
                className="flex flex-wrap items-center gap-2 rounded-md border border-hairline bg-white/95 px-3 py-2 shadow-[0_8px_18px_rgba(15,23,42,0.04)]"
              >
                <FilterGroup
                  label="노드"
                  items={defaultStructureMapNodeTypes}
                  labels={nodeLabels}
                  selected={state.structureMapView.nodeTypes}
                  onToggle={(type) => commands.setStructureMapView({ nodeTypes: toggleValue(state.structureMapView.nodeTypes, type) })}
                />
                <FilterGroup
                  label="연결"
                  items={defaultStructureMapEdgeTypes}
                  labels={edgeLabels}
                  selected={state.structureMapView.edgeTypes}
                  onToggle={(type) => commands.setStructureMapView({ edgeTypes: toggleValue(state.structureMapView.edgeTypes, type) })}
                />
                <DepthScopeChip summary={depthSummary} />
              </div>
            </div>

            <div className="relative min-h-0 flex-1 overflow-hidden bg-[radial-gradient(circle_at_20%_20%,rgba(37,99,235,0.06),transparent_28%),radial-gradient(circle_at_75%_35%,rgba(20,184,166,0.05),transparent_28%),#ffffff]">
              {view.nodes.length > 0 ? (
                <StructureMapGraphCanvas
                  depth={state.structureMapView.depth}
                  graph={graph}
                  layoutMode={state.structureMapView.layoutMode}
                  onSelect={(selectedItemId) => commands.setStructureMapView({ selectedItemId })}
                  onSaveNodePosition={(nodeId, position) => {
                    const layoutMode = state.structureMapView.layoutMode;
                    commands.setStructureMapView({
                      savedPositions: {
                        ...state.structureMapView.savedPositions,
                        [layoutMode]: {
                          ...state.structureMapView.savedPositions[layoutMode],
                          [nodeId]: position
                        }
                      }
                    });
                  }}
                />
              ) : (
                <div className="flex h-full items-center justify-center px-6 text-center">
                  <div className="max-w-sm rounded-lg border border-dashed border-hairline bg-white p-6 shadow-soft">
                    <p className="font-bold text-ink">표시할 구조가 없습니다</p>
                    <p className="mt-2 text-body-sm text-muted">검색, 필터, 숨김 조건을 줄이면 그래프가 다시 표시됩니다.</p>
                  </div>
                </div>
              )}
            </div>

            <GraphLegendStrip edges={view.edges} primaryEdgeIds={graphSemantics.primaryEdgeIds} />

            <div className="grid shrink-0 grid-cols-7 gap-2 border-t border-hairline bg-surface-soft/70 px-3 py-2">
              <Kpi label="엔터티 수" value={view.summary.visibleNodes} helper={`전체 ${view.summary.totalNodes}`} tone="info" />
              <Kpi label="이벤트 수" value={view.summary.byNodeType.workflow} helper="업무흐름" tone="violet" />
              <Kpi label="지표 수" value={view.summary.byNodeType.metric} helper="계산 기준" tone="emerald" />
              <Kpi label="의사결정 수" value={view.summary.byNodeType.insight} helper="인사이트" tone="orange" />
              <Kpi label="핵심 경로" value={graphSemantics.primaryNodeIds.size + graphSemantics.primaryEdgeIds.size} helper="Entity→Decision" tone="info" />
              <Kpi label="관계 연결 수" value={view.summary.visibleEdges} helper={`전체 ${view.summary.totalEdges}`} tone="neutral" />
              <Kpi label="근거 연결" value={inspectorContext.pathSummary.evidenceIds.length} helper={selectedDetail ? "선택 범위" : "기본 경로"} tone="success" />
            </div>
          </div>

          {selectedDetail && (
            <RightInspectorPanel
              context={inspectorContext}
              detail={selectedDetail}
              draft={relationDraft}
              edges={view.edges}
              hiddenCount={hiddenCount}
              nodes={view.nodes}
              onChangeRelationDraft={setRelationDraft}
              onClose={() => commands.setStructureMapView({ selectedItemId: undefined })}
              onCreateRelation={() => {
                if (commands.addStructureMapRelation({ ...relationDraft, impact: relationDraft.description || "수동으로 추가한 관계", evidenceIds: [] })) {
                  setRelationDraft(createRelationDraft(view.nodes));
                }
              }}
              onDeleteRelation={commands.deleteStructureMapRelation}
              onHide={(id, kind) => commands.hideStructureMapItem(id, kind)}
              onUpdateNode={commands.updateStructureMapNode}
              onUpdateRelation={commands.updateStructureMapRelation}
            />
          )}
        </section>
      </div>
      </section>
    </div>
  );
}

function StructureMapGraphCanvas({
  depth,
  graph,
  layoutMode,
  onSaveNodePosition,
  onSelect
}: {
  depth: StructureMapDepth;
  graph: StructureMapFlowModel;
  layoutMode: StructureMapLayoutMode;
  onSaveNodePosition: (nodeId: string, position: { x: number; y: number }) => void;
  onSelect: (selectedItemId: string) => void;
}) {
  const nodeTypes = useMemo(() => ({ structureMapNode: StructureMapNodeCard }), []);
  const edgeTypes = useMemo(() => ({ structureMapEdge: StructureMapFlowEdgePath }), []);
  const interactiveNodes = useMemo(() => graph.nodes.map(withFlowNodeHandles), [graph.nodes]);
  const interactiveEdges = useMemo(() => graph.edges.map(withFlowEdgeDisplay), [graph.edges]);
  const [nodes, setNodes, onNodesChange] = useNodesState<StructureMapFlowNode>(interactiveNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<StructureMapFlowEdge>(interactiveEdges);
  const [flowInstance, setFlowInstance] = useState<ReactFlowInstance<StructureMapFlowNode, StructureMapFlowEdge> | null>(null);
  const graphInstanceKey = `${layoutMode}:${depth}:${graph.nodes.map((node) => node.id).join("|")}:${graph.edges.map((edge) => edge.id).join("|")}`;
  const activeCount = graph.nodes.filter((node) => !node.data.dimmed).length;
  const primaryCount = graph.nodes.filter((node) => node.data.primaryPath).length + graph.edges.filter((edge) => edge.data?.primaryPath).length;
  const fitPrimaryPath = () => {
    const primaryNodes = nodes.filter((node) => node.data.primaryPath);
    flowInstance?.fitView({ duration: 260, nodes: primaryNodes.length > 0 ? primaryNodes : nodes, padding: 0.28 });
  };

  useEffect(() => {
    setNodes(interactiveNodes);
    setEdges(interactiveEdges);
  }, [interactiveEdges, interactiveNodes, setEdges, setNodes]);

  useEffect(() => {
    if (!flowInstance) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      flowInstance.fitView({ duration: 260, padding: 0.18 });
    }, 120);

    return () => window.clearTimeout(timer);
  }, [depth, flowInstance, graph.edges.length, graph.nodes.length, layoutMode]);

  return (
    <div
      className="structure-map-flow relative h-full min-h-0"
      data-structure-map-active-count={activeCount}
      data-structure-map-edge-count={graph.edges.length}
      data-structure-map-node-count={graph.nodes.length}
      data-structure-map-primary-count={primaryCount}
      data-structure-map-react-flow="true"
    >
      <ReactFlow
        key={graphInstanceKey}
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: 0.18 }}
        minZoom={0.28}
        maxZoom={1.4}
        onInit={setFlowInstance}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodesDraggable
        nodesConnectable={false}
        edgesReconnectable={false}
        elementsSelectable
        onEdgeClick={(event, edge) => {
          event.stopPropagation();
          onSelect(edge.id);
        }}
        onNodeClick={(event, node) => {
          event.stopPropagation();
          onSelect(node.id);
        }}
        onNodeDragStop={(event, node) => {
          onSaveNodePosition(node.id, toStructureMapDomainPosition(node.position));
        }}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#e2e8f0" gap={32} size={1} />
        <MiniMap
          className="structure-map-minimap !bottom-4 !right-4 !h-28 !w-44 !overflow-hidden !rounded-md !border !border-brand-accent/35 !bg-white/90 !shadow-[0_12px_26px_rgba(37,99,235,0.14)]"
          maskColor="rgba(239, 246, 255, 0.64)"
          nodeBorderRadius={8}
          nodeColor={(node) => (node.data?.accent as string | undefined) ?? "#94a3b8"}
          nodeStrokeColor={(node) => (node.data?.stroke as string | undefined) ?? "#64748b"}
          nodeStrokeWidth={3}
          pannable
          zoomable
        />
        <Controls
          className="!bottom-4 !left-4 !rounded-md !border !border-hairline !bg-white/95 !shadow-[0_12px_28px_rgba(15,23,42,0.12)]"
          showFitView={false}
          showInteractive={false}
        />
      </ReactFlow>

      <div className="absolute bottom-4 left-[3.65rem] z-20 flex h-[52px] items-stretch">
        <div className="flex overflow-hidden rounded-md border border-hairline bg-white/95 shadow-[0_12px_28px_rgba(15,23,42,0.12)]">
          <button
            className="h-full w-[68px] border-r border-hairline px-2 text-[11px] font-black text-brand-accent hover:bg-brand-accent/5"
            data-structure-map-fit-view="true"
            type="button"
            onClick={() => flowInstance?.fitView({ duration: 260, padding: 0.18 })}
          >
            맞춤
          </button>
          <button
            className="h-full w-[68px] px-2 text-[11px] font-black text-muted hover:bg-surface-soft"
            type="button"
            onClick={fitPrimaryPath}
          >
            중앙
          </button>
        </div>
      </div>
    </div>
  );
}

function withFlowNodeHandles(node: StructureMapFlowNode): StructureMapFlowNode {
  return {
    ...node,
    sourcePosition: Position.Right,
    targetPosition: Position.Left
  };
}

function withFlowEdgeDisplay(edge: StructureMapFlowEdge): StructureMapFlowEdge {
  const color = typeof edge.style?.stroke === "string" ? edge.style.stroke : "#2563eb";
  return {
    ...edge,
    interactionWidth: edge.data?.primaryPath ? 24 : 16,
    labelBgBorderRadius: 6,
    labelBgPadding: [6, 3],
    labelBgStyle: { fill: "#ffffff", fillOpacity: 0.94 },
    labelShowBg: true,
    labelStyle: {
      fill: color,
      fontSize: 11,
      fontWeight: 800
    },
    markerEnd: {
      color,
      height: edge.data?.primaryPath ? 16 : 12,
      type: MarkerType.ArrowClosed,
      width: edge.data?.primaryPath ? 16 : 12
    },
    selected: edge.data?.selected
  };
}

function StructureMapNodeCard({ data, selected }: NodeProps<StructureMapFlowNode>) {
  const original = data.original;
  const elevated = selected || data.selected || data.primaryPath || data.searchMatch;
  const dimmed = data.dimmed && !elevated;

  return (
    <div
      className={`relative min-h-[70px] w-[176px] rounded-md border bg-white px-3 py-2 text-left shadow-[0_8px_18px_rgba(15,23,42,0.08)] transition ${
        elevated ? "ring-2 ring-brand-accent/20" : ""
      }`}
      style={{
        background: data.fill,
        borderColor: elevated ? data.accent : data.stroke,
        borderWidth: elevated ? 2 : 1,
        boxShadow: elevated ? "0 16px 34px rgba(37, 99, 235, 0.18)" : "0 8px 18px rgba(15, 23, 42, 0.08)",
        opacity: dimmed ? 0.34 : data.related || data.primaryPath || data.searchMatch ? 1 : 0.78
      }}
    >
      <Handle
        className="!size-2.5 !border-2 !border-white"
        position={Position.Left}
        style={{ backgroundColor: data.accent }}
        type="target"
      />
      <div className="flex min-w-0 items-start gap-2">
        <span
          className="grid size-7 shrink-0 place-items-center rounded-md border text-[10px] font-black"
          style={{ backgroundColor: "#ffffff", borderColor: data.stroke, color: data.accent }}
        >
          {data.iconLabel}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-[10px] font-black text-muted">{structureMapNodeMeta[data.type].label}</span>
            {original.tone === "danger" && <span className="size-1.5 shrink-0 rounded-full bg-error" title="위험 신호" />}
            {original.tone === "warning" && <span className="size-1.5 shrink-0 rounded-full bg-warning" title="주의 신호" />}
          </span>
          <span className="mt-0.5 block truncate text-[12px] font-black leading-4 text-ink">{data.label}</span>
          {(data.labelVisible || elevated) && <span className="mt-0.5 block truncate text-[10px] font-semibold leading-4 text-muted">{data.caption}</span>}
        </span>
      </div>
      <Handle
        className="!size-2.5 !border-2 !border-white"
        position={Position.Right}
        style={{ backgroundColor: data.accent }}
        type="source"
      />
    </div>
  );
}

function StructureMapFlowEdgePath({
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
}: EdgeProps<StructureMapFlowEdge>) {
  const routeOffset = edgeRouteOffset(id);
  const [path, labelX, labelY] = getSmoothStepPath({
    borderRadius: data?.primaryPath ? 20 : 12,
    offset: data?.primaryPath ? 44 : 32,
    sourcePosition,
    sourceX,
    sourceY: sourceY + routeOffset,
    stepPosition: 0.5,
    targetPosition,
    targetX,
    targetY: targetY + routeOffset
  });

  return (
    <BaseEdge
      id={id}
      interactionWidth={interactionWidth}
      label={data?.labelVisible ? label : undefined}
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
      style={{ ...style, strokeLinecap: "round", strokeLinejoin: "round" }}
    />
  );
}

function edgeRouteOffset(id: string): number {
  const hash = [...id].reduce((sum, character) => sum + character.charCodeAt(0), 0);
  return ((hash % 7) - 3) * 12;
}

function GraphReadGuide({ graph }: { graph: StructureMapFlowModel }) {
  const generatedCount = graph.edges.filter((edge) => edge.data?.readOnly).length;
  const manualCount = graph.edges.length - generatedCount;
  const primaryNodeCount = graph.nodes.filter((node) => node.data.primaryPath).length;
  const primaryEdgeCount = graph.edges.filter((edge) => edge.data?.primaryPath).length;

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <div className="min-w-[260px] flex-1">
        <p className="text-[11px] font-black text-muted">읽는 방법</p>
        <p className="mt-0.5 text-caption font-semibold leading-5 text-ink">
          노드는 Entity, Event, Metric, Decision이고, 선은 화살표 방향으로 흐르는 구조, 업무, 측정, 근거 관계입니다.
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap gap-1.5">
        <LineMeaning label="실선" value={manualCount} description="직접 등록한 관계" />
        <LineMeaning dashed label="점선" value={generatedCount} description="데이터에서 자동 생성" />
        <LineMeaning label="강조" value={primaryNodeCount + primaryEdgeCount} description="핵심 Entity to Decision 경로" />
      </div>
      <div className="flex shrink-0 flex-wrap gap-1.5">
        {Object.entries(structureMapNodeMeta)
          .filter(([type]) => type !== "category")
          .map(([type, meta]) => (
            <span
              key={type}
              className="inline-flex h-7 items-center gap-1.5 rounded-full border border-hairline bg-white px-2 text-[11px] font-black text-ink"
            >
              <span className="grid size-5 place-items-center rounded-md" style={{ backgroundColor: meta.fill, color: meta.accent }}>
                {meta.icon}
              </span>
              {meta.label}
            </span>
          ))}
      </div>
    </div>
  );
}

function LineMeaning({
  dashed = false,
  description,
  label,
  value
}: {
  dashed?: boolean;
  description: string;
  label: string;
  value: number;
}) {
  return (
    <span className="inline-flex h-7 items-center gap-1.5 rounded-full border border-hairline bg-surface-soft px-2 text-[11px] font-bold text-muted">
      <span
        className="h-0 w-7 border-t-2 border-brand-accent"
        style={{ borderTopStyle: dashed ? "dashed" : "solid" }}
      />
      <span className="text-ink">{label}</span>
      {description}
      <strong className="text-ink">{value.toLocaleString("ko-KR")}</strong>
    </span>
  );
}

function StatusChip({ label, tone, value }: { label: string; tone: BadgeTone; value: number }) {
  return (
    <span className="inline-flex h-7 items-center gap-1.5 rounded-full border border-hairline bg-white px-2.5 text-caption font-bold text-muted">
      <span className={`size-2 rounded-full ${toneDotClass(tone)}`} />
      {label}
      <strong className="text-ink">{value.toLocaleString("ko-KR")}</strong>
    </span>
  );
}

function Kpi({
  helper,
  label,
  tone,
  value
}: {
  helper: string;
  label: string;
  tone: BadgeTone;
  value: number;
}) {
  return (
    <div className="min-w-0 rounded-md border border-hairline bg-white px-3 py-2 shadow-[0_8px_18px_rgba(15,23,42,0.04)]">
      <div className="flex min-h-[58px] items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[11px] font-bold leading-4 text-muted">{label}</p>
          <p className="mt-0.5 text-title-md leading-none text-ink">{value.toLocaleString("ko-KR")}</p>
          <p className="mt-1 truncate text-[10px] font-semibold leading-3 text-muted">{helper}</p>
        </div>
        <span className={`mt-1 size-2 shrink-0 rounded-full ${toneDotClass(tone)}`} />
      </div>
    </div>
  );
}

function FilterGroup<T extends string>({
  items,
  label,
  labels,
  onToggle,
  selected
}: {
  items: T[];
  label: string;
  labels: Record<T, string>;
  selected: T[];
  onToggle: (value: T) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="mr-0.5 text-caption font-bold text-muted">{label}</span>
      {items.map((item) => {
        const active = selected.includes(item);
        return (
          <button
            key={item}
            className={`h-7 rounded-full border px-2.5 text-[11px] font-bold transition ${
              active ? "border-brand-accent bg-brand-accent/10 text-brand-accent" : "border-hairline bg-white text-muted hover:bg-surface-soft"
            }`}
            type="button"
            onClick={() => onToggle(item)}
          >
            {labels[item]}
          </button>
        );
      })}
    </div>
  );
}

type DepthScopeSummary = {
  label: string;
  tone: "active" | "empty" | "neutral";
};

function DepthScopeChip({ summary }: { summary: DepthScopeSummary }) {
  const className =
    summary.tone === "empty"
      ? "border-error/30 bg-error/5 text-error"
      : summary.tone === "active"
        ? "border-brand-accent/35 bg-brand-accent/10 text-brand-accent"
        : "border-hairline bg-surface-soft text-muted";

  return (
    <span
      data-structure-map-depth-summary="true"
      className={`ml-auto inline-flex h-7 shrink-0 items-center rounded-full border px-2.5 text-[11px] font-black ${className}`}
    >
      {summary.label}
    </span>
  );
}

function depthScopeSummary({
  depth,
  edges,
  nodes,
  searchFocus,
  selectedItemId
}: {
  depth: StructureMapDepth;
  edges: StructureMapGraphEdge[];
  nodes: StructureMapGraphNode[];
  searchFocus: StructureMapSearchFocus;
  selectedItemId?: string;
}): DepthScopeSummary {
  const depthLabel = depth === "all" ? "전체" : `${depth}단계`;

  if (searchFocus.query) {
    if (searchFocus.matchNodeIds.length === 0) {
      return { label: `검색 결과 없음 · ${depthLabel}`, tone: "empty" };
    }

    return {
      label: `검색 강조 ${depthLabel}: 노드 ${searchFocus.nodeIds.length} · 연결 ${searchFocus.edgeIds.length}`,
      tone: "active"
    };
  }

  if (selectedItemId) {
    const relatedIds = getStructureMapRelatedIds(nodes, edges, selectedItemId, depth);
    const relatedNodeCount = nodes.filter((node) => relatedIds.has(node.id)).length;
    const relatedEdgeCount = edges.filter((edge) => relatedIds.has(edge.id)).length;
    return {
      label: `선택 강조 ${depthLabel}: 노드 ${relatedNodeCount} · 연결 ${relatedEdgeCount}`,
      tone: "active"
    };
  }

  return {
    label: `${depth === "all" ? "표시 범위" : "핵심 관계"} ${depthLabel}: 노드 ${nodes.length} · 연결 ${edges.length}`,
    tone: depth === "all" ? "neutral" : "active"
  };
}

function GraphLegendStrip({ edges, primaryEdgeIds }: { edges: StructureMapGraphEdge[]; primaryEdgeIds: Set<string> }) {
  const edgeCounts = new Map<StructureMapEdgeType, number>();
  edges.forEach((edge) => edgeCounts.set(edge.edgeType, (edgeCounts.get(edge.edgeType) ?? 0) + 1));
  const generatedCount = edges.filter((edge) => edge.readOnly).length;
  const manualCount = edges.length - generatedCount;
  const primaryEdgeCount = edges.filter((edge) => primaryEdgeIds.has(edge.id)).length;
  return (
    <div className="flex shrink-0 items-center gap-3 overflow-x-auto border-t border-hairline bg-white px-4 py-2 text-[11px] font-bold text-muted">
      <span className="inline-flex shrink-0 flex-col leading-4">
        <span className="text-ink">범례</span>
        <span className="font-semibold text-muted">색=관계 종류 · 화살표=흐름 방향</span>
      </span>
      <LegendLine label="핵심 경로" value={primaryEdgeCount} />
      <LegendLine label="수동 관계" value={manualCount} />
      <LegendLine dashed label="자동 생성" value={generatedCount} />
      {defaultStructureMapEdgeTypes.map((type) => (
        <span key={type} className="inline-flex items-center gap-1.5 whitespace-nowrap" title={edgeDescriptions[type]}>
          <span className="h-1.5 w-7 rounded-full" style={{ backgroundColor: structureMapEdgeMeta[type].color }} />
          <span className="text-ink">{edgeLabels[type]}</span>
          <span>{edgeDescriptions[type]}</span>
          <strong className="text-ink">{edgeCounts.get(type) ?? 0}</strong>
        </span>
      ))}
    </div>
  );
}

function LegendLine({
  dashed = false,
  label,
  value
}: {
  dashed?: boolean;
  label: string;
  value: number;
}) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-surface-soft px-2 py-1">
      <span
        className="h-0 w-7 border-t-2 border-brand-accent"
        style={{ borderTopStyle: dashed ? "dashed" : "solid" }}
      />
      {label}
      <strong className="text-ink">{value.toLocaleString("ko-KR")}</strong>
    </span>
  );
}

function RightInspectorPanel({
  context,
  detail,
  draft,
  edges,
  hiddenCount,
  nodes,
  onChangeRelationDraft,
  onClose,
  onCreateRelation,
  onDeleteRelation,
  onHide,
  onUpdateNode,
  onUpdateRelation
}: {
  context: StructureMapInspectorContext;
  detail?: StructureMapItemDetail;
  draft: RelationDraft;
  edges: StructureMapGraphEdge[];
  hiddenCount: number;
  nodes: StructureMapGraphNode[];
  onChangeRelationDraft: (draft: RelationDraft) => void;
  onClose: () => void;
  onCreateRelation: () => void;
  onDeleteRelation: (relationId: string) => boolean;
  onHide: (id: string, kind: "node" | "edge") => void;
  onUpdateNode: (nodeId: string, patch: StructureMapNodePatch) => boolean;
  onUpdateRelation: (relationId: string, patch: StructureMapRelationPatch) => boolean;
}) {
  const evidenceCount = context.pathSummary.evidenceIds.length;
  const metricCount = context.pathSummary.metricIds.length;
  return (
    <aside data-structure-map-inspector="true" className="flex w-[280px] shrink-0 flex-col border-l border-hairline bg-white lg:w-[292px] 2xl:w-[320px]">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-hairline px-3 py-2.5">
        <div className="min-w-0">
          <p className="text-caption font-bold text-muted">선택된 노드</p>
          <h2 className="truncate text-title-md text-ink">{detail?.title ?? "항목 없음"}</h2>
        </div>
        <button className="text-title-md text-muted" type="button" title="닫기" onClick={onClose}>×</button>
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto bg-surface-soft/55 p-2.5">
        <DetailPanel
          detail={detail}
          edges={edges}
          nodes={nodes}
          onDeleteRelation={onDeleteRelation}
          onHide={onHide}
          onUpdateNode={onUpdateNode}
          onUpdateRelation={onUpdateRelation}
        />

        <section className="rounded-md border border-hairline bg-white p-2.5">
          <h3 className="text-caption font-black text-ink">연결 관계</h3>
          <div className="mt-2 space-y-1.5 text-caption">
            <InspectorRow label="직접 연결" value={`${context.directEdgeCount.toLocaleString("ko-KR")}개`} />
            <InspectorRow label="방향" value={`수신 ${context.incomingCount} · 발신 ${context.outgoingCount}`} />
            <InspectorRow label="근거" value={`${evidenceCount.toLocaleString("ko-KR")}개`} />
            <InspectorRow label="관련 지표" value={`${metricCount.toLocaleString("ko-KR")}개`} />
            <InspectorRow label="의사결정" value={`${context.connectedDecisionLabels.length.toLocaleString("ko-KR")}개`} />
            <InspectorRow label="핵심 경로" value={context.primaryPath ? "포함" : "주변 맥락"} />
            <InspectorRow label="숨김 항목" value={`${hiddenCount.toLocaleString("ko-KR")}개`} />
          </div>
          <button className="mt-3 h-8 w-full rounded-md border border-brand-accent/20 bg-brand-accent/5 text-caption font-bold text-brand-accent" type="button">
            Entity → Decision 경로 보기
          </button>
        </section>

        <section className="rounded-md border border-hairline bg-white p-2.5">
          <h3 className="text-caption font-black text-ink">데이터 출처</h3>
          <div className="mt-2 space-y-1.5 text-caption">
            <InspectorRow label="관계 원천" value={context.sourceLabels.join(", ") || "연결 없음"} />
            <InspectorRow label="수동/자동" value={`수동 ${context.manualEdgeCount} · 자동 ${context.generatedEdgeCount}`} />
            <InspectorRow label="적용 상태" value={detail?.editable ? "편집 가능" : "분석 결과 잠금"} />
          </div>
        </section>

        <InspectorListPanel title="근거 미리보기" emptyLabel="연결된 근거 없음" items={context.evidenceLabels} />
        <InspectorListPanel title="도출 지표" emptyLabel="연결된 지표 없음" items={context.metricLabels} />
        <InspectorListPanel title="연결 의사결정" emptyLabel="연결된 의사결정 없음" items={context.connectedDecisionLabels} />

        <RelationCreator draft={draft} nodes={nodes} onChange={onChangeRelationDraft} onCreate={onCreateRelation} />
        <Legend edges={edges} />
      </div>

      <div className="shrink-0 border-t border-hairline bg-white p-2.5">
        <button className="h-9 w-full rounded-md border border-hairline bg-white text-caption font-bold text-muted" type="button" onClick={onClose}>닫기</button>
      </div>
    </aside>
  );
}

function InspectorRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md bg-surface-soft px-2.5 py-1.5">
      <span className="truncate text-muted">{label}</span>
      <strong className="truncate text-right text-ink">{value}</strong>
    </div>
  );
}

function InspectorListPanel({ emptyLabel, items, title }: { emptyLabel: string; items: string[]; title: string }) {
  return (
    <section className="rounded-md border border-hairline bg-white p-2.5">
      <h3 className="text-caption font-black text-ink">{title}</h3>
      {items.length > 0 ? (
        <div className="mt-2 space-y-1.5">
          {items.map((item) => (
            <p key={item} className="rounded-md bg-surface-soft px-2.5 py-1.5 text-caption font-semibold leading-5 text-ink">
              {item}
            </p>
          ))}
        </div>
      ) : (
        <p className="mt-2 rounded-md bg-surface-soft px-2.5 py-1.5 text-caption font-semibold text-muted">{emptyLabel}</p>
      )}
    </section>
  );
}

function DetailPanel({
  detail,
  edges,
  nodes,
  onDeleteRelation,
  onHide,
  onUpdateNode,
  onUpdateRelation
}: {
  detail?: StructureMapItemDetail;
  edges: StructureMapGraphEdge[];
  nodes: StructureMapGraphNode[];
  onDeleteRelation: (relationId: string) => boolean;
  onHide: (id: string, kind: "node" | "edge") => void;
  onUpdateNode: (nodeId: string, patch: StructureMapNodePatch) => boolean;
  onUpdateRelation: (relationId: string, patch: StructureMapRelationPatch) => boolean;
}) {
  const selectedNode = detail?.kind === "node" ? nodes.find((node) => node.id === detail.id) : undefined;
  const selectedEdge = detail?.kind === "edge" ? edges.find((edge) => edge.id === detail.id) : undefined;
  const [draft, setDraft] = useState({ primary: "", secondary: "", body: "" });

  useEffect(() => {
    if (selectedNode) {
      setDraft(selectedNode.editorDraft);
      return;
    }
    if (selectedEdge) {
      setDraft({ primary: selectedEdge.label, secondary: selectedEdge.impact ?? "", body: selectedEdge.description ?? "" });
      return;
    }
    setDraft({ primary: "", secondary: "", body: "" });
  }, [selectedEdge, selectedNode]);

  if (!detail) {
    return (
      <section className="rounded-md border border-hairline bg-white p-2.5">
        <p className="text-caption font-black text-ink">선택된 항목 없음</p>
        <p className="mt-2 text-caption leading-5 text-muted">그래프에서 노드나 연결을 선택하면 편집 가능한 항목과 읽기 전용 항목이 구분되어 표시됩니다.</p>
      </section>
    );
  }

  return (
    <section className="rounded-md border border-hairline bg-white p-2.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge tone={detail.kind === "edge" ? "info" : "neutral"}>{detail.kind === "edge" ? "연결" : "노드"}</Badge>
        <Badge tone={detail.editable ? "success" : "warning"}>{detail.editable ? "편집 가능" : "읽기 전용"}</Badge>
      </div>
      <h2 className="mt-2 text-title-sm text-ink">{detail.title}</h2>
      <p className="mt-1 text-caption text-muted">{detail.subtitle}</p>
      {detail.body && <p className="mt-2 text-caption leading-5 text-ink">{detail.body}</p>}
      {detail.readOnlyReason && <p className="mt-2 rounded-md bg-warning/10 p-2 text-caption font-semibold text-warning">{detail.readOnlyReason}</p>}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {detail.badges.map((badge) => (
          <Badge key={badge} tone="info">{badge}</Badge>
        ))}
      </div>

      {detail.editable && selectedNode && (
        <details className="mt-2 rounded-md border border-hairline bg-surface-soft/60 px-2.5 py-2">
          <summary className="cursor-pointer text-caption font-black text-ink">노드 편집</summary>
          <div className="mt-2 space-y-2 border-t border-hairline pt-2">
            <Field label="이름" value={draft.primary} onChange={(value) => setDraft((current) => ({ ...current, primary: value }))} />
            <Field label={nodeSecondaryFieldLabel(selectedNode.type)} value={draft.secondary} onChange={(value) => setDraft((current) => ({ ...current, secondary: value }))} />
            <Field label={nodeBodyFieldLabel(selectedNode.type)} textarea value={draft.body} onChange={(value) => setDraft((current) => ({ ...current, body: value }))} />
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <Button
                className="h-8 px-3 text-caption"
                variant="secondary"
                onClick={() => {
                  if (selectedNode.type === "managed_object") {
                    onUpdateNode(selectedNode.id, { name: draft.primary, status: draft.secondary, summary: draft.body });
                  } else if (selectedNode.type === "workflow") {
                    onUpdateNode(selectedNode.id, { name: draft.primary, occurredAt: draft.body, workflowType: draft.secondary });
                  } else if (selectedNode.type === "metric") {
                    onUpdateNode(selectedNode.id, { name: draft.primary, unit: draft.secondary, formula: draft.body });
                  } else if (selectedNode.type === "insight") {
                    onUpdateNode(selectedNode.id, { reason: draft.body, status: draft.secondary, title: draft.primary });
                  }
                }}
              >
                저장
              </Button>
              <Button className="h-8 px-3 text-caption" variant="ghost" onClick={() => onHide(selectedNode.id, "node")}>숨기기</Button>
            </div>
          </div>
        </details>
      )}

      {selectedEdge && (
        <div className="mt-2 space-y-2 border-t border-hairline pt-2">
          {selectedEdge.readOnly ? (
            <p className="text-caption leading-5 text-muted">이 연결은 원천 데이터에서 생성되어 직접 삭제하거나 수정하지 않습니다.</p>
          ) : (
            <details className="rounded-md border border-hairline bg-surface-soft/60 px-2.5 py-2">
              <summary className="cursor-pointer text-caption font-black text-ink">관계 편집</summary>
              <div className="mt-2 space-y-2 border-t border-hairline pt-2">
              <Field label="관계 유형" value={draft.primary} onChange={(value) => setDraft((current) => ({ ...current, primary: value }))} />
              <Field label="영향" value={draft.secondary} onChange={(value) => setDraft((current) => ({ ...current, secondary: value }))} />
              <Field label="설명" textarea value={draft.body} onChange={(value) => setDraft((current) => ({ ...current, body: value }))} />
              <div className="grid grid-cols-2 gap-2">
                <Button
                  className="h-8 px-3 text-caption"
                  variant="secondary"
                  disabled={!draft.primary.trim()}
                  onClick={() => selectedEdge.relationId && onUpdateRelation(selectedEdge.relationId, { description: draft.body, impact: draft.secondary, type: draft.primary })}
                >
                  관계 저장
                </Button>
                <Button className="h-8 px-3 text-caption" variant="danger" onClick={() => selectedEdge.relationId && onDeleteRelation(selectedEdge.relationId)}>삭제</Button>
                <Button className="col-span-2 h-8 px-3 text-caption" variant="ghost" onClick={() => onHide(selectedEdge.id, "edge")}>숨기기</Button>
              </div>
              </div>
            </details>
          )}
        </div>
      )}
    </section>
  );
}

function RelationCreator({
  draft,
  nodes,
  onChange,
  onCreate
}: {
  draft: RelationDraft;
  nodes: StructureMapGraphNode[];
  onChange: (draft: RelationDraft) => void;
  onCreate: () => void;
}) {
  const selectableNodes = nodes.filter((node) => node.type !== "category");
  return (
    <details className="rounded-md border border-hairline bg-white p-2.5">
      <summary className="cursor-pointer text-caption font-black text-ink">관계 추가</summary>
      <p className="mt-2 text-caption text-muted">수동 추가는 Relation 기반 연결로 저장됩니다.</p>
      <div className="mt-2 space-y-2 border-t border-hairline pt-2">
        <SelectField label="시작" value={draft.fromId} nodes={selectableNodes} onChange={(fromId) => onChange({ ...draft, fromId })} />
        <SelectField label="끝" value={draft.toId} nodes={selectableNodes} onChange={(toId) => onChange({ ...draft, toId })} />
        <Field label="관계 유형" value={draft.type} onChange={(type) => onChange({ ...draft, type })} />
        <Field label="상태" value={draft.status} onChange={(status) => onChange({ ...draft, status })} />
        <Field label="설명" textarea value={draft.description} onChange={(description) => onChange({ ...draft, description })} />
        <Button className="h-8 w-full px-3 text-caption" disabled={!draft.fromId || !draft.toId || draft.fromId === draft.toId || !draft.type.trim()} onClick={onCreate}>
          관계 추가
        </Button>
      </div>
    </details>
  );
}

function Legend({ edges }: { edges: StructureMapGraphEdge[] }) {
  const edgeCounts = new Map<StructureMapEdgeType, number>();
  edges.forEach((edge) => edgeCounts.set(edge.edgeType, (edgeCounts.get(edge.edgeType) ?? 0) + 1));
  return (
    <details className="rounded-md border border-hairline bg-white p-2.5">
      <summary className="cursor-pointer text-caption font-black text-ink">범례</summary>
      <div className="mt-2 space-y-1.5 border-t border-hairline pt-2">
        {defaultStructureMapEdgeTypes.map((type) => (
          <div key={type} className="flex items-center justify-between gap-3 rounded-md bg-surface-soft px-2.5 py-1.5">
            <span className="flex min-w-0 items-center gap-2">
              <span className="h-1.5 w-8 shrink-0 rounded-full" style={{ backgroundColor: structureMapEdgeMeta[type].color }} />
              <span className="truncate text-caption font-semibold text-ink">{edgeLabels[type]}</span>
            </span>
            <Badge tone="neutral">{edgeCounts.get(type) ?? 0}</Badge>
          </div>
        ))}
      </div>
    </details>
  );
}

function Field({
  label,
  onChange,
  textarea = false,
  value
}: {
  label: string;
  onChange: (value: string) => void;
  textarea?: boolean;
  value: string;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-caption font-bold text-muted">{label}</span>
      {textarea ? (
        <textarea
          className="min-h-14 w-full rounded-md border border-hairline bg-canvas px-2.5 py-2 text-caption text-ink outline-none focus:border-brand-accent"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <input
          className="h-8 w-full rounded-md border border-hairline bg-canvas px-2.5 text-caption text-ink outline-none focus:border-brand-accent"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </label>
  );
}

function SelectField({
  label,
  nodes,
  onChange,
  value
}: {
  label: string;
  nodes: StructureMapGraphNode[];
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-caption font-bold text-muted">{label}</span>
      <select className="h-8 w-full rounded-md border border-hairline bg-canvas px-2.5 text-caption text-ink" value={value} onChange={(event) => onChange(event.target.value)}>
        {nodes.map((node) => (
          <option key={node.id} value={node.id}>{node.label}</option>
        ))}
      </select>
    </label>
  );
}

function nodeSecondaryFieldLabel(type: StructureMapNodeType): string {
  const labels: Record<StructureMapNodeType, string> = {
    category: "유형",
    insight: "상태",
    managed_object: "상태",
    metric: "단위",
    workflow: "업무 유형"
  };
  return labels[type];
}

function nodeBodyFieldLabel(type: StructureMapNodeType): string {
  const labels: Record<StructureMapNodeType, string> = {
    category: "설명",
    insight: "사유",
    managed_object: "설명",
    metric: "계산식",
    workflow: "발생 일시"
  };
  return labels[type];
}

function toneDotClass(tone: BadgeTone): string {
  const classes: Record<BadgeTone, string> = {
    danger: "bg-error",
    emerald: "bg-badge-emerald",
    info: "bg-brand-accent",
    neutral: "bg-muted-soft",
    orange: "bg-badge-orange",
    pink: "bg-badge-pink",
    success: "bg-success",
    violet: "bg-badge-violet",
    warning: "bg-warning"
  };

  return classes[tone];
}

function toggleValue<T extends string>(values: T[], value: T): T[] {
  if (values.includes(value)) {
    return values.length === 1 ? values : values.filter((item) => item !== value);
  }
  return [...values, value];
}

function depthValue(value: string) {
  if (value === "1" || value === "2" || value === "3") {
    return Number(value) as 1 | 2 | 3;
  }
  return "all";
}

function createRelationDraft(nodes: StructureMapGraphNode[]): RelationDraft {
  return {
    fromId: nodes[0]?.id ?? "",
    toId: nodes.find((node) => node.id !== nodes[0]?.id)?.id ?? "",
    type: "운영 영향",
    status: "검토",
    description: ""
  };
}

function ensureRelationDraft(current: RelationDraft, nodes: StructureMapGraphNode[]): RelationDraft {
  const nodeIds = new Set(nodes.map((node) => node.id));
  if (nodeIds.has(current.fromId) && nodeIds.has(current.toId) && current.fromId !== current.toId) {
    return current;
  }
  return createRelationDraft(nodes);
}
