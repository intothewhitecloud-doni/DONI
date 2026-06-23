import type { StructureMapEdgeType, StructureMapNodeType } from "../../domain/types";

export type StructureMapNodeLayerMeta = {
  accent: string;
  fill: string;
  icon: string;
  label: string;
  stroke: string;
};

export type StructureMapEdgeLayerMeta = {
  color: string;
  label: string;
};

export const structureMapNodeMeta: Record<StructureMapNodeType, StructureMapNodeLayerMeta> = {
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
    icon: "W",
    label: "업무 흐름",
    stroke: "#7c3aed"
  }
};

export const structureMapEdgeMeta: Record<StructureMapEdgeType, StructureMapEdgeLayerMeta> = {
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
