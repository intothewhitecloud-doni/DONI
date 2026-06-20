"use client";

import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from "react";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { MetricChart } from "../../components/ui/MetricChart";
import type { Role } from "../../lib/domain/types";
import type { AiChatMessage, AiChatVisualBlock, AiChatVisualTone } from "./aiChatTypes";
import { aiChatScenarios } from "./aiChatScenarios";
import { usePrototype } from "../../lib/prototype/PrototypeProvider";
import { useAiChat } from "./AiChatProvider";

const CHAT_PANEL_TRANSITION_MS = 360;

export function AiChatDock() {
  const chat = useAiChat();
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [panelMounted, setPanelMounted] = useState(chat.isOpen);
  const [panelVisible, setPanelVisible] = useState(chat.isOpen);
  const [submittedFeedbackIds, setSubmittedFeedbackIds] = useState<Set<string>>(() => new Set());

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

  function handleClearMessages() {
    setSubmittedFeedbackIds(new Set());
    chat.clearMessages();
  }

  function handleFeedback(messageId: string) {
    setSubmittedFeedbackIds((current) => {
      if (current.has(messageId)) {
        return current;
      }

      const next = new Set(current);
      next.add(messageId);
      return next;
    });
  }

  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey) {
      return;
    }

    event.preventDefault();
    chat.submitQuestion();
  }

  function handleFileInputChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.currentTarget.files ?? []);
    chat.attachFiles(files);
    event.currentTarget.value = "";
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
                <Button className="h-9 px-3" disabled={chat.messages.length === 0} variant="ghost" onClick={handleClearMessages}>
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
                    <ChatMessageBubble
                      key={message.id}
                      feedbackSubmitted={submittedFeedbackIds.has(message.id)}
                      message={message}
                      onFeedback={handleFeedback}
                    />
                  ))}
                  {chat.pendingAssistant && (
                    <ChatMessageBubble
                      key={chat.pendingAssistant.id}
                      isPendingAssistant
                      message={chat.pendingAssistant}
                      feedbackSubmitted={submittedFeedbackIds.has(chat.pendingAssistant.id)}
                      onFeedback={handleFeedback}
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

              <div className="relative rounded-md border border-hairline bg-white p-2 shadow-sm">
                <input ref={fileInputRef} className="hidden" type="file" multiple onChange={handleFileInputChange} />
                <button
                  aria-label="파일 첨부"
                  className="absolute right-2 top-2 z-10 flex size-8 items-center justify-center rounded-md border border-hairline-soft bg-surface-soft text-title-sm text-ink transition hover:bg-blue-50 hover:text-brand-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={Boolean(chat.pendingAssistant)}
                  title="파일 첨부"
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <PlusIcon />
                </button>
                {chat.attachments.length > 0 && (
                  <div className="mb-2 flex flex-wrap gap-1.5 pr-10">
                    {chat.attachments.map((file) => (
                      <button
                        key={file.id}
                        className="max-w-full rounded-full border border-blue-200 bg-blue-50 px-2 py-1 text-left text-xs font-semibold text-blue-700"
                        type="button"
                        onClick={() => chat.detachFile(file.id)}
                        title="첨부 해제"
                      >
                        <span className="inline-block max-w-[240px] truncate align-bottom">{file.name}</span> x
                      </button>
                    ))}
                  </div>
                )}
                <textarea
                  className="max-h-32 min-h-20 w-full resize-none border-0 bg-transparent px-1 py-1 pr-10 text-body-sm text-ink outline-none placeholder:text-muted-soft"
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
  feedbackSubmitted,
  isPendingAssistant = false,
  message,
  onFeedback
}: {
  feedbackSubmitted: boolean;
  isPendingAssistant?: boolean;
  message: AiChatMessage;
  onFeedback: (messageId: string) => void;
}) {
  const { state } = usePrototype();
  const isUser = message.role === "user";
  const feedbackLabel = feedbackActionLabel(state.session.role);
  const feedbackCompleteLabel = feedbackSubmitted ? feedbackStatusLabel(state.session.role) : "";
  const attachedFiles = message.attachments ?? [];
  const visualBlocks = !isUser && !isPendingAssistant ? message.visualBlocks ?? [] : [];

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
        {visualBlocks.length > 0 && <ChatVisualBlocks blocks={visualBlocks} />}
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
        {!isUser && !isPendingAssistant && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button
              className="h-9 px-3"
              disabled={feedbackSubmitted}
              variant="secondary"
              onClick={() => onFeedback(message.id)}
            >
              {feedbackLabel}
            </Button>
            {feedbackCompleteLabel && (
              <span aria-live="polite" className="text-xs font-semibold text-success" role="status">
                {feedbackCompleteLabel}
              </span>
            )}
          </div>
        )}
        <p className={`mt-2 text-[11px] ${isUser ? "text-white/60" : "text-muted-soft"}`}>{formatMessageTime(message.createdAt)}</p>
      </div>
    </div>
  );
}

