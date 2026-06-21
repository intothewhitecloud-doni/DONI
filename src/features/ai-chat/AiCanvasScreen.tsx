"use client";

import { useMemo, useState } from "react";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { SectionTitle } from "../../components/ui/Card";
import { MetricChart } from "../../components/ui/MetricChart";
import { Progress } from "../../components/ui/Progress";
import type { EvidenceReference } from "../../lib/domain/types";
import { usePrototype } from "../../lib/prototype/PrototypeProvider";
import type { AiChatVisualBlock, AiChatVisualTone } from "./aiChatTypes";
import {
  findAiCanvasPromptScenario,
  getAiCanvasFallbackGuide,
  getAiCanvasOverview,
  getFixedAiCanvasScenarios,
  type AiCanvasDetailTable,
  type AiCanvasFallbackGuide,
  type AiCanvasOverview,
  type AiCanvasRecommendation,
  type AiCanvasScenario
} from "./aiCanvasScenarios";

type CanvasAnswer = AiCanvasOverview | AiCanvasScenario;

const AI_CANVAS_BREADCRUMB = "AI 대화 > 분석 캔버스";
const AI_CANVAS_PAGE_TITLE = "샘플 데이터 기반 AI 분석";

type AiCanvasChatTurn =
  | {
      id: string;
      kind: "answer";
      question: string;
      scenario: AiCanvasScenario;
      createdAtLabel: string;
    }
  | {
      id: string;
      kind: "fallback";
      question: string;
      guide: AiCanvasFallbackGuide;
      createdAtLabel: string;
    };

export function AiCanvasScreen() {
  const { state } = usePrototype();
  const scenarios = useMemo(() => getFixedAiCanvasScenarios(state), [state]);
  const overview = useMemo(() => getAiCanvasOverview(state), [state]);
  const fallbackGuide = useMemo(() => getAiCanvasFallbackGuide(state), [state]);
  const [chatTurns, setChatTurns] = useState<AiCanvasChatTurn[]>([]);
  const [draft, setDraft] = useState("");

  if (scenarios.length === 0) {
    return (
      <div className="mx-auto flex min-h-[calc(100vh-7rem)] w-full max-w-[1280px] flex-col gap-5 pb-12 text-ink">
        <AiCanvasPageHeader />
        <section className="rounded-lg border border-hairline bg-white p-6 shadow-soft">
          <p className="font-bold text-ink">표시할 AI 샘플 시나리오가 없습니다.</p>
        </section>
      </div>
    );
  }

  function submitQuestion(question: string) {
    const trimmedQuestion = question.trim();
    if (!trimmedQuestion) {
      return;
    }

    const matchedScenario = findAiCanvasPromptScenario(trimmedQuestion, state);
    const createdAtLabel = new Intl.DateTimeFormat("ko-KR", {
      hour: "2-digit",
      minute: "2-digit"
    }).format(new Date());

    const turn: AiCanvasChatTurn = matchedScenario
      ? {
          id: `${matchedScenario.id}-${Date.now()}`,
          kind: "answer",
          question: trimmedQuestion,
          scenario: matchedScenario,
          createdAtLabel
        }
      : {
          id: `fallback-${Date.now()}`,
          kind: "fallback",
          question: trimmedQuestion,
          guide: fallbackGuide,
          createdAtLabel
        };

    setChatTurns((currentTurns) => [turn, ...currentTurns]);
    setDraft("");
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-7rem)] w-full max-w-[1280px] flex-col gap-5 pb-48 text-ink">
      <AiCanvasPageHeader />

      {chatTurns.length > 0 && (
        <section className="space-y-4" aria-label="AI 대화 결과">
          {chatTurns.map((turn) =>
            turn.kind === "answer" ? (
              <AnswerTurnCard key={turn.id} turn={turn} />
            ) : (
              <FallbackTurnCard key={turn.id} onPrompt={submitQuestion} turn={turn} />
            )
          )}
        </section>
      )}

      <OverviewCanvas overview={overview} />

      <FloatingComposer
        draft={draft}
        onDraftChange={setDraft}
        onSubmit={submitQuestion}
        scenarios={scenarios}
      />
    </div>
  );
}

function AiCanvasPageHeader() {
  return (
    <header className="space-y-3">
      <SectionTitle
        eyebrow={AI_CANVAS_BREADCRUMB}
        title={AI_CANVAS_PAGE_TITLE}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="neutral">사용 가이드</Badge>
        <Badge tone="info">AI 대화 히스토리</Badge>
      </div>
    </header>
  );
}

