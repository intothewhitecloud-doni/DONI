"use client";

import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { SectionTitle } from "../../components/ui/Card";
import { MetricChart } from "../../components/ui/MetricChart";
import { Progress } from "../../components/ui/Progress";
import type { EvidenceReference } from "../../lib/domain/types";
import {
  AI_CANVAS_PENDING_PHASES,
  cancelAiCanvasPendingTurn,
  createAiCanvasPendingTurn,
  hasPendingAiCanvasTurn,
  resolveAiCanvasPendingTurn,
  type AiCanvasConversationTurn,
  type AiCanvasPendingPhase
} from "../../lib/prototype/aiCanvasConversation";
import { usePrototype } from "../../lib/prototype/PrototypeProvider";
import type { AiChatVisualBlock, AiChatVisualTone } from "./aiChatTypes";
import {
  findAiCanvasPromptScenario,
  getAiCanvasFallbackGuide,
  getFixedAiCanvasScenarios,
  type AiCanvasDetailTable,
  type AiCanvasFallbackGuide,
  type AiCanvasRecommendation,
  type AiCanvasScenario
} from "./aiCanvasScenarios";

const AI_CANVAS_PAGE_TITLE = "AI 대화";

const AI_CANVAS_PENDING_PHASE_LABEL: Record<AiCanvasPendingPhase, string> = {
  loading: "질문을 전달하는 중",
  reasoning: "근거 데이터를 확인하는 중",
  generating: "답변 구조를 생성하는 중",
  typing: "답변을 작성하는 중"
};

const AI_CANVAS_PENDING_PHASE_DETAIL: Record<AiCanvasPendingPhase, string> = {
  loading: "선택한 질문을 AI canvas에 전달하고 있습니다.",
  reasoning: "지표, 근거, 연결 정보를 맞춰 보고 있습니다.",
  generating: "요약, 차트, 추천 시나리오를 답변 카드로 조립하고 있습니다.",
  typing: "곧 완성된 답변이 표시됩니다."
};

type AiCanvasChatTurn = AiCanvasConversationTurn<AiCanvasScenario, AiCanvasFallbackGuide>;

