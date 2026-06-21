import type { LinkTarget, MetricChartType, Screen } from "../../lib/domain/types";

export type AiChatAction = {
  label: string;
  screen?: Screen;
  target?: LinkTarget;
};

export type AiChatAttachment = {
  id: string;
  name: string;
  type?: string;
};

export type AiChatVisualTone = "neutral" | "info" | "success" | "warning" | "danger";

export type AiChatVisualMetricPoint = {
  label: string;
  value: number;
  observedAt?: string;
};

type AiChatVisualBlockBase = {
  id: string;
  title: string;
  description?: string;
};

export type AiChatMetricChartVisualBlock = AiChatVisualBlockBase & {
  type: "metric_chart";
  chartType: Exclude<MetricChartType, "table">;
  points: AiChatVisualMetricPoint[];
  status: "normal" | "warning" | "critical";
  unit: string;
};

export type AiChatComparisonVisualRow = {
  label: string;
  value: string;
  detail?: string;
  tone?: AiChatVisualTone;
};

export type AiChatComparisonVisualBlock = AiChatVisualBlockBase & {
  type: "comparison";
  rows: AiChatComparisonVisualRow[];
};

export type AiChatVisualBlock = AiChatMetricChartVisualBlock | AiChatComparisonVisualBlock;

export type AiChatScenarioResponse = {
  actionItems?: AiChatAction[];
  citationEvidenceIds?: string[];
  content: string;
  scenarioId?: string;
  visualBlocks?: AiChatVisualBlock[];
};
