"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState, type ForwardRefExoticComponent, type RefAttributes } from "react";
import { SphereWithIcon } from "reagraph";
import type { GraphCanvasProps, GraphCanvasRef, InternalGraphEdge, InternalGraphNode, NodeRendererProps, Theme } from "reagraph";
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
  buildStructureMapReagraphModel,
  getStructureMapRelatedIds,
  structureMapEdgeMeta,
  structureMapNodeMeta,
  type StructureMapReagraphModel
} from "../../lib/prototype/queries/structureMapReagraphAdapter";
import { usePrototype } from "../../lib/prototype/PrototypeProvider";

type RelationDraft = {
  fromId: string;
  toId: string;
  type: string;
  status: string;
  description: string;
};

const ReagraphCanvas = dynamic<GraphCanvasProps>(() => import("reagraph").then((module) => module.GraphCanvas), {
  ssr: false
}) as ForwardRefExoticComponent<GraphCanvasProps & RefAttributes<GraphCanvasRef>>;

function renderStructureMapNode(props: NodeRendererProps) {
  return <SphereWithIcon {...props} image={props.node.icon ?? ""} size={props.size + 8} />;
}

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

const layoutLabels: Record<StructureMapLayoutMode, string> = {
  clustered: "연결 밀도",
  "risk-first": "위험 우선",
  "semantic-lanes": "의미 레인"
};

const structureMapReagraphTheme: Theme = {
  arrow: {
    activeFill: "#2563eb",
    fill: "#94a3b8"
  },
  canvas: {
    background: "transparent",
    fog: null
  },
  cluster: {
    fill: "#ffffff",
    inactiveOpacity: 0.04,
    label: {
      color: "#64748b",
      fontSize: 10
    },
    opacity: 0.08,
    selectedOpacity: 0.14,
    stroke: "#e2e8f0"
  },
  edge: {
    activeFill: "#2563eb",
    fill: "#94a3b8",
    inactiveOpacity: 0.18,
    label: {
      activeColor: "#1d4ed8",
      color: "#334155",
      fontSize: 10
    },
    opacity: 0.72,
    selectedOpacity: 1,
    subLabel: {
      activeColor: "#334155",
      color: "#64748b",
      fontSize: 9
    }
  },
  lasso: {
    background: "rgba(37, 99, 235, 0.08)",
    border: "rgba(37, 99, 235, 0.36)"
  },
  node: {
    activeFill: "#eff6ff",
    fill: "#ffffff",
    inactiveOpacity: 0.24,
    label: {
      activeColor: "#1d4ed8",
      backgroundColor: "#ffffff",
      backgroundOpacity: 0.92,
      color: "#0f172a",
      padding: 6,
      strokeColor: "#ffffff",
      strokeWidth: 2
    },
    opacity: 0.92,
    selectedOpacity: 1,
    subLabel: {
      activeColor: "#0f172a",
      color: "#64748b"
    }
  },
  ring: {
    activeFill: "#2563eb",
    fill: "#cbd5e1"
  }
};