export function AiCanvasScreen() {
  const { state } = usePrototype();
  const scenarios = useMemo(() => getFixedAiCanvasScenarios(state), [state]);
  const fallbackGuide = useMemo(() => getAiCanvasFallbackGuide(state), [state]);
  const [chatTurns, setChatTurns] = useState<AiCanvasChatTurn[]>([]);
  const [draft, setDraft] = useState("");
  const pendingTimersRef = useRef<number[]>([]);
  const pendingScrollTurnIdRef = useRef<string | null>(null);
  const userMessageRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const isProcessing = hasPendingAiCanvasTurn(chatTurns);

  useEffect(() => {
    return () => {
      clearPendingTimers(pendingTimersRef.current);
    };
  }, []);

  useEffect(() => {
    const targetTurnId = pendingScrollTurnIdRef.current;
    if (!targetTurnId) {
      return;
    }

    const targetElement = userMessageRefs.current[targetTurnId];
    if (!targetElement) {
      return;
    }

    window.requestAnimationFrame(() => {
      const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      targetElement.scrollIntoView({ behavior: prefersReducedMotion ? "auto" : "smooth", block: "start" });
    });
    pendingScrollTurnIdRef.current = null;
  }, [chatTurns]);

  if (scenarios.length === 0) {
    return (
      <div className="flex min-h-[calc(100vh-7rem)] w-full flex-col gap-5 pb-12 text-ink">
        <AiCanvasPageHeader />
        <section className="rounded-lg border border-hairline bg-white p-6 shadow-soft">
          <p className="font-bold text-ink">표시할 AI 시나리오가 없습니다.</p>
        </section>
      </div>
    );
  }

  function submitQuestion(question: string) {
    const trimmedQuestion = question.trim();
    if (!trimmedQuestion || isProcessing) {
      return;
    }

    const matchedScenario = findAiCanvasPromptScenario(trimmedQuestion, state);
    const createdAtLabel = new Intl.DateTimeFormat("ko-KR", {
      hour: "2-digit",
      minute: "2-digit"
    }).format(new Date());
    const pendingTurnId = `${matchedScenario?.id ?? "fallback"}-${Date.now()}`;

    const pendingTurn = createAiCanvasPendingTurn<AiCanvasScenario, AiCanvasFallbackGuide>({
      id: pendingTurnId,
      question: trimmedQuestion,
      createdAtLabel,
      result: matchedScenario
        ? {
            kind: "answer",
            scenario: matchedScenario
          }
        : {
            kind: "fallback",
            guide: fallbackGuide
          }
    });

    clearPendingTimers(pendingTimersRef.current);
    pendingScrollTurnIdRef.current = pendingTurnId;
    setChatTurns((currentTurns) => [...currentTurns, pendingTurn]);
    setDraft("");
    schedulePendingResolution(pendingTurnId, pendingTimersRef, setChatTurns);
  }

  function cancelPendingAnswer(turnId: string) {
    clearPendingTimers(pendingTimersRef.current);
    setChatTurns((currentTurns) =>
      currentTurns.map((turn) =>
        turn.id === turnId && turn.kind === "pending" ? cancelAiCanvasPendingTurn(turn) : turn
      )
    );
  }

  function registerUserMessageRef(turnId: string) {
    return (element: HTMLDivElement | null) => {
      if (element) {
        userMessageRefs.current[turnId] = element;
      } else {
        delete userMessageRefs.current[turnId];
      }
    };
  }

  return (
    <div className="flex min-h-[calc(100vh-7rem)] w-full flex-col gap-5 pb-44 text-ink">
      <AiCanvasPageHeader />

      <section className="flex min-h-[520px] flex-1 flex-col gap-4 rounded-lg border border-hairline-soft bg-surface-soft p-4 shadow-soft" aria-label="AI 대화">
        {chatTurns.length === 0 ? (
          <EmptyChatMessage />
        ) : (
          chatTurns.map((turn) =>
            turn.kind === "answer" ? (
              <AnswerTurnCard key={turn.id} turn={turn} userMessageRef={registerUserMessageRef(turn.id)} />
            ) : turn.kind === "fallback" ? (
              <FallbackTurnCard disabled={isProcessing} key={turn.id} onPromptSelect={setDraft} turn={turn} userMessageRef={registerUserMessageRef(turn.id)} />
            ) : turn.kind === "pending" ? (
              <PendingTurnCard key={turn.id} onCancel={() => cancelPendingAnswer(turn.id)} turn={turn} userMessageRef={registerUserMessageRef(turn.id)} />
            ) : (
              <CanceledTurnCard key={turn.id} turn={turn} userMessageRef={registerUserMessageRef(turn.id)} />
            )
          )
        )}
      </section>

      <FloatingComposer
        draft={draft}
        disabled={isProcessing}
        onDraftChange={setDraft}
        onPromptSelect={setDraft}
        onSubmit={submitQuestion}
        scenarios={scenarios}
      />
    </div>
  );
}

function clearPendingTimers(timers: number[]) {
  timers.forEach((timer) => window.clearTimeout(timer));
  timers.length = 0;
}

function schedulePendingResolution(
  pendingTurnId: string,
  pendingTimersRef: MutableRefObject<number[]>,
  setChatTurns: Dispatch<SetStateAction<AiCanvasChatTurn[]>>
) {
  const phaseSchedule: Array<{ delay: number; phase: AiCanvasPendingPhase }> = [
    { delay: 520, phase: "reasoning" },
    { delay: 1180, phase: "generating" },
    { delay: 1880, phase: "typing" }
  ];

  phaseSchedule.forEach(({ delay, phase }) => {
    pendingTimersRef.current.push(
      window.setTimeout(() => {
        setChatTurns((currentTurns) =>
          currentTurns.map((turn) =>
            turn.id === pendingTurnId && turn.kind === "pending"
              ? {
                  ...turn,
                  phase
                }
              : turn
          )
        );
      }, delay)
    );
  });

  pendingTimersRef.current.push(
    window.setTimeout(() => {
      setChatTurns((currentTurns) =>
        currentTurns.map((turn) => {
          if (turn.id !== pendingTurnId || turn.kind !== "pending") {
            return turn;
          }

          return resolveAiCanvasPendingTurn(turn);
        })
      );
      clearPendingTimers(pendingTimersRef.current);
    }, 2600)
  );
}

function AiCanvasPageHeader() {
  return (
    <header>
      <SectionTitle title={AI_CANVAS_PAGE_TITLE} />
    </header>
  );
}

