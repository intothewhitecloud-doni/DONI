"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import type { EvidenceReference, SourceFile } from "../../lib/domain/types";
import type { AiChatAction, AiChatMessage } from "./aiChatTypes";
import { aiChatScenarios, evidenceTitle } from "./aiChatScenarios";
import { usePrototype } from "../../lib/prototype/PrototypeProvider";
import { useAiChat } from "./AiChatProvider";

const CHAT_PANEL_TRANSITION_MS = 360;

export function AiChatDock() {
  const chat = useAiChat();
  const { commands, state } = usePrototype();
  const scrollRef = useRef<HTMLDivElement>(null);
  const sourceFiles = state.sourceFiles;
  const [selectedSourceFileId, setSelectedSourceFileId] = useState(sourceFiles[0]?.id ?? "");
  const [panelMounted, setPanelMounted] = useState(chat.isOpen);
  const [panelVisible, setPanelVisible] = useState(chat.isOpen);

  useEffect(() => {
    if (sourceFiles.length === 0) {
      setSelectedSourceFileId("");
      return;
    }

    if (!sourceFiles.some((file) => file.id === selectedSourceFileId)) {
      setSelectedSourceFileId(sourceFiles[0].id);
    }
  }, [selectedSourceFileId, sourceFiles]);

  useEffect(() => {
    if (!chat.isOpen) {
      return;
    }

    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [chat.isOpen, chat.messages.length, chat.pendingAssistant?.displayContent.length, chat.pendingAssistant?.phase]);

  useEffect(() => {
    if (chat.isOpen) {
      setPanelMounted(true);
      const frame = window.requestAnimationFrame(() => setPanelVisible(true));
      return () => window.cancelAnimationFrame(frame);
    }

    setPanelVisible(false);
    const timeout = window.setTimeout(() => setPanelMounted(false), CHAT_PANEL_TRANSITION_MS);
    return () => window.clearTimeout(timeout);
  }, [chat.isOpen]);

  const attachedFiles = useMemo(
    () => sourceFiles.filter((file) => chat.attachedSourceFileIds.includes(file.id)),
    [chat.attachedSourceFileIds, sourceFiles]
  );

  function handleAction(action: AiChatAction) {
    if (action.target) {
      commands.navigateToTarget(action.target);
      return;
    }

    if (action.screen) {
      commands.navigate(action.screen);
    }
  }

  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey) {
      return;
    }

    event.preventDefault();
    chat.submitQuestion();
  }

  return (
    <>
      <button
        aria-label={chat.isOpen ? "AI 채팅 닫기" : "AI 채팅 열기"}
        className={`fixed right-0 top-28 z-50 flex h-24 w-12 flex-col items-center justify-center gap-1 rounded-l-md border border-r-0 border-hairline bg-ink text-white shadow-soft transition duration-[360ms] ease-out hover:bg-primary-active focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 motion-reduce:transition-none ${
          chat.isOpen ? "translate-x-full" : "translate-x-0"
        }`}
        type="button"
        onClick={chat.toggleChat}
      >
        <span className="text-xs font-bold leading-none">AI</span>
        <span className="text-[11px] font-semibold leading-none">Chat</span>
      </button>

      {panelMounted && (
        <div
          aria-hidden={!chat.isOpen}
          className={`fixed inset-0 z-50 pointer-events-none transition-opacity duration-[360ms] ease-out motion-reduce:transition-none ${
            panelVisible ? "opacity-100" : "opacity-0"
          }`}
        >
          <button
            aria-label="AI 채팅 닫기"
            className={`absolute inset-0 bg-slate-950/20 lg:hidden ${panelVisible ? "pointer-events-auto" : "pointer-events-none"}`}
            type="button"
            onClick={chat.closeChat}
          />
          <aside
            className={`absolute inset-y-0 right-0 flex w-full max-w-[440px] flex-col border-l border-hairline bg-white shadow-[0_0_42px_rgba(15,23,42,0.18)] transition-[transform,opacity] duration-[360ms] ease-out motion-reduce:transition-none ${
              panelVisible ? "pointer-events-auto translate-x-0 opacity-100" : "pointer-events-none translate-x-full opacity-0"
            }`}
          >
            <header className="flex min-h-16 items-center justify-between gap-3 border-b border-hairline-soft px-4 py-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-title-md text-ink">DONI AI</h2>
                </div>
                <p className="mt-1 truncate text-caption text-muted">지표, 인사이트, 연결 근거를 확인합니다</p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button className="h-9 px-3" disabled={chat.messages.length === 0} variant="ghost" onClick={chat.clearMessages}>
                  지우기
                </Button>
                <Button className="h-9 px-3" variant="secondary" onClick={chat.closeChat}>
                  닫기
                </Button>
              </div>
            </header>

            <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
              {chat.messages.length === 0 ? (
                <EmptyChatState />
              ) : (
                <div className="space-y-4">
                  {chat.messages.map((message) => (
                    <ChatMessageBubble key={message.id} actionHandler={handleAction} message={message} />
                  ))}
                  {chat.pendingAssistant && (
                    <ChatMessageBubble
                      key={chat.pendingAssistant.id}
                      actionHandler={handleAction}
                      isPendingAssistant
                      message={chat.pendingAssistant}
                    />
                  )}
                </div>
              )}
            </div>

            <div className="border-t border-hairline-soft bg-surface-soft px-4 py-3">
              <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
                {aiChatScenarios.slice(0, 4).map((scenario) => (
                  <button
                    key={scenario.id}
                    className="shrink-0 rounded-full border border-hairline bg-white px-3 py-1.5 text-caption font-semibold text-ink transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={Boolean(chat.pendingAssistant)}
                    type="button"
                    onClick={() => chat.setDraft(scenario.prompt)}
                  >
                    {scenario.shortLabel}
                  </button>
                ))}
              </div>

              {sourceFiles.length > 0 && (
                <div className="mb-3 rounded-md border border-hairline-soft bg-white p-2">
                  <div className="flex gap-2">
                    <select
                      className="min-w-0 flex-1 rounded-md border border-hairline-soft bg-white px-2 py-2 text-body-sm text-ink"
                      value={selectedSourceFileId}
                      onChange={(event) => setSelectedSourceFileId(event.target.value)}
                    >
                      {sourceFiles.map((file) => (
                        <option key={file.id} value={file.id}>{file.name}</option>
                      ))}
                    </select>
                    <Button
                      className="h-10 px-3"
                      disabled={!selectedSourceFileId || chat.attachedSourceFileIds.includes(selectedSourceFileId) || Boolean(chat.pendingAssistant)}
                      variant="secondary"
                      onClick={() => chat.attachSourceFile(selectedSourceFileId)}
                    >
                      첨부
                    </Button>
                  </div>
                  {attachedFiles.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {attachedFiles.map((file) => (
                        <button
                          key={file.id}
                          className="max-w-full rounded-full border border-blue-200 bg-blue-50 px-2 py-1 text-left text-xs font-semibold text-blue-700"
                          type="button"
                          onClick={() => chat.detachSourceFile(file.id)}
                          title="첨부 해제"
                        >
                          <span className="inline-block max-w-[220px] truncate align-bottom">{file.name}</span> x
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="rounded-md border border-hairline bg-white p-2 shadow-sm">
                <textarea
                  className="max-h-32 min-h-20 w-full resize-none border-0 bg-transparent px-1 py-1 text-body-sm text-ink outline-none placeholder:text-muted-soft"
                  placeholder="분석 결과에 대해 질문하세요"
                  value={chat.draft}
                  disabled={Boolean(chat.pendingAssistant)}
                  onChange={(event) => chat.setDraft(event.target.value)}
                  onKeyDown={handleComposerKeyDown}
                />
                <div className="flex items-center justify-between gap-3">
                  <p className="min-w-0 truncate text-xs text-muted">Enter로 보내기 · Shift+Enter 줄바꿈</p>
                  <Button className="h-9 px-4" disabled={!chat.draft.trim() || Boolean(chat.pendingAssistant)} onClick={() => chat.submitQuestion()}>
                    보내기
                  </Button>
                </div>
              </div>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}

function EmptyChatState() {
  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-hairline-soft bg-surface-soft p-4">
        <Badge tone="neutral">분석 컨텍스트</Badge>
        <h3 className="mt-3 text-title-md text-ink">무엇을 확인할까요?</h3>
        <p className="mt-2 text-body-sm leading-6 text-muted">
          현재 보관 파일, 지표, 인사이트, 연결 관계를 기준으로 답변합니다.
        </p>
      </div>
    </div>
  );
}

function ChatMessageBubble({
  actionHandler,
  isPendingAssistant = false,
  message
}: {
  actionHandler: (action: AiChatAction) => void;
  isPendingAssistant?: boolean;
  message: AiChatMessage;
}) {
  const { state } = usePrototype();
  const isUser = message.role === "user";
  const citations = (message.citationEvidenceIds ?? [])
    .map((evidenceId) => state.evidence.find((item) => item.id === evidenceId))
    .filter((item): item is EvidenceReference => Boolean(item));
  const attachedFiles = (message.attachmentSourceFileIds ?? [])
    .map((sourceFileId) => state.sourceFiles.find((file) => file.id === sourceFileId))
    .filter((item): item is SourceFile => Boolean(item));

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[92%] rounded-lg border p-3 ${isUser ? "border-ink bg-ink text-white" : "border-hairline-soft bg-white text-body shadow-sm"}`}>
        {isPendingAssistant && !message.content ? (
          <ThinkingIndicator />
        ) : (
          <div className="space-y-2 text-body-sm leading-6">
            {message.content.split("\n\n").map((paragraph, index) => (
              <p key={`${index}-${paragraph}`} className="whitespace-pre-line">
                {paragraph}
                {isPendingAssistant && index === message.content.split("\n\n").length - 1 && (
                  <span className="ml-0.5 inline-block h-4 w-1 translate-y-0.5 animate-pulse rounded-full bg-primary align-baseline" />
                )}
              </p>
            ))}
          </div>
        )}
        {attachedFiles.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {attachedFiles.map((file) => (
              <span
                key={file.id}
                className={`max-w-full rounded-full px-2 py-1 text-xs font-semibold ${isUser ? "bg-white/10 text-white" : "bg-blue-50 text-blue-700"}`}
              >
                <span className="inline-block max-w-[240px] truncate align-bottom">{file.name}</span>
              </span>
            ))}
          </div>
        )}
        {!isUser && !isPendingAssistant && citations.length > 0 && (
          <div className="mt-3 space-y-2">
            <p className="text-xs font-bold text-muted">출처</p>
            {citations.map((evidence) => (
              <div key={evidence.id} className="rounded-md border border-hairline-soft bg-surface-soft p-2">
                <p className="text-xs font-bold text-ink">{evidenceTitle(evidence)}</p>
                <p className="mt-1 text-xs leading-5 text-muted">{formatEvidenceMeta(evidence)}</p>
                <p className="mt-1 text-xs leading-5 text-body">{evidence.excerpt}</p>
              </div>
            ))}
          </div>
        )}
        {!isUser && !isPendingAssistant && message.actionItems && message.actionItems.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {message.actionItems.map((action) => (
              <Button
                key={`${message.id}-${action.label}`}
                className="h-9 px-3"
                variant="secondary"
                onClick={() => actionHandler(action)}
              >
                {action.label}
              </Button>
            ))}
          </div>
        )}
        <p className={`mt-2 text-[11px] ${isUser ? "text-white/60" : "text-muted-soft"}`}>{formatMessageTime(message.createdAt)}</p>
      </div>
    </div>
  );
}

function ThinkingIndicator() {
  return (
    <div className="flex items-center gap-2 py-1 text-body-sm text-muted">
      <span>답변을 준비 중입니다</span>
      <span className="flex items-center gap-1" aria-hidden="true">
        <span className="size-1.5 animate-bounce rounded-full bg-muted-soft [animation-delay:-160ms]" />
        <span className="size-1.5 animate-bounce rounded-full bg-muted-soft [animation-delay:-80ms]" />
        <span className="size-1.5 animate-bounce rounded-full bg-muted-soft" />
      </span>
    </div>
  );
}

function formatEvidenceMeta(evidence: EvidenceReference): string {
  const rows = evidence.rowNumbers && evidence.rowNumbers.length > 0 ? `${evidence.rowNumbers.join(", ")}행` : undefined;
  const columns = evidence.columns && evidence.columns.length > 0 ? evidence.columns.join(", ") : undefined;
  const confidence = typeof evidence.confidence === "number" ? `신뢰도 ${Math.round(evidence.confidence * 100)}%` : undefined;
  return [evidence.sourceName ?? evidence.location, evidence.sheetName, rows, columns, confidence].filter(Boolean).join(" · ");
}

function formatMessageTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
}
