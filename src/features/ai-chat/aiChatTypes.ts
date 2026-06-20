import type { LinkTarget, MetricChartType, Screen } from "../../lib/domain/types";

export type AiChatRole = "assistant" | "user";

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

export type AiChatMessage = {
  id: string;
  role: AiChatRole;
  content: string;
  createdAt: string;
  scenarioId?: string;
  citationEvidenceIds?: string[];
  actionItems?: AiChatAction[];
  attachments?: AiChatAttachment[];
  visualBlocks?: AiChatVisualBlock[];
};

export type AiChatPendingAssistant = AiChatMessage & {
  displayContent: string;
  fullContent: string;
  phase: "thinking" | "streaming";
};

export type AiChatScenarioResponse = {
  actionItems?: AiChatAction[];
  citationEvidenceIds?: string[];
  content: string;
  scenarioId?: string;
  visualBlocks?: AiChatVisualBlock[];
};

export type AiChatSessionState = {
  attachments: AiChatAttachment[];
  draft: string;
  isOpen: boolean;
  messages: AiChatMessage[];
};