function ChatVisualBlocks({ blocks }: { blocks: AiChatVisualBlock[] }) {
  return (
    <div className="mt-3 space-y-3">
      {blocks.map((block) => <ChatVisualBlock block={block} key={block.id} />)}
    </div>
  );
}

function ChatVisualBlock({ block }: { block: AiChatVisualBlock }) {
  if (block.type === "metric_chart") {
    return (
      <section aria-label={block.title} className="min-w-0 overflow-hidden rounded-md border border-hairline-soft bg-surface-soft px-3 py-3">
        <div className="flex min-w-0 items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-bold text-ink">{block.title}</h3>
            {block.description && <p className="mt-1 text-xs leading-5 text-muted">{block.description}</p>}
          </div>
          <Badge className="mt-0.5" tone={metricStatusTone(block.status)}>
            {metricStatusLabel(block.status)}
          </Badge>
        </div>
        {block.points.length > 0 ? (
          <MetricChart compact chartType={block.chartType} id={block.id} points={block.points} status={block.status} unit={block.unit} />
        ) : (
          <p className="mt-3 rounded-md border border-hairline-soft bg-white px-3 py-2 text-xs font-semibold text-muted">
            표시할 지표 데이터가 없습니다.
          </p>
        )}
      </section>
    );
  }

  return (
    <section aria-label={block.title} className="min-w-0 overflow-hidden rounded-md border border-hairline-soft bg-surface-soft px-3 py-3">
      <div className="min-w-0">
        <h3 className="truncate text-sm font-bold text-ink">{block.title}</h3>
        {block.description && <p className="mt-1 text-xs leading-5 text-muted">{block.description}</p>}
      </div>
      <div className="mt-3 divide-y divide-hairline-soft">
        {block.rows.map((row) => (
          <div className="grid min-w-0 grid-cols-[92px_minmax(0,1fr)] gap-2 py-2 first:pt-0 last:pb-0" key={`${block.id}-${row.label}-${row.value}`}>
            <span className={`flex min-h-7 items-center justify-center overflow-hidden rounded-full border px-2 py-1 text-center text-[11px] font-bold leading-4 ${visualToneClass(row.tone)}`}>
              <span className="max-w-full truncate whitespace-nowrap">{row.label}</span>
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-ink" title={row.value}>{row.value}</p>
              {row.detail && <p className="mt-0.5 text-xs leading-5 text-muted">{row.detail}</p>}
            </div>
          </div>
        ))}
      </div>
    </section>
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

function PlusIcon() {
  return (
    <svg aria-hidden="true" className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
    </svg>
  );
}

function metricStatusTone(status: "normal" | "warning" | "critical"): "success" | "warning" | "danger" {
  if (status === "critical") {
    return "danger";
  }

  if (status === "warning") {
    return "warning";
  }

  return "success";
}

function metricStatusLabel(status: "normal" | "warning" | "critical"): string {
  if (status === "critical") {
    return "위험";
  }

  if (status === "warning") {
    return "주의";
  }

  return "정상";
}

function visualToneClass(tone: AiChatVisualTone = "neutral"): string {
  const classes: Record<AiChatVisualTone, string> = {
    danger: "border-error/40 bg-error/10 text-error",
    info: "border-brand-accent/40 bg-brand-accent/10 text-brand-accent",
    neutral: "border-hairline bg-white text-ink",
    success: "border-success/40 bg-success/10 text-success",
    warning: "border-warning/40 bg-warning/10 text-warning"
  };

  return classes[tone];
}

function formatMessageTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
}

function feedbackActionLabel(role: Role): string {
  return role === "owner" ? "공유하기" : "보고하기";
}

function feedbackStatusLabel(role: Role): string {
  return role === "owner" ? "공유 요청이 접수되었습니다." : "보고 요청이 접수되었습니다.";
}