export function StructureMapScreen() {
  const { commands, state } = usePrototype();
  const view = useMemo(() => getStructureMapView(state, state.structureMapView), [state]);
  const graphHorizontalScale = useGraphHorizontalScale();
  const graph = useMemo(
    () =>
      buildStructureMapReagraphModel(view.nodes, view.edges, {
        depth: state.structureMapView.depth,
        horizontalScale: graphHorizontalScale,
        searchFocus: view.searchFocus,
        selectedItemId: state.structureMapView.selectedItemId
      }),
    [graphHorizontalScale, state.structureMapView.depth, state.structureMapView.selectedItemId, view.edges, view.nodes, view.searchFocus]
  );
  const [relationDraft, setRelationDraft] = useState<RelationDraft>(() => createRelationDraft(view.nodes));

  useEffect(() => {
    setRelationDraft((current) => ensureRelationDraft(current, view.nodes));
  }, [view.nodes]);

  const selectedDetail =
    state.structureMapView.selectedItemId && view.selectedDetail?.id === state.structureMapView.selectedItemId ? view.selectedDetail : undefined;
  const hiddenCount = state.structureMapView.hiddenNodeIds.length + state.structureMapView.hiddenEdgeIds.length;

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
        <SectionTitle eyebrow="구조맵" title="관리 대상과 업무 연결 구조" />
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
                  graphHorizontalScale={graphHorizontalScale}
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
                  selectedItemId={state.structureMapView.selectedItemId}
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

            <GraphLegendStrip edges={view.edges} />

            <div className="grid shrink-0 grid-cols-7 gap-2 border-t border-hairline bg-surface-soft/70 px-3 py-2">
              <Kpi label="엔터티 수" value={view.summary.visibleNodes} helper={`전체 ${view.summary.totalNodes}`} tone="info" />
              <Kpi label="이벤트 수" value={view.summary.byNodeType.workflow} helper="업무흐름" tone="violet" />
              <Kpi label="지표 수" value={view.summary.byNodeType.metric} helper="계산 기준" tone="emerald" />
              <Kpi label="의사결정 수" value={view.summary.byNodeType.insight} helper="인사이트" tone="orange" />
              <Kpi label="외부 참조" value={hiddenCount} helper="숨김/보기" tone={hiddenCount > 0 ? "danger" : "neutral"} />
              <Kpi label="관계 연결 수" value={view.summary.visibleEdges} helper={`전체 ${view.summary.totalEdges}`} tone="neutral" />
              <Kpi label="AI 제안 연결" value={view.summary.generatedEdges} helper="읽기 전용" tone="info" />
            </div>
          </div>

          {selectedDetail && (
            <RightInspectorPanel
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

function useGraphHorizontalScale() {
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const updateScale = () => {
      if (window.innerWidth >= 1440) {
        setScale(1.42);
        return;
      }
      if (window.innerWidth >= 1280) {
        setScale(1.28);
        return;
      }
      setScale(1);
    };

    updateScale();
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, []);

  return scale;
}

function StructureMapGraphCanvas({
  depth,
  graph,
  graphHorizontalScale,
  layoutMode,
  onSaveNodePosition,
  onSelect,
  selectedItemId
}: {
  depth: StructureMapDepth;
  graph: StructureMapReagraphModel;
  graphHorizontalScale: number;
  layoutMode: StructureMapLayoutMode;
  onSaveNodePosition: (nodeId: string, position: { x: number; y: number }) => void;
  onSelect: (selectedItemId: string) => void;
  selectedItemId?: string;
}) {
  const graphRef = useRef<GraphCanvasRef>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      graphRef.current?.fitNodesInView(undefined, { animated: true });
    }, 160);
    return () => window.clearTimeout(timer);
  }, [depth, graph.nodes.length, layoutMode]);

  return (
    <div
      className="relative h-full min-h-0"
      data-structure-map-active-count={graph.activeIds.length}
      data-structure-map-edge-count={graph.edges.length}
      data-structure-map-node-count={graph.nodes.length}
      data-structure-map-reagraph="true"
    >
      <ReagraphCanvas
        ref={graphRef}
        actives={graph.activeIds}
        aggregateEdges={false}
        animated
        cameraMode="pan"
        clusterAttribute="type"
        defaultNodeSize={26}
        draggable
        edgeArrowPosition="end"
        edgeInterpolation="curved"
        edgeLabelPosition="above"
        edges={graph.edges}
        glOptions={{ alpha: true, antialias: true, preserveDrawingBuffer: true }}
        labelType="none"
        layoutOverrides={{
          clusterStrength: 0.18,
          forceCharge: -940,
          forceLinkDistance: 190,
          linkStrengthIntraCluster: 0.34,
          nodeStrength: -520
        }}
        layoutType="forceDirected2d"
        maxNodeSize={42}
        minNodeSize={18}
        nodes={graph.nodes}
        onCanvasClick={() => undefined}
        onEdgeClick={(edge: InternalGraphEdge) => onSelect(edge.id)}
        onNodeClick={(node: InternalGraphNode) => onSelect(node.id)}
        onNodeDragged={(node: InternalGraphNode) => {
          onSaveNodePosition(node.id, {
            x: Math.round(node.position.x / (graphHorizontalScale * 4.2)),
            y: Math.round(node.position.y / 3.2)
          });
        }}
        renderNode={renderStructureMapNode}
        selections={graph.selectedIds}
        sizingType="default"
        theme={structureMapReagraphTheme}
      />

      <div className="pointer-events-none absolute left-4 top-4 flex flex-wrap gap-2">
        {Object.entries(structureMapNodeMeta)
          .filter(([type]) => type !== "category")
          .map(([type, meta]) => (
            <span
              key={type}
              className="inline-flex h-8 items-center gap-1.5 rounded-full border border-hairline bg-white/90 px-2.5 text-[11px] font-black text-ink shadow-[0_10px_24px_rgba(15,23,42,0.08)]"
            >
              <span className="grid size-5 place-items-center rounded-md" style={{ backgroundColor: meta.fill, color: meta.accent }}>
                {meta.icon}
              </span>
              {meta.label}
            </span>
          ))}
      </div>

      <GraphNodeIconOverlay graph={graph} onSaveNodePosition={onSaveNodePosition} onSelect={onSelect} selectedItemId={selectedItemId} />

      <div className="absolute bottom-4 right-4 z-20 flex items-end gap-2">
        <div className="flex flex-col overflow-hidden rounded-md border-2 border-brand-accent/40 bg-white/95 shadow-[0_16px_34px_rgba(37,99,235,0.18)]">
          <button
            className="h-9 border-b border-hairline px-3 text-[11px] font-black text-brand-accent hover:bg-brand-accent/5"
            data-structure-map-fit-view="true"
            type="button"
            onClick={() => graphRef.current?.fitNodesInView(undefined, { animated: true })}
          >
            ⛶ 맞춤
          </button>
          <button
            className="h-9 px-3 text-[11px] font-black text-muted hover:bg-surface-soft"
            type="button"
            onClick={() => graphRef.current?.centerGraph(undefined, { animated: true })}
          >
            ◎ 중앙
          </button>
        </div>
        <GraphNavigationMap graph={graph} onSelect={onSelect} selectedItemId={selectedItemId} />
      </div>
    </div>
  );
}

