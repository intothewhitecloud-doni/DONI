"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from "react";
import { usePrototype } from "../../lib/prototype/PrototypeProvider";
import { createAssistantMessageFromPending, createUserMessage, isAiChatVisualBlock } from "./aiChatMessages";
import { buildAiChatResponse } from "./aiChatScenarios";
import type { AiChatAttachment, AiChatMessage, AiChatPendingAssistant, AiChatSessionState } from "./aiChatTypes";

const STORAGE_VERSION = 1;
const STORAGE_PREFIX = "doni:ai-chat";
const THINKING_DELAY_MS = 1600;
const STREAMING_INTERVAL_MS = 18;
const STREAMING_CHUNK_SIZE = 2;

type PersistedAiChatSession = AiChatSessionState & {
  savedAt: string;
  version: typeof STORAGE_VERSION;
};

type AiChatContextValue = AiChatSessionState & {
  attachFiles(files: File[]): void;
  clearMessages(): void;
  closeChat(): void;
  detachFile(attachmentId: string): void;
  openChat(): void;
  pendingAssistant?: AiChatPendingAssistant;
  setDraft(draft: string): void;
  submitQuestion(question?: string): void;
  toggleChat(): void;
};

const AiChatContext = createContext<AiChatContextValue | undefined>(undefined);

function defaultSession(): AiChatSessionState {
  return {
    attachments: [],
    draft: "",
    isOpen: false,
    messages: []
  };
}

function storageKey(companyId: string, userId: string): string {
  return `${STORAGE_PREFIX}:v${STORAGE_VERSION}:${companyId}:${userId}`;
}

function browserStorage(): Storage | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  return window.localStorage;
}

function parsePersistedSession(raw: string | null): AiChatSessionState | undefined {
  if (!raw) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<PersistedAiChatSession>;
    if (parsed.version !== STORAGE_VERSION || !Array.isArray(parsed.messages)) {
      return undefined;
    }

    return {
      attachments: Array.isArray(parsed.attachments) ? parsed.attachments.filter(isAiChatAttachment) : [],
      draft: typeof parsed.draft === "string" ? parsed.draft : "",
      isOpen: Boolean(parsed.isOpen),
      messages: parsed.messages.filter(isAiChatMessage)
    };
  } catch {
    return undefined;
  }
}

function isAiChatAttachment(value: unknown): value is AiChatAttachment {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<AiChatAttachment>;
  return typeof candidate.id === "string" && typeof candidate.name === "string";
}

function isAiChatMessage(message: unknown): message is AiChatMessage {
  if (!message || typeof message !== "object") {
    return false;
  }

  const candidate = message as Partial<AiChatMessage>;
  const hasValidVisualBlocks = candidate.visualBlocks === undefined ||
    (Array.isArray(candidate.visualBlocks) && candidate.visualBlocks.every(isAiChatVisualBlock));

  return (
    typeof candidate.id === "string" &&
    typeof candidate.content === "string" &&
    typeof candidate.createdAt === "string" &&
    (candidate.role === "assistant" || candidate.role === "user") &&
    hasValidVisualBlocks
  );
}