function OverviewCanvas({ overview }: { overview: AiCanvasOverview }) {
  return (
    <section className="grid gap-4">
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
        <div className="rounded-lg border border-hairline-soft bg-white p-4 shadow-soft">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-title-md text-ink">{overview.title}</h2>
            <Badge tone="success">추천한 AI</Badge>
            <Badge tone="info">{overview.sampleDataLabel}</Badge>
          </div>
          <p className="mt-2 text-body-sm font-semibold leading-6 text-muted">{overview.subtitle}</p>
          <div className="mt-4 space-y-2">
            {overview.summary.map((item) => (
              <p key={item} className="text-body-sm leading-6 text-body">{item}</p>
            ))}
          </div>
          <p className="mt-3 text-body-sm font-bold leading-6 text-brand-accent">
            따라서 현재 화면은 특정 질문 배지의 선택 상태가 아니라, 전체 샘플 데이터에서 먼저 확인할 분석 흐름을 제안합니다.
          </p>
        </div>

        <ConfidencePanel answer={overview} />
      </section>

      <section className="grid gap-4 xl:grid-cols-4">
        {overview.visualBlocks.slice(0, 4).map((block) => (
          <VisualBlockCard key={block.id} block={block} />
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)_minmax(420px,1.2fr)]">
        <KeyEvidence answer={overview} />
        <DetailTable table={overview.detailTable} />
        <RecommendationCards answer={overview} />
      </section>
    </section>
  );
}

function AnswerTurnCard({
  turn
}: {
  turn: Extract<AiCanvasChatTurn, { kind: "answer" }>;
}) {
  return (
    <article className="rounded-lg border border-brand-accent/25 bg-white shadow-[0_18px_44px_rgba(37,99,235,0.12)]">
      <div className="border-b border-hairline-soft bg-brand-accent/5 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-caption font-bold uppercase text-brand-accent">질문</p>
            <h2 className="mt-1 text-title-md text-ink">{turn.question}</h2>
          </div>
          <div className="flex items-center gap-2">
            <Badge tone="neutral">{turn.createdAtLabel}</Badge>
            <Badge tone="info">{turn.scenario.sampleDataLabel}</Badge>
          </div>
        </div>
      </div>

      <div className="space-y-4 p-4">
        <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
          <div className="rounded-lg border border-hairline-soft bg-white p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="success">AI 답변</Badge>
              <Badge tone="neutral">{turn.scenario.shortLabel}</Badge>
            </div>
            <h3 className="mt-3 text-title-md text-ink">{turn.scenario.title}</h3>
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
    </article>
  );
}

function FallbackTurnCard({
  onPrompt,
  turn
}: {
  onPrompt: (question: string) => void;
  turn: Extract<AiCanvasChatTurn, { kind: "fallback" }>;
}) {
  return (
    <article className="rounded-lg border border-hairline-soft bg-white p-4 shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-caption font-bold uppercase text-brand-accent">질문</p>
          <h2 className="mt-1 text-title-md text-ink">{turn.question}</h2>
        </div>
        <Badge tone="neutral">{turn.createdAtLabel}</Badge>
      </div>
      <div className="mt-4 rounded-lg border border-hairline-soft bg-surface-soft p-4">
        <Badge tone="warning">샘플 범위 안내</Badge>
        <p className="mt-3 text-body-sm leading-6 text-body">{turn.guide.content}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {turn.guide.prompts.map((prompt) => (
            <button
              key={prompt.id}
              className="rounded-full border border-hairline bg-white px-3 py-1.5 text-caption font-bold text-ink transition hover:border-brand-accent hover:text-brand-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              type="button"
              onClick={() => onPrompt(prompt.prompt)}
            >
              {prompt.label}
            </button>
          ))}
        </div>
      </div>
    </article>
  );
}

function FloatingComposer({
  draft,
  onDraftChange,
  onSubmit,
  scenarios
}: {
  draft: string;
  onDraftChange: (value: string) => void;
  onSubmit: (question: string) => void;
  scenarios: AiCanvasScenario[];
}) {
  return (
    <section className="fixed bottom-4 left-[var(--shell-content-left)] right-[var(--shell-content-right)] z-30" aria-label="AI 질문 입력">
      <form
        className="mx-auto w-full max-w-[var(--shell-content-max)] rounded-lg border border-hairline bg-white/95 p-3 shadow-[0_18px_46px_rgba(15,23,42,0.18)] backdrop-blur"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit(draft);
        }}
      >
        <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
          {scenarios.map((scenario) => (
            <button
              key={scenario.id}
              className="shrink-0 rounded-full border border-hairline bg-white px-3 py-1.5 text-caption font-bold text-ink transition hover:border-brand-accent hover:bg-brand-accent/5 hover:text-brand-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              type="button"
              onClick={() => onSubmit(scenario.prompt)}
            >
              {scenario.shortLabel}
            </button>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-[40px_minmax(0,1fr)_150px]">
          <span className="flex size-10 items-center justify-center rounded-md border border-brand-accent/30 bg-brand-accent/10 text-title-sm font-black text-brand-accent">AI</span>
          <input
            aria-label="AI 질문 입력"
            className="h-10 min-w-0 rounded-md border border-hairline bg-canvas px-4 text-body-sm text-ink outline-none transition focus:border-brand-accent"
            placeholder="4개 샘플 질문을 입력하거나 위 배지를 선택하세요"
            value={draft}
            onChange={(event) => onDraftChange(event.target.value)}
          />
          <Button className="h-10" type="submit">분석 요청</Button>
        </div>
      </form>
    </section>
  );
}

function ConfidencePanel({ answer }: { answer: CanvasAnswer }) {
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
        <Badge tone="neutral">샘플 표</Badge>
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