function GraphNodeIconOverlay({
  graph,
  onSaveNodePosition,
  onSelect,
  selectedItemId
}: {
  graph: StructureMapReagraphModel;
  onSaveNodePosition: (nodeId: string, position: { x: number; y: number }) => void;
  onSelect: (selectedItemId: string) => void;
  selectedItemId?: string;
}) {
  const [dragState, setDragState] = useState<{
    id: string;
    moved: boolean;
    pointerId: number;
    startClientX: number;
    startClientY: number;
    startX: number;
    startY: number;
  }>();
  const bounds = useMemo(() => reagraphBounds(graph.nodes), [graph.nodes]);
  const activeIds = useMemo(() => new Set(graph.activeIds), [graph.activeIds]);

  return (
    <div className="pointer-events-none absolute inset-x-10 inset-y-16 z-10" data-structure-map-node-overlay="true">
      {graph.nodes.map((node) => {
        const original = node.data.original;
        const meta = structureMapNodeMeta[original.type];
        const left = normalizeToPercent(node.fx ?? 0, bounds.minX, bounds.maxX);
        const top = normalizeToPercent(node.fy ?? 0, bounds.minY, bounds.maxY);
        const selected = original.id === selectedItemId;
        const active = selected || activeIds.has(original.id);
        const dimmed = node.data.dimmed && !active;
        const dragging = dragState?.id === original.id;

        return (
          <button
            key={node.id}
            aria-label={`${original.label} 상세 보기`}
            className={`pointer-events-auto absolute grid -translate-x-1/2 -translate-y-1/2 touch-none place-items-center rounded-lg border bg-white text-[15px] font-black shadow-[0_12px_28px_rgba(15,23,42,0.12)] transition ${
              selected
                ? "size-11 border-brand-accent text-brand-accent shadow-[0_0_0_5px_rgba(37,99,235,0.16),0_14px_32px_rgba(37,99,235,0.22)]"
                : active
                  ? "size-10 border-teal-400 text-teal-700 shadow-[0_0_0_4px_rgba(20,184,166,0.14),0_12px_28px_rgba(15,23,42,0.12)]"
                  : "size-9 border-slate-200"
            } ${dimmed ? "opacity-35" : "opacity-100 hover:scale-110"} ${dragging ? "cursor-grabbing scale-110" : "cursor-grab"}`}
            data-structure-map-overlay-node="true"
            style={{ color: active ? undefined : meta.accent, left: `${left}%`, top: `${top}%` }}
            title={original.label}
            type="button"
            onClick={() => onSelect(original.id)}
            onPointerDown={(event) => {
              if (event.button !== 0) {
                return;
              }
              event.currentTarget.setPointerCapture(event.pointerId);
              setDragState({
                id: original.id,
                moved: false,
                pointerId: event.pointerId,
                startClientX: event.clientX,
                startClientY: event.clientY,
                startX: original.position.x,
                startY: original.position.y
              });
            }}
            onPointerMove={(event) => {
              if (!dragState || dragState.id !== original.id || dragState.pointerId !== event.pointerId) {
                return;
              }
              const moved = Math.hypot(event.clientX - dragState.startClientX, event.clientY - dragState.startClientY) > 4;
              if (moved && !dragState.moved) {
                setDragState({ ...dragState, moved: true });
              }
            }}
            onPointerUp={(event) => {
              if (!dragState || dragState.id !== original.id || dragState.pointerId !== event.pointerId) {
                return;
              }
              if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                event.currentTarget.releasePointerCapture(event.pointerId);
              }
              const deltaX = event.clientX - dragState.startClientX;
              const deltaY = event.clientY - dragState.startClientY;
              if (dragState.moved || Math.hypot(deltaX, deltaY) > 4) {
                onSaveNodePosition(original.id, {
                  x: Math.round(dragState.startX + deltaX / 2.6),
                  y: Math.round(dragState.startY + deltaY / 2.6)
                });
              }
              setDragState(undefined);
            }}
            onPointerCancel={(event) => {
              if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                event.currentTarget.releasePointerCapture(event.pointerId);
              }
              setDragState(undefined);
            }}
          >
            <span className="grid size-6 place-items-center rounded-md" style={{ backgroundColor: meta.fill }}>
              {meta.icon}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function GraphNavigationMap({
  graph,
  onSelect,
  selectedItemId
}: {
  graph: StructureMapReagraphModel;
  onSelect: (selectedItemId: string) => void;
  selectedItemId?: string;
}) {
  const bounds = useMemo(() => reagraphBounds(graph.nodes), [graph.nodes]);

  return (
    <div
      aria-label="구조맵 탐색 미니맵"
      className="structure-map-minimap relative h-36 w-56 overflow-hidden rounded-md border-2 border-brand-accent/45 bg-white/95 shadow-[0_16px_34px_rgba(37,99,235,0.18)]"
      data-structure-map-minimap="true"
    >
      <div className="absolute inset-3 rounded border border-brand-accent/20 bg-[radial-gradient(circle_at_40%_40%,rgba(37,99,235,0.08),transparent_35%),radial-gradient(circle_at_70%_55%,rgba(20,184,166,0.08),transparent_30%)]" />
      {graph.nodes.map((node) => {
        const original = node.data.original;
        const meta = structureMapNodeMeta[original.type];
        const left = normalizeToPercent(node.fx ?? 0, bounds.minX, bounds.maxX);
        const top = normalizeToPercent(node.fy ?? 0, bounds.minY, bounds.maxY);
        const selected = original.id === selectedItemId;
        return (
          <button
            key={node.id}
            aria-label={`${original.label} 선택`}
            className={`absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border transition ${
              selected ? "scale-150 border-brand-accent bg-white shadow-[0_0_0_4px_rgba(37,99,235,0.18)]" : "border-white/90"
            }`}
            style={{ backgroundColor: meta.accent, left: `${left}%`, top: `${top}%` }}
            type="button"
            onClick={() => onSelect(original.id)}
          />
        );
      })}
      <div className="pointer-events-none absolute inset-x-14 bottom-3 h-1 rounded-full bg-brand-accent/25">
        <span className="absolute left-1/2 top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-accent" />
      </div>
    </div>
  );
}

function reagraphBounds(nodes: StructureMapReagraphModel["nodes"]) {
  if (nodes.length === 0) {
    return { maxX: 1, maxY: 1, minX: 0, minY: 0 };
  }

  return nodes.reduce(
    (bounds, node) => ({
      maxX: Math.max(bounds.maxX, node.fx ?? 0),
      maxY: Math.max(bounds.maxY, node.fy ?? 0),
      minX: Math.min(bounds.minX, node.fx ?? 0),
      minY: Math.min(bounds.minY, node.fy ?? 0)
    }),
    {
      maxX: Number.NEGATIVE_INFINITY,
      maxY: Number.NEGATIVE_INFINITY,
      minX: Number.POSITIVE_INFINITY,
      minY: Number.POSITIVE_INFINITY
    }
  );
}

function graphBounds(nodes: StructureMapGraphNode[]) {
  if (nodes.length === 0) {
    return { maxX: 1, maxY: 1, minX: 0, minY: 0 };
  }

  return nodes.reduce(
    (bounds, node) => ({
      maxX: Math.max(bounds.maxX, node.position.x),
      maxY: Math.max(bounds.maxY, node.position.y),
      minX: Math.min(bounds.minX, node.position.x),
      minY: Math.min(bounds.minY, node.position.y)
    }),
    {
      maxX: Number.NEGATIVE_INFINITY,
      maxY: Number.NEGATIVE_INFINITY,
      minX: Number.POSITIVE_INFINITY,
      minY: Number.POSITIVE_INFINITY
    }
  );
}

function normalizeToPercent(value: number, min: number, max: number): number {
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) {
    return 50;
  }

  return Math.min(92, Math.max(8, ((value - min) / (max - min)) * 84 + 8));
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

function GraphLegendStrip({ edges }: { edges: StructureMapGraphEdge[] }) {
  const edgeCounts = new Map<StructureMapEdgeType, number>();
  edges.forEach((edge) => edgeCounts.set(edge.edgeType, (edgeCounts.get(edge.edgeType) ?? 0) + 1));
  return (
    <div className="flex shrink-0 items-center gap-4 overflow-x-auto border-t border-hairline bg-white px-4 py-2 text-[11px] font-bold text-muted">
      <span className="text-ink">범례</span>
      {defaultStructureMapEdgeTypes.map((type) => (
        <span key={type} className="inline-flex items-center gap-1.5 whitespace-nowrap">
          <span className="h-1.5 w-7 rounded-full" style={{ backgroundColor: structureMapEdgeMeta[type].color }} />
          {edgeLabels[type]}
          <span className="text-ink">{edgeCounts.get(type) ?? 0}</span>
        </span>
      ))}
    </div>
  );
}

function RightInspectorPanel({
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
  const evidenceCount = detail?.evidenceIds.length ?? 0;
  const metricCount = detail?.metricIds.length ?? 0;
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
            <InspectorRow label="근거" value={`${evidenceCount.toLocaleString("ko-KR")}개`} />
            <InspectorRow label="관련 지표" value={`${metricCount.toLocaleString("ko-KR")}개`} />
            <InspectorRow label="숨김 항목" value={`${hiddenCount.toLocaleString("ko-KR")}개`} />
          </div>
          <button className="mt-3 h-8 w-full rounded-md border border-brand-accent/20 bg-brand-accent/5 text-caption font-bold text-brand-accent" type="button">
            연결 경로 보기
          </button>
        </section>

        <section className="rounded-md border border-hairline bg-white p-2.5">
          <h3 className="text-caption font-black text-ink">데이터 출처</h3>
          <div className="mt-2 space-y-1.5 text-caption">
            <InspectorRow label="1차 소스" value="CRM_Master" />
            <InspectorRow label="연동 소스" value="ERP_Sales, Billing" />
            <InspectorRow label="최종 업데이트" value="2026.06.21 10:28" />
          </div>
        </section>

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