function EmptyChatMessage() {
  return (
    <div className="flex items-start gap-3">
      <ChatAvatar label="AI" tone="assistant" />
      <div className="max-w-3xl rounded-lg border border-hairline-soft bg-white px-4 py-3 shadow-sm">
        <p className="text-body-sm leading-6 text-body">운영 데이터에서 무엇을 확인할까요?</p>
      </div>
    </div>
  );
}

function AnswerTurnCard({
  turn,
  userMessageRef
}: {
  turn: Extract<AiCanvasChatTurn, { kind: "answer" }>;
  userMessageRef: (element: HTMLDivElement | null) => void;
}) {
  return (
    <article className="space-y-3">
      <UserChatMessage createdAtLabel={turn.createdAtLabel} question={turn.question} userMessageRef={userMessageRef} />
      <div className="flex items-start gap-3">
        <ChatAvatar label="AI" tone="assistant" />
        <div className="ai-canvas-card-in min-w-0 flex-1 rounded-lg border border-brand-accent/25 bg-white shadow-[0_18px_44px_rgba(37,99,235,0.12)]">
          <div className="space-y-4 p-4">
            <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
              <div className="rounded-lg border border-hairline-soft bg-white p-4">
                <h3 className="text-title-md text-ink">{turn.scenario.title}</h3>
                <p className="mt-2 text-body-sm font-semibold leading-6 text-muted">{turn.scenario.subtitle}</p>
                <div className="mt-4 space-y-2">
                  {turn.scenario.summary.map((item) => (
                    <p key={item} className="text-body-sm leading-6 text-body">{item}</p>
                  ))}
                </div>
              </div>

              <ConfidencePanel answer={turn.scenario} />
            </section>

            <MetricSummaryRibbon scenario={turn.scenario} />

            <section className="grid gap-4 xl:grid-cols-4">
              {turn.scenario.visualBlocks.slice(0, 4).map((block) => (
                <VisualBlockCard key={`${turn.id}-${block.id}`} block={block} />
              ))}
            </section>

            <section className="grid gap-4 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)_minmax(420px,1.2fr)]">
              <KeyEvidence answer={turn.scenario} />
              <DetailTable table={turn.scenario.detailTable} />
              <RecommendationCards answer={turn.scenario} />
            </section>
          </div>
        </div>
      </div>
    </article>
  );
}

