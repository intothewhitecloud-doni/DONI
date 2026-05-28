import type { LinkTarget, Screen } from "../../lib/domain/types";

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

export type AiChatMessage = {
  id: string;
  role: AiChatRole;
  content: string;
  createdAt: string;
  scenarioId?: string;
  citationEvidenceIds?: string[];
  actionItems?: AiChatAction[];
  attachments?: AiChatAttachment[];
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
};

export type AiChatSessionState = {
  attachments: AiChatAttachment[];
  draft: string;
  isOpen: boolean;
  messages: AiChatMessage[];
};
