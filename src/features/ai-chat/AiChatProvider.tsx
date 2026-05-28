"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from "react";
import { usePrototype } from "../../lib/prototype/PrototypeProvider";
import { buildAiChatResponse } from "./aiChatScenarios";
import type { AiChatMessage, AiChatPendingAssistant, AiChatSessionState } from "./aiChatTypes";

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
  attachSourceFile(sourceFileId: string): void;
  clearMessages(): void;
  closeChat(): void;
  detachSourceFile(sourceFileId: string): void;
  openChat(): void;
  pendingAssistant?: AiChatPendingAssistant;
  setDraft(draft: string): void;
  submitQuestion(question?: string): void;
  toggleChat(): void;
};

const AiChatContext = createContext<AiChatContextValue | undefined>(undefined);

function defaultSession(): AiChatSessionState {
  return {
    attachedSourceFileIds: [],
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
      attachedSourceFileIds: Array.isArray(parsed.attachedSourceFileIds) ? parsed.attachedSourceFileIds.filter(isString) : [],
      draft: typeof parsed.draft === "string" ? parsed.draft : "",
      isOpen: Boolean(parsed.isOpen),
      messages: parsed.messages.filter(isAiChatMessage)
    };
  } catch {
    return undefined;
  }
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isAiChatMessage(message: unknown): message is AiChatMessage {
  if (!message || typeof message !== "object") {
    return false;
  }

  const candidate = message as Partial<AiChatMessage>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.content === "string" &&
    typeof candidate.createdAt === "string" &&
    (candidate.role === "assistant" || candidate.role === "user")
  );
}

function messageId(role: AiChatMessage["role"]): string {
  return `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function assistantMessageFromPending(pending: AiChatPendingAssistant): AiChatMessage {
  return {
    actionItems: pending.actionItems,
    attachmentSourceFileIds: pending.attachmentSourceFileIds,
    citationEvidenceIds: pending.citationEvidenceIds,
    content: pending.fullContent,
    createdAt: pending.createdAt,
    id: pending.id,
    role: pending.role,
    scenarioId: pending.scenarioId
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
      const assistantMessage = assistantMessageFromPending(pendingAssistant);
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

  const attachSourceFile = useCallback((sourceFileId: string) => {
    setSession((current) => {
      if (!sourceFileId || current.attachedSourceFileIds.includes(sourceFileId)) {
        return current;
      }

      return {
        ...current,
        attachedSourceFileIds: [...current.attachedSourceFileIds, sourceFileId]
      };
    });
  }, []);

  const detachSourceFile = useCallback((sourceFileId: string) => {
    setSession((current) => ({
      ...current,
      attachedSourceFileIds: current.attachedSourceFileIds.filter((id) => id !== sourceFileId)
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

    const validAttachmentIds = session.attachedSourceFileIds.filter((sourceFileId) =>
      state.sourceFiles.some((file) => file.id === sourceFileId)
    );
    const createdAt = new Date().toISOString();
    const userMessage: AiChatMessage = {
      id: messageId("user"),
      role: "user",
      content,
      createdAt,
      attachmentSourceFileIds: validAttachmentIds
    };
    const response = buildAiChatResponse({
      attachedSourceFileIds: validAttachmentIds,
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
      attachmentSourceFileIds: response.attachmentSourceFileIds
    };
    setPendingAssistant({
      ...assistantMessage,
      displayContent: "",
      fullContent: response.content,
      phase: "thinking"
    });
    setSession((current) => ({
      ...current,
      attachedSourceFileIds: [],
      draft: "",
      isOpen: true,
      messages: [...current.messages, userMessage]
    }));
  }, [pendingAssistant, session.attachedSourceFileIds, session.draft, state]);

  const clearMessages = useCallback(() => {
    setPendingAssistant(undefined);
    setSession((current) => ({
      ...current,
      attachedSourceFileIds: [],
      draft: "",
      messages: []
    }));
  }, []);

  const value = useMemo<AiChatContextValue>(
    () => ({
      ...session,
      attachSourceFile,
      clearMessages,
      closeChat,
      detachSourceFile,
      openChat,
      pendingAssistant,
      setDraft,
      submitQuestion,
      toggleChat
    }),
    [attachSourceFile, clearMessages, closeChat, detachSourceFile, openChat, pendingAssistant, session, setDraft, submitQuestion, toggleChat]
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