function FallbackTurnCard({
  disabled,
  onPromptSelect,
  turn,
  userMessageRef
}: {
  disabled: boolean;
  onPromptSelect: (question: string) => void;
  turn: Extract<AiCanvasChatTurn, { kind: "fallback" }>;
  userMessageRef: (element: HTMLDivElement | null) => void;
}) {
  return (
    <article className="space-y-3">
      <UserChatMessage createdAtLabel={turn.createdAtLabel} question={turn.question} userMessageRef={userMessageRef} />
      <div className="flex items-start gap-3">
        <ChatAvatar label="AI" tone="assistant" />
        <div className="ai-canvas-card-in min-w-0 flex-1 rounded-lg border border-hairline-soft bg-white p-4 shadow-sm">
          <Badge tone="warning">분석 범위 안내</Badge>
          <p className="mt-3 text-body-sm leading-6 text-body">{turn.guide.content}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {turn.guide.prompts.map((prompt) => (
              <button
                key={prompt.id}
                className="max-w-full truncate rounded-full border border-hairline bg-white px-3 py-1.5 text-caption font-bold text-ink transition hover:border-brand-accent hover:text-brand-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-45"
                disabled={disabled}
                type="button"
                onClick={() => onPromptSelect(prompt.prompt)}
              >
                {prompt.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </article>
  );
}

function PendingTurnCard({
  onCancel,
  turn,
  userMessageRef
}: {
  onCancel: () => void;
  turn: Extract<AiCanvasChatTurn, { kind: "pending" }>;
  userMessageRef: (element: HTMLDivElement | null) => void;
}) {
  return (
    <article className="space-y-3">
      <UserChatMessage createdAtLabel={turn.createdAtLabel} question={turn.question} userMessageRef={userMessageRef} />
      <div className="flex items-start gap-3">
        <ChatAvatar label="AI" tone="assistant" />
        <div className="ai-canvas-card-in min-w-0 flex-1 rounded-lg border border-brand-accent/25 bg-white p-4 shadow-[0_18px_44px_rgba(37,99,235,0.1)]" role="region" aria-label="AI 답변 생성 상태">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2" role="status" aria-live="polite">
              <Badge tone="info">AI 생성 중</Badge>
              <span className="text-caption font-bold text-brand-accent">{AI_CANVAS_PENDING_PHASE_LABEL[turn.phase]}</span>
              <TypingDots />
            </div>
            <Button aria-label="AI 답변 생성 취소" className="h-8 px-3 text-caption" onClick={onCancel} type="button" variant="secondary">취소</Button>
          </div>
          <p className="mt-3 text-body-sm leading-6 text-body">{AI_CANVAS_PENDING_PHASE_DETAIL[turn.phase]}</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-4">
            {AI_CANVAS_PENDING_PHASES.map((phase) => (
              <div
                key={phase}
                className={`rounded-md border px-3 py-2 text-caption font-bold ${
                  phase === turn.phase ? "border-brand-accent bg-brand-accent/5 text-brand-accent" : "border-hairline-soft bg-surface-soft text-muted"
                }`}
              >
                {AI_CANVAS_PENDING_PHASE_LABEL[phase]}
              </div>
            ))}
          </div>
          <TypingPreview />
        </div>
      </div>
    </article>
  );
}

function TypingPreview() {
  return (
    <div className="mt-4 space-y-2" aria-hidden="true">
      <div className="ai-canvas-typing-line h-2.5 w-full rounded-full" />
      <div className="ai-canvas-typing-line h-2.5 w-10/12 rounded-full" />
      <div className="ai-canvas-typing-line h-2.5 w-7/12 rounded-full" />
    </div>
  );
}

function CanceledTurnCard({
  turn,
  userMessageRef
}: {
  turn: Extract<AiCanvasChatTurn, { kind: "canceled" }>;
  userMessageRef: (element: HTMLDivElement | null) => void;
}) {
  return (
    <article className="space-y-3">
      <UserChatMessage createdAtLabel={turn.createdAtLabel} question={turn.question} userMessageRef={userMessageRef} />
      <div className="flex items-start gap-3">
        <ChatAvatar label="AI" tone="assistant" />
        <div className="ai-canvas-card-in min-w-0 flex-1 rounded-lg border border-hairline-soft bg-white p-4 shadow-sm" role="status" aria-live="polite">
          <Badge tone="neutral">생성 취소</Badge>
          <p className="mt-3 text-body-sm font-semibold leading-6 text-body">취소됐습니다.</p>
        </div>
      </div>
    </article>
  );
}

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1" aria-hidden="true">
      <span className="size-1.5 animate-pulse rounded-full bg-brand-accent motion-reduce:animate-none" />
      <span className="size-1.5 animate-pulse rounded-full bg-brand-accent [animation-delay:120ms] motion-reduce:animate-none" />
      <span className="size-1.5 animate-pulse rounded-full bg-brand-accent [animation-delay:240ms] motion-reduce:animate-none" />
    </span>
  );
}

function UserChatMessage({
  createdAtLabel,
  question,
  userMessageRef
}: {
  createdAtLabel: string;
  question: string;
  userMessageRef?: (element: HTMLDivElement | null) => void;
}) {
  return (
    <div className="flex scroll-mt-5 items-start justify-end gap-3" ref={userMessageRef}>
      <div className="min-w-0 max-w-[min(42rem,calc(100%-3rem))] rounded-lg bg-primary px-4 py-3 text-on-primary shadow-sm">
        <p className="break-words text-body-sm leading-6">{question}</p>
        <p className="mt-2 text-right text-[11px] font-semibold text-on-primary/70">{createdAtLabel}</p>
      </div>
      <ChatAvatar label="나" tone="user" />
    </div>
  );
}

function ChatAvatar({ label, tone }: { label: string; tone: "assistant" | "user" }) {
  return (
    <span
      className={`flex size-9 shrink-0 items-center justify-center rounded-md text-caption font-black shadow-sm ${
        tone === "assistant"
          ? "border border-brand-accent/30 bg-brand-accent/10 text-brand-accent"
          : "bg-surface-dark text-white"
      }`}
    >
      {label}
    </span>
  );
}

function FloatingComposer({
  disabled,
  draft,
  onDraftChange,
  onPromptSelect,
  onSubmit,
  scenarios
}: {
  disabled: boolean;
  draft: string;
  onDraftChange: (value: string) => void;
  onPromptSelect: (question: string) => void;
  onSubmit: (question: string) => void;
  scenarios: AiCanvasScenario[];
}) {
  return (
    <section className="fixed bottom-4 left-[var(--shell-content-left)] right-[var(--shell-content-right)] z-30" aria-label="AI 질문 입력">
      <form
        aria-busy={disabled}
        className="w-full rounded-lg border border-hairline bg-white/95 p-3 shadow-[0_18px_46px_rgba(15,23,42,0.18)] backdrop-blur"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit(draft);
        }}
      >
        <div className="mb-3 flex gap-2 overflow-x-auto pb-1" aria-label="빠른 질문">
          {scenarios.map((scenario) => (
            <button
              key={scenario.id}
              className="max-w-[14rem] shrink-0 truncate rounded-full border border-hairline bg-white px-3 py-1.5 text-caption font-bold text-ink transition hover:border-brand-accent hover:bg-brand-accent/5 hover:text-brand-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-45"
              disabled={disabled}
              type="button"
              onClick={() => onPromptSelect(scenario.prompt)}
            >
              {scenario.shortLabel}
            </button>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-[40px_minmax(0,1fr)_150px]">
          <span className="flex size-10 items-center justify-center rounded-md border border-brand-accent/30 bg-brand-accent/10 text-title-sm font-black text-brand-accent">AI</span>
          <input
            aria-label="AI 질문 입력"
            className="h-10 min-w-0 rounded-md border border-hairline bg-canvas px-4 text-body-sm text-ink outline-none transition focus:border-brand-accent disabled:bg-surface-soft disabled:text-muted"
            disabled={disabled}
            placeholder={disabled ? "답변 생성 중입니다" : "메시지를 입력하세요"}
            value={draft}
            onChange={(event) => onDraftChange(event.target.value)}
          />
          <Button className="h-10" disabled={disabled || !draft.trim()} type="submit">전송</Button>
        </div>
      </form>
    </section>
  );
}

function ConfidencePanel({ answer }: { answer: AiCanvasScenario }) {
  return (
    <aside className="rounded-lg border border-hairline-soft bg-white p-4 shadow-soft">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-md border border-brand-accent/30 bg-brand-accent/10 text-title-sm font-black text-brand-accent">근</span>
        <div className="min-w-0">
          <h2 className="text-title-sm text-ink">근거 기반 설명</h2>
          <p className="mt-1 text-caption leading-5 text-muted">데이터와 지표를 기반으로 분석 결과를 제공합니다.</p>
        </div>
      </div>
      <div className="mt-4 space-y-2">
        <div className="flex items-center justify-between text-caption font-bold">
          <span className="text-muted">신뢰도</span>
          <span className="text-ink">{Math.round(answer.confidence * 100)}%</span>
        </div>
        <Progress value={answer.confidence * 100} />
        <p className="text-caption text-muted">{answer.confidenceLabel}</p>
      </div>
    </aside>
  );
}

function MetricSummaryRibbon({ scenario }: { scenario: AiCanvasScenario }) {
  return (
    <section className="grid gap-3 md:grid-cols-3">
      {scenario.metricSummaries.slice(0, 3).map((metric) => (
        <article key={metric.id} className="rounded-lg border border-hairline-soft bg-surface-soft p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-caption font-bold text-muted">{metric.label}</p>
            <Badge tone={badgeTone(metric.tone)}>{metric.tone === "danger" ? "위험" : metric.tone === "warning" ? "주의" : "확인"}</Badge>
          </div>
          <p className="mt-2 text-title-md text-ink">{metric.value}</p>
          <p className="mt-1 text-caption leading-5 text-muted">{metric.detail}</p>
        </article>
      ))}
    </section>
  );
}

function VisualBlockCard({ block }: { block: AiChatVisualBlock }) {
  if (block.type === "metric_chart") {
    return (
      <article className="min-w-0 rounded-lg border border-hairline-soft bg-white p-4 shadow-soft">
        <div className="flex min-w-0 items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate text-title-sm text-ink">{block.title}</h3>
            {block.description && <p className="mt-1 line-clamp-2 text-caption leading-5 text-muted">{block.description}</p>}
          </div>
          <Badge tone={block.status === "critical" ? "danger" : block.status === "warning" ? "warning" : "success"}>
            {block.status === "critical" ? "위험" : block.status === "warning" ? "주의" : "정상"}
          </Badge>
        </div>
        <MetricChart compact chartType={block.chartType} id={block.id} points={block.points} status={block.status} unit={block.unit} />
      </article>
    );
  }

  return (
    <article className="min-w-0 rounded-lg border border-hairline-soft bg-white p-4 shadow-soft">
      <h3 className="truncate text-title-sm text-ink">{block.title}</h3>
      {block.description && <p className="mt-1 text-caption leading-5 text-muted">{block.description}</p>}
      <div className="mt-3 space-y-2">
        {block.rows.map((row) => (
          <div key={`${block.id}-${row.label}`} className="grid grid-cols-[68px_minmax(0,1fr)] gap-2 rounded-md border border-hairline-soft bg-surface-soft px-2 py-2">
            <Badge tone={badgeTone(row.tone ?? "neutral")}>{row.label}</Badge>
            <div className="min-w-0">
              <p className="truncate text-caption font-bold text-ink">{row.value}</p>
              {row.detail && <p className="mt-0.5 text-[11px] leading-4 text-muted">{row.detail}</p>}
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}

function KeyEvidence({ answer }: { answer: { keyFindings: string[]; evidence: EvidenceReference[] } }) {
  return (
    <section className="rounded-lg border border-hairline-soft bg-white p-4 shadow-soft">
      <h2 className="text-title-sm text-ink">핵심 근거</h2>
      <ul className="mt-3 space-y-2">
        {answer.keyFindings.map((finding) => (
          <li key={finding} className="rounded-md border border-brand-accent/20 bg-brand-accent/5 px-3 py-2 text-body-sm font-semibold leading-6 text-ink">
            {finding}
          </li>
        ))}
      </ul>
      <div className="mt-4 space-y-2 border-t border-hairline-soft pt-3">
        {answer.evidence.slice(0, 4).map((evidence) => (
          <div key={evidence.id} className="rounded-md bg-surface-soft px-3 py-2">
            <p className="text-caption font-bold text-ink">{evidence.label}</p>
            <p className="mt-1 text-[11px] leading-4 text-muted">{evidence.sourceName ?? evidence.sourceFileId} · {evidence.location}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function DetailTable({ table }: { table: AiCanvasDetailTable }) {
  return (
    <section className="min-w-0 rounded-lg border border-hairline-soft bg-white p-4 shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-title-sm text-ink">{table.title}</h2>
          <p className="mt-1 text-caption text-muted">{table.caption}</p>
        </div>
        <Badge tone="neutral">분석 표</Badge>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[520px] border-separate border-spacing-0 text-left text-caption">
          <thead>
            <tr>
              {table.columns.map((column) => (
                <th key={column} className="border-b border-hairline bg-surface-soft px-3 py-2 font-bold text-muted first:rounded-l-md last:rounded-r-md">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row) => (
              <tr key={row.id}>
                {row.cells.map((cell, index) => (
                  <td key={`${row.id}-${index}`} className="border-b border-hairline-soft px-3 py-3 font-semibold text-ink">
                    {index === 0 ? <Badge tone={badgeTone(row.tone ?? "neutral")}>{cell}</Badge> : cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function RecommendationCards({ answer }: { answer: { recommendations: AiCanvasRecommendation[] } }) {
  return (
    <section className="rounded-lg border border-hairline-soft bg-white p-4 shadow-soft">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-title-sm text-ink">AI 추천 시나리오</h2>
        <Badge tone="info">시나리오 설명</Badge>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        {answer.recommendations.map((item, index) => (
          <article
            key={item.id}
            className={`rounded-lg border p-3 ${
              index === 1 ? "border-brand-accent bg-brand-accent/5 ring-1 ring-brand-accent" : "border-hairline-soft bg-white"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-bold text-ink">{item.title}</p>
                <p className="mt-1 text-caption leading-5 text-muted">{item.description}</p>
              </div>
              {index === 1 && <Badge tone="info">추천</Badge>}
            </div>
            <p className="mt-3 text-title-sm text-brand-accent">{item.impact}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function badgeTone(tone: AiChatVisualTone) {
  if (tone === "danger") {
    return "danger";
  }
  if (tone === "warning") {
    return "warning";
  }
  if (tone === "success") {
    return "success";
  }
  if (tone === "info") {
    return "info";
  }
  return "neutral";
}