function messageId(role: AiChatMessage["role"]): string {
  return `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function attachmentId(file: File): string {
  return `file-${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`;
}

function fileAttachment(file: File): AiChatAttachment {
  return {
    id: attachmentId(file),
    name: file.name,
    type: file.type || undefined
  };
}

export function AiChatProvider({ children }: PropsWithChildren) {
  const { state } = usePrototype();
  const key = useMemo(
    () => storageKey(state.company.id, state.session.currentUserId || "anonymous"),
    [state.company.id, state.session.currentUserId]
  );
  const [session, setSession] = useState<AiChatSessionState>(() => defaultSession());
  const [hydratedKey, setHydratedKey] = useState("");
  const [pendingAssistant, setPendingAssistant] = useState<AiChatPendingAssistant | undefined>();

  useEffect(() => {
    const loaded = parsePersistedSession(browserStorage()?.getItem(key) ?? null);
    setSession(loaded ?? defaultSession());
    setPendingAssistant(undefined);
    setHydratedKey(key);
  }, [key]);

  useEffect(() => {
    if (hydratedKey !== key) {
      return;
    }

    const payload: PersistedAiChatSession = {
      ...session,
      savedAt: new Date().toISOString(),
      version: STORAGE_VERSION
    };

    try {
      browserStorage()?.setItem(key, JSON.stringify(payload));
    } catch {
      // Chat persistence is best-effort; the interactive session should keep working.
    }
  }, [hydratedKey, key, session]);

  useEffect(() => {
    if (!pendingAssistant || pendingAssistant.phase !== "thinking") {
      return;
    }

    const timeout = window.setTimeout(() => {
      setPendingAssistant((current) => current && current.id === pendingAssistant.id
        ? { ...current, phase: "streaming" }
        : current
      );
    }, THINKING_DELAY_MS);
    return () => window.clearTimeout(timeout);
  }, [pendingAssistant]);

  useEffect(() => {
    if (!pendingAssistant || pendingAssistant.phase !== "streaming") {
      return;
    }

    if (pendingAssistant.displayContent.length >= pendingAssistant.fullContent.length) {
      const assistantMessage = createAssistantMessageFromPending(pendingAssistant);
      setSession((current) => ({
        ...current,
        messages: current.messages.some((message) => message.id === assistantMessage.id)
          ? current.messages
          : [...current.messages, assistantMessage]
      }));
      setPendingAssistant(undefined);
      return;
    }

    const timeout = window.setTimeout(() => {
      setPendingAssistant((current) => {
        if (!current || current.id !== pendingAssistant.id) {
          return current;
        }

        const nextLength = Math.min(current.fullContent.length, current.displayContent.length + STREAMING_CHUNK_SIZE);
        return {
          ...current,
          content: current.fullContent.slice(0, nextLength),
          displayContent: current.fullContent.slice(0, nextLength)
        };
      });
    }, STREAMING_INTERVAL_MS);
    return () => window.clearTimeout(timeout);
  }, [pendingAssistant]);

  const openChat = useCallback(() => {
    setSession((current) => ({ ...current, isOpen: true }));
  }, []);

  const closeChat = useCallback(() => {
    setSession((current) => ({ ...current, isOpen: false }));
  }, []);

  const toggleChat = useCallback(() => {
    setSession((current) => ({ ...current, isOpen: !current.isOpen }));
  }, []);

  const setDraft = useCallback((draft: string) => {
    setSession((current) => ({ ...current, draft }));
  }, []);

  const attachFiles = useCallback((files: File[]) => {
    setSession((current) => {
      if (files.length === 0) {
        return current;
      }

      const incoming = files.map(fileAttachment);
      return {
        ...current,
        attachments: [...current.attachments, ...incoming]
      };
    });
  }, []);

  const detachFile = useCallback((attachmentId: string) => {
    setSession((current) => ({
      ...current,
      attachments: current.attachments.filter((attachment) => attachment.id !== attachmentId)
    }));
  }, []);

  const submitQuestion = useCallback((question?: string) => {
    if (pendingAssistant) {
      return;
    }

    const content = (question ?? session.draft).trim();
    if (!content) {
      return;
    }

    const attachments = session.attachments;
    const createdAt = new Date().toISOString();
    const userMessage = createUserMessage({
      id: messageId("user"),
      content,
      createdAt,
      attachments
    });
    const response = buildAiChatResponse({
      attachments,
      question: content,
      state
    });
    const assistantMessage: AiChatMessage = {
      id: messageId("assistant"),
      role: "assistant",
      content: "",
      createdAt: new Date().toISOString(),
      scenarioId: response.scenarioId,
      citationEvidenceIds: response.citationEvidenceIds,
      actionItems: response.actionItems,
      visualBlocks: response.visualBlocks
    };
    setPendingAssistant({
      ...assistantMessage,
      displayContent: "",
      fullContent: response.content,
      phase: "thinking"
    });
    setSession((current) => ({
      ...current,
      attachments: [],
      draft: "",
      isOpen: true,
      messages: [...current.messages, userMessage]
    }));
  }, [pendingAssistant, session.attachments, session.draft, state]);

  const clearMessages = useCallback(() => {
    setPendingAssistant(undefined);
    setSession((current) => ({
      ...current,
      attachments: [],
      draft: "",
      messages: []
    }));
  }, []);

  const value = useMemo<AiChatContextValue>(
    () => ({
      ...session,
      attachFiles,
      clearMessages,
      closeChat,
      detachFile,
      openChat,
      pendingAssistant,
      setDraft,
      submitQuestion,
      toggleChat
    }),
    [attachFiles, clearMessages, closeChat, detachFile, openChat, pendingAssistant, session, setDraft, submitQuestion, toggleChat]
  );

  return <AiChatContext.Provider value={value}>{children}</AiChatContext.Provider>;
}

export function useAiChat() {
  const context = useContext(AiChatContext);
  if (!context) {
    throw new Error("AiChatProvider 안에서만 useAiChat을 사용할 수 있습니다.");
  }

  return context;
}
