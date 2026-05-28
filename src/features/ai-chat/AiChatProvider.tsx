"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from "react";
import { usePrototype } from "../../lib/prototype/PrototypeProvider";
import { buildAiChatResponse } from "./aiChatScenarios";
import type { AiChatMessage, AiChatSessionState } from "./aiChatTypes";

const STORAGE_VERSION = 1;
const STORAGE_PREFIX = "doni:ai-chat";

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

export function AiChatProvider({ children }: PropsWithChildren) {
  const { state } = usePrototype();
  const key = useMemo(
    () => storageKey(state.company.id, state.session.currentUserId || "anonymous"),
    [state.company.id, state.session.currentUserId]
  );
  const [session, setSession] = useState<AiChatSessionState>(() => defaultSession());
  const [hydratedKey, setHydratedKey] = useState("");

  useEffect(() => {
    const loaded = parsePersistedSession(browserStorage()?.getItem(key) ?? null);
    setSession(loaded ?? defaultSession());
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
    setSession((current) => {
      const content = (question ?? current.draft).trim();
      if (!content) {
        return current;
      }

      const validAttachmentIds = current.attachedSourceFileIds.filter((sourceFileId) =>
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
        content: response.content,
        createdAt: new Date().toISOString(),
        scenarioId: response.scenarioId,
        citationEvidenceIds: response.citationEvidenceIds,
        actionItems: response.actionItems,
        attachmentSourceFileIds: response.attachmentSourceFileIds
      };

      return {
        ...current,
        attachedSourceFileIds: [],
        draft: "",
        isOpen: true,
        messages: [...current.messages, userMessage, assistantMessage]
      };
    });
  }, [state]);

  const clearMessages = useCallback(() => {
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
      setDraft,
      submitQuestion,
      toggleChat
    }),
    [attachSourceFile, clearMessages, closeChat, detachSourceFile, openChat, session, setDraft, submitQuestion, toggleChat]
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
