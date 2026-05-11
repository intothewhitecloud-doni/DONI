"use client";

import { Badge } from "../../components/ui/Badge";
import {
  getManagedObjectGraphItemDetail,
  type ManagedObjectDetail,
  type ManagedObjectGraphEdge,
  type ManagedObjectGraphEdgeType,
  type ManagedObjectGraphLegendItem,
  type ManagedObjectGraphNode
} from "../../lib/prototype/queries/managedObjectQueries";
import type { EvidenceReference, MetricDefinition } from "../../lib/domain/types";

type KnowledgeGraphProps = {
  detail: ManagedObjectDetail;
  evidence: EvidenceReference[];
  metrics: MetricDefinition[];
  selectedItemId?: string;
  onSelectItem: (itemId: string) => void;
};

const graphWidth = 940;
const nodeWidth = 150;
const nodeHeight = 58;
const horizontalGap = 34;
const verticalGap = 28;
const columnOrder: Array<ManagedObjectGraphNode["type"]> = ["category", "managed_object", "workflow", "metric", "insight"];

export function KnowledgeGraph({ detail, evidence, metrics, onSelectItem, selectedItemId }: KnowledgeGraphProps) {
  const layout = layoutGraph(detail.graphNodes);
  const selectedDetail = getManagedObjectGraphItemDetail(detail, selectedItemId);

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
        <svg
          className="min-w-[920px]"
          role="img"
          aria-label="관리 대상 연결 그래프"
          viewBox={`0 0 ${graphWidth} ${layout.height}`}
        >
          <defs>
            {detail.graphLegend.map((item) => (
              <marker
                key={item.edgeType}
                id={`arrow-${item.edgeType}`}
                markerHeight="8"
                markerWidth="8"
                orient="auto"
                refX="7"
                refY="4"
                viewBox="0 0 8 8"
              >
                <path d="M 0 0 L 8 4 L 0 8 z" fill={item.color} />
              </marker>
            ))}
          </defs>
          {detail.graphEdges.map((edge) => {
            const from = layout.positions.get(edge.fromId);
            const to = layout.positions.get(edge.toId);
            if (!from || !to) {
              return null;
            }

            const color = edgeColor(edge.edgeType, detail.graphLegend);
            const selected = selectedItemId === edge.id;
            const path = edgePath(from, to);

            return (
              <g
                key={edge.id}
                className="cursor-pointer"
                role="button"
                tabIndex={0}
                onClick={() => onSelectItem(edge.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    onSelectItem(edge.id);
                  }
                }}
              >
                <path d={path} fill="none" stroke="transparent" strokeWidth="16" />
                <path
                  d={path}
                  fill="none"
                  markerEnd={`url(#arrow-${edge.edgeType})`}
                  stroke={color}
                  strokeLinecap="round"
                  strokeWidth={selected ? 3.5 : 2}
                  opacity={selected ? 1 : 0.72}
                />
              </g>
            );
          })}
          {detail.graphNodes.map((node) => {
            const position = layout.positions.get(node.id);
            if (!position) {
              return null;
            }

            const selected = selectedItemId === node.id;
            return (
              <g
                key={node.id}
                className="cursor-pointer"
                role="button"
                tabIndex={0}
                transform={`translate(${position.x} ${position.y})`}
                onClick={() => onSelectItem(node.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    onSelectItem(node.id);
                  }
                }}
              >
                <rect
                  width={nodeWidth}
                  height={nodeHeight}
                  rx="8"
                  fill={nodeFill(node.tone)}
                  stroke={selected ? "#2563eb" : nodeStroke(node.tone)}
                  strokeWidth={selected ? 2.6 : 1}
                />
                <text x="14" y="24" fill="#0f172a" fontSize="13" fontWeight="700">
                  {compactLabel(node.label, 15)}
                </text>
                <text x="14" y="43" fill="#64748b" fontSize="11" fontWeight="600">
                  {compactLabel(node.caption, 16)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <div className="grid gap-2 md:grid-cols-5">
        {detail.graphLegend.map((item) => (
          <button
            key={item.edgeType}
            className={`rounded-md border p-3 text-left transition ${
              selectedDetail?.subtitle === item.label ? "border-blue-500 bg-blue-50" : "border-slate-200 bg-white hover:bg-slate-50"
            }`}
            onClick={() => {
              const edge = detail.graphEdges.find((candidate) => candidate.edgeType === item.edgeType);
              if (edge) {
                onSelectItem(edge.id);
              }
            }}
          >
            <span className="inline-block h-2 w-6 rounded-full" style={{ backgroundColor: item.color }} />
            <p className="mt-2 text-xs font-bold text-slate-900">{item.label}</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">{item.description}</p>
          </button>
        ))}
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
        <p className="text-sm text-slate-600">그래프 노드나 edge를 선택하면 상세 정보가 표시됩니다.</p>
      </div>
    );
  }

  const evidenceLabels = evidence.filter((item) => detail.evidenceIds.includes(item.id)).map((item) => item.label);
  const metricLabels = metrics.filter((metric) => detail.metricIds.includes(metric.id)).map((metric) => metric.name);

  return (
    <div className="rounded-md border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={detail.kind === "edge" ? "info" : "neutral"}>{detail.kind === "edge" ? "edge" : "node"}</Badge>
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

function layoutGraph(nodes: ManagedObjectGraphNode[]): { height: number; positions: Map<string, { x: number; y: number }> } {
  const positions = new Map<string, { x: number; y: number }>();
  const grouped = columnOrder.map((type) => nodes.filter((node) => node.type === type));
  const maxRows = Math.max(1, ...grouped.map((items) => items.length));
  const height = 48 + maxRows * (nodeHeight + verticalGap);

  for (const [columnIndex, items] of grouped.entries()) {
    const x = 28 + columnIndex * (nodeWidth + horizontalGap);
    const columnHeight = items.length * nodeHeight + Math.max(0, items.length - 1) * verticalGap;
    const startY = Math.max(28, (height - columnHeight) / 2);

    for (const [rowIndex, node] of items.entries()) {
      positions.set(node.id, {
        x,
        y: startY + rowIndex * (nodeHeight + verticalGap)
      });
    }
  }

  return { height, positions };
}

function edgePath(from: { x: number; y: number }, to: { x: number; y: number }): string {
  const fromCenterX = from.x + nodeWidth / 2;
  const fromCenterY = from.y + nodeHeight / 2;
  const toCenterX = to.x + nodeWidth / 2;
  const toCenterY = to.y + nodeHeight / 2;

  if (Math.abs(fromCenterX - toCenterX) < 4) {
    const controlY = (fromCenterY + toCenterY) / 2;
    return `M ${fromCenterX} ${fromCenterY} C ${fromCenterX + 42} ${controlY}, ${toCenterX + 42} ${controlY}, ${toCenterX} ${toCenterY}`;
  }

  const startX = fromCenterX < toCenterX ? from.x + nodeWidth : from.x;
  const endX = fromCenterX < toCenterX ? to.x : to.x + nodeWidth;
  const controlOffset = Math.max(52, Math.abs(endX - startX) * 0.38);
  const c1 = fromCenterX < toCenterX ? startX + controlOffset : startX - controlOffset;
  const c2 = fromCenterX < toCenterX ? endX - controlOffset : endX + controlOffset;

  return `M ${startX} ${fromCenterY} C ${c1} ${fromCenterY}, ${c2} ${toCenterY}, ${endX} ${toCenterY}`;
}

function edgeColor(type: ManagedObjectGraphEdgeType, legend: ManagedObjectGraphLegendItem[]): string {
  return legend.find((item) => item.edgeType === type)?.color ?? "#475569";
}

function nodeFill(tone: ManagedObjectGraphNode["tone"]): string {
  const fills: Record<ManagedObjectGraphNode["tone"], string> = {
    danger: "#fff1f2",
    info: "#eff6ff",
    neutral: "#f8fafc",
    primary: "#eef2ff",
    success: "#ecfdf5",
    warning: "#fffbeb"
  };

  return fills[tone];
}

function nodeStroke(tone: ManagedObjectGraphNode["tone"]): string {
  const strokes: Record<ManagedObjectGraphNode["tone"], string> = {
    danger: "#fb7185",
    info: "#60a5fa",
    neutral: "#cbd5e1",
    primary: "#6366f1",
    success: "#34d399",
    warning: "#f59e0b"
  };

  return strokes[tone];
}

function compactLabel(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 3)}...`;
}
