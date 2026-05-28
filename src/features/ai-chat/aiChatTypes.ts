import type { LinkTarget, Screen } from "../../lib/domain/types";

export type AiChatRole = "assistant" | "user";

export type AiChatAction = {
  label: string;
  screen?: Screen;
  target?: LinkTarget;
};

export type AiChatMessage = {
  id: string;
  role: AiChatRole;
  content: string;
  createdAt: string;
  scenarioId?: string;
  citationEvidenceIds?: string[];
  actionItems?: AiChatAction[];
  attachmentSourceFileIds?: string[];
};

export type AiChatScenarioResponse = {
  actionItems?: AiChatAction[];
  attachmentSourceFileIds?: string[];
  citationEvidenceIds?: string[];
  content: string;
  scenarioId?: string;
};

export type AiChatSessionState = {
  attachedSourceFileIds: string[];
  draft: string;
  isOpen: boolean;
  messages: AiChatMessage[];
};
