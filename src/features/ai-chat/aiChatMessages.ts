import type { AiChatAttachment, AiChatMessage, AiChatPendingAssistant, AiChatVisualBlock } from "./aiChatTypes";

type UserMessageInput = {
  attachments: AiChatAttachment[];
  content: string;
  createdAt: string;
  id: string;
};

export function createUserMessage({ attachments, content, createdAt, id }: UserMessageInput): AiChatMessage {
  return {
    id,
    role: "user",
    content,
    createdAt,
    attachments
  };
}

export function createAssistantMessageFromPending(pending: AiChatPendingAssistant): AiChatMessage {
  return {
    actionItems: pending.actionItems,
    attachments: pending.attachments,
    citationEvidenceIds: pending.citationEvidenceIds,
    content: pending.fullContent,
    createdAt: pending.createdAt,
    id: pending.id,
    role: pending.role,
    scenarioId: pending.scenarioId,
    visualBlocks: pending.visualBlocks
  };
}

export function isAiChatVisualBlock(value: unknown): value is AiChatVisualBlock {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<AiChatVisualBlock>;
  if (typeof candidate.id !== "string" || typeof candidate.title !== "string") {
    return false;
  }

  if (candidate.type === "metric_chart") {
    return (
      typeof candidate.unit === "string" &&
      ["bar", "line", "time_series", "pie"].includes(candidate.chartType ?? "") &&
      ["normal", "warning", "critical"].includes(candidate.status ?? "") &&
      Array.isArray(candidate.points) &&
      candidate.points.every((point) => (
        Boolean(point) &&
        typeof point === "object" &&
        typeof point.label === "string" &&
        typeof point.value === "number"
      ))
    );
  }

  if (candidate.type === "comparison") {
    return Array.isArray(candidate.rows) && candidate.rows.every((row) => (
      Boolean(row) &&
      typeof row === "object" &&
      typeof row.label === "string" &&
      typeof row.value === "string"
    ));
  }

  return false;
}
