"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card, SectionTitle } from "../../components/ui/Card";
import { Progress } from "../../components/ui/Progress";
import { workflowsHaveSelectedMetrics } from "../../lib/domain/result-scenarios";
import type { CandidateType, EvidenceReference, ExtractionCandidate } from "../../lib/domain/types";
import { demoAccounts } from "../../lib/prototype/authAccounts";
import {
  buildCandidateSelectionDefaults,
  emptyCandidateSelection,
  rowsForReviewStep,
  type CandidateSelectionMap
} from "../../lib/prototype/candidateReviewSelection";
import { canCurrentUser } from "../../lib/prototype/permissions";
import { evidenceById } from "../../lib/prototype/selectors";
import { usePrototype } from "../../lib/prototype/PrototypeProvider";

type ReviewStep = {
  type: CandidateType;
  label: string;
  description: string;
};

const reviewSteps: ReviewStep[] = [
  {
    type: "managed_object",
    label: "관리 대상 유형",
    description: "기업이 이번 분석에서 관찰할 유형을 선택합니다. 선택한 유형에 속한 관리 대상 인스턴스가 함께 따라옵니다."
  },
  {
    type: "workflow_event",
    label: "업무 흐름",
    description: "선택한 관리 대상과 연결된 업무 흐름을 하나 이상 선택합니다."
  },
  {
    type: "relation",
    label: "연결 관계",
    description: "선택한 관리 대상과 업무 흐름을 설명하는 연결 관계를 선택합니다."
  },
  {
    type: "metric",
    label: "지표",
    description: "대시보드와 의사결정 안건에 반영할 지표를 선택합니다."
  }
];

const homeHighlights = [
  { label: "대상·이벤트 정의", title: "업무 구조 정리" },
  { label: "관계·지표 분석", title: "영향 신호 탐지" },
  { label: "의사결정 검증", title: "안건 실행 추적" }
];

const productPreviewRows = [
  { label: "주요 관리 대상", value: "고객군 · 공급사 · 상품군", tone: "info" as const },
  { label: "업무 흐름", value: "주문 접수 -> 출고 -> 클레임", tone: "neutral" as const },
  { label: "검증 루프", value: "안건 · 투표 · 해시 · 재분석", tone: "success" as const }
];

export function HomeScreen() {
  const { commands } = usePrototype();

  return (
    <main className="min-h-screen bg-canvas px-6 py-8 text-body sm:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-6xl flex-col">
        <header className="flex items-center justify-between gap-4">
          <img src="/assets/logo.svg" alt="DONI" className="h-10 w-auto" />
        </header>

        <section className="grid flex-1 items-center gap-10 py-12 lg:grid-cols-[minmax(0,0.95fr)_minmax(420px,1.05fr)]">
          <div className="min-w-0 space-y-7">
            <Badge tone="info">기업 의사결정 운영 플랫폼</Badge>
            <div className="space-y-4">
              <h1 className="max-w-3xl text-display-lg text-ink md:text-display-xl">DONI 기업 콘솔</h1>
              <p className="max-w-2xl text-title-md text-body">
                기업 데이터를 관리 대상과 업무 이벤트로 정리하고, 연결 관계와 지표 분석을 통해 실행 가능한 의사결정을 안건, 투표, 검증, 재분석까지 연결합니다.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button onClick={() => commands.navigate("login")}>콘솔 접속</Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {homeHighlights.map((item) => (
                <div key={item.label} className="rounded-lg border border-hairline bg-surface-soft p-4">
                  <p className="truncate whitespace-nowrap text-caption text-muted" title={item.label}>{item.label}</p>
                  <p className="mt-2 text-title-sm text-ink">{item.title}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="min-w-0 rounded-lg border border-hairline bg-surface-soft p-4 shadow-soft">
            <div className="rounded-lg border border-hairline-soft bg-canvas">
              <div className="flex items-center justify-between gap-3 border-b border-hairline-soft px-4 py-3">
                <div className="min-w-0">
                  <p className="text-caption text-brand-accent">운영 구조 대시보드</p>
                  <p className="truncate text-title-sm text-ink">넥스트 제조 의사결정 콘솔</p>
                </div>
                <Badge tone="success">검증 가능</Badge>
              </div>
              <div className="grid gap-3 p-4">
                {productPreviewRows.map((row) => (
                  <div key={row.label} className="grid min-w-0 gap-3 rounded-lg border border-hairline-soft bg-white p-4 sm:grid-cols-[160px_minmax(0,1fr)_auto] sm:items-center">
                    <p className="whitespace-nowrap text-caption text-muted">{row.label}</p>
                    <p className="truncate text-title-sm text-ink">{row.value}</p>
                    <Badge tone={row.tone}>연결됨</Badge>
                  </div>
                ))}
              </div>
              <div className="grid gap-3 border-t border-hairline-soft p-4 sm:grid-cols-3">
                <div>
                  <p className="text-caption text-muted">분석 파일</p>
                  <p className="text-title-lg text-ink">12</p>
                </div>
                <div>
                  <p className="text-caption text-muted">후보 항목</p>
                  <p className="text-title-lg text-ink">48</p>
                </div>
                <div>
                  <p className="text-caption text-muted">검증 기록</p>
                  <p className="text-title-lg text-ink">7</p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function AuthLayout({
  badge,
  children,
  description,
  side,
  title
}: {
  badge: string;
  children: ReactNode;
  description: string;
  side: ReactNode;
  title: string;
}) {
  return (
    <main className="min-h-screen bg-canvas px-6 py-10 sm:px-8">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl items-center gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(380px,0.82fr)]">
        <section className="min-w-0 space-y-6">
          <Badge tone="info">{badge}</Badge>
          <div className="space-y-4">
            <h1 className="max-w-3xl text-display-md text-ink md:text-display-lg">{title}</h1>
            <p className="max-w-2xl text-body-md leading-7 text-body">{description}</p>
          </div>
          {side}
        </section>
        <Card className="space-y-4" motion="reveal">
          {children}
        </Card>
      </div>
    </main>
  );
}

function AuthField({
  children,
  label
}: {
  children: ReactNode;
  label: string;
}) {
  return (
    <label className="block text-sm font-medium text-body">
      <span className="whitespace-nowrap">{label}</span>
      {children}
    </label>
  );
}

function authInputClass(hasError = false) {
  return `mt-1 w-full rounded-md border px-3 py-2 text-body-sm text-ink outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 ${
    hasError ? "border-error/50 bg-error/5" : "border-hairline-soft bg-white"
  }`;
}

export function LoginScreen() {
  const { commands, state } = usePrototype();
  const [loginId, setLoginId] = useState("owner01");
  const [password, setPassword] = useState("owner01!");
  const loginFeedback = state.permissionDenied;

  function submit() {
    commands.login(loginId, password);
  }

  return (
    <AuthLayout
      badge="1개 기업 · 1개 콘솔"
      title="기업 코드 기반 승인형 콘솔"
      description="기업 소유자가 승인한 사용자만 접속할 수 있습니다. 승인 전 계정은 로그인 화면에서 승인 대기 안내만 표시됩니다."
      side={
        <div className="rounded-lg border border-hairline bg-surface-soft p-4 text-body-sm shadow-soft">
          <div className="flex items-center justify-between gap-3">
            <p className="font-semibold text-ink">데모 계정</p>
            <Badge tone="neutral">테스트 가능</Badge>
          </div>
          <ul className="mt-3 grid gap-2">
            {demoAccounts.map((account) => (
              <li key={account.loginId}>
                <button
                  className="flex w-full min-w-0 items-center justify-between gap-3 rounded-md border border-hairline-soft bg-white px-3 py-2 text-left transition hover:border-primary/40 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  type="button"
                  onClick={() => {
                    setLoginId(account.loginId);
                    setPassword(account.password);
                  }}
                >
                  <span className="truncate font-semibold text-ink">{account.loginId} / {account.password}</span>
                  <Badge tone={account.role === "owner" ? "success" : "info"}>{account.role === "owner" ? "기업 소유자" : "기업 관리자"}</Badge>
                </button>
              </li>
            ))}
          </ul>
        </div>
      }
    >
      <SectionTitle title="로그인" description="승인 완료된 기업 사용자만 대시보드로 이동합니다." variant="section" />
      {loginFeedback && (
        <div
          aria-live="assertive"
          className="rounded-lg border border-error/30 bg-error/10 px-4 py-3 text-sm font-semibold text-error"
          role="alert"
        >
          {loginFeedback}
        </div>
      )}
      <AuthField label="아이디">
        <input
          aria-invalid={Boolean(loginFeedback)}
          className={authInputClass(Boolean(loginFeedback))}
          value={loginId}
          onChange={(event) => setLoginId(event.target.value)}
        />
      </AuthField>
      <AuthField label="비밀번호">
        <input
          aria-invalid={Boolean(loginFeedback)}
          className={authInputClass(Boolean(loginFeedback))}
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              submit();
            }
          }}
        />
      </AuthField>
      <Button className="w-full" onClick={submit}>로그인</Button>
      <Button variant="secondary" className="w-full" onClick={() => commands.navigate("signup")}>회원가입</Button>
    </AuthLayout>
  );
}

export function SignupScreen() {
  const { commands, state } = usePrototype();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");

  function submit() {
    commands.signup({ code, email, name, password });
  }

  return (
    <AuthLayout
      badge="회사코드 필수"
      title="승인 대기 계정 신청"
      description="기업 콘솔은 기업이 먼저 존재해야 사용자 계정이 존재합니다. 회사코드를 입력해 신청하면 기업 소유자 승인 후 접속할 수 있습니다."
      side={
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-hairline bg-surface-soft p-4">
            <p className="text-caption text-muted">신청 단계</p>
            <p className="mt-2 text-title-sm text-ink">회사코드 확인</p>
          </div>
          <div className="rounded-lg border border-hairline bg-surface-soft p-4">
            <p className="text-caption text-muted">접속 기준</p>
            <p className="mt-2 text-title-sm text-ink">소유자 승인 후 로그인</p>
          </div>
        </div>
      }
    >
      <SectionTitle title="회원가입" description="가입 완료 후 로그인 화면에서 승인 대기 안내가 표시됩니다." variant="section" />
      {state.permissionDenied && <div className="rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning">{state.permissionDenied}</div>}
      <AuthField label="이름">
        <input className={authInputClass()} value={name} onChange={(event) => setName(event.target.value)} />
      </AuthField>
      <AuthField label="이메일">
        <input className={authInputClass()} value={email} onChange={(event) => setEmail(event.target.value)} />
      </AuthField>
      <AuthField label="비밀번호">
        <input className={authInputClass()} type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
      </AuthField>
      <AuthField label="회사코드">
        <input required className={authInputClass()} value={code} onChange={(event) => setCode(event.target.value)} placeholder="예: DONI-NEXT-4821" />
      </AuthField>
      <Button className="w-full" onClick={submit}>승인 요청</Button>
      <Button variant="secondary" className="w-full" onClick={() => commands.navigate("login")}>로그인으로 이동</Button>
    </AuthLayout>
  );
}

export function AnalysisScreen() {
  const { commands, state } = usePrototype();
  const job = state.analysisJobs[0];

  useEffect(() => {
    if (!job || job.status === "reviewing_ready" || job.status === "completed") {
      return;
    }

    const timer = window.setTimeout(commands.advanceAnalysisJob, 650);
    return () => window.clearTimeout(timer);
  }, [commands, job]);

  if (!job) {
    return (
      <section className="space-y-6">
        <SectionTitle
          title="데이터 보관함"
          description="업무 파일을 추가하면 관리 대상과 연결 관계, 지표 근거를 구성할 수 있습니다."
          variant="section"
        />
        <Card className="max-w-4xl space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            {["원본 표 구조 읽기", "후보 생성", "근거 연결"].map((item, index) => (
              <div key={item} className="rounded-lg border border-hairline-soft bg-surface-soft p-4">
                <Badge tone={index === 0 ? "info" : "neutral"}>{index + 1}단계</Badge>
                <p className="mt-3 text-title-sm text-ink">{item}</p>
              </div>
            ))}
          </div>
          <p className="text-sm leading-6 text-muted">
            원본 표 구조 읽기, 관리대상 후보 생성, 업무흐름 후보 생성, 연결 관계 구성, 지표 계산, 인사이트 근거 조합이 순서대로 진행됩니다.
          </p>
          <Button onClick={() => commands.navigate("vault")}>데이터 보관함으로 이동</Button>
        </Card>
      </section>
    );
  }

  return (
    <section className="max-w-4xl space-y-6">
      <SectionTitle
        title="데이터 보관함"
        description="보관함의 파일을 바탕으로 관리 대상, 업무흐름, 연결관계, 지표, 인사이트를 구성합니다."
        variant="section"
      />
      <Card className="space-y-4">
        <div className="flex min-w-0 items-center justify-between gap-3">
          <span className="min-w-0 truncate font-semibold text-ink">{job?.currentStep ?? "분석 준비 중"}</span>
          <Badge tone={job?.status === "reviewing_ready" ? "success" : "info"}>{job?.progress ?? 0}%</Badge>
        </div>
        <Progress value={job?.progress ?? 0} />
        <div className="grid gap-3 sm:grid-cols-4">
          {reviewSteps.map((step) => (
            <div key={step.type} className="rounded-lg border border-hairline-soft bg-surface-soft p-3">
              <p className="truncate text-caption text-muted">{step.label}</p>
              <p className="mt-1 text-title-sm text-ink">구성 중</p>
            </div>
          ))}
        </div>
        <p className="text-sm text-muted">관리대상, 업무흐름, 연결 관계, 지표, 인사이트 근거를 같은 파일 근거로 연결합니다.</p>
      </Card>
    </section>
  );
}

export function ReviewScreen() {
  const { commands, state } = usePrototype();
  const canConfirmCandidates = canCurrentUser(state, "candidate:confirm");
  const canReviewCandidates = canCurrentUser(state, "candidate:review");
  const [reviewStepIndex, setReviewStepIndex] = useState(0);
  const [candidateSelection, setCandidateSelection] = useState<CandidateSelectionMap>(emptyCandidateSelection);
  const [manualExcludedCandidateIds, setManualExcludedCandidateIds] = useState<string[]>([]);
  const [selectionInitialized, setSelectionInitialized] = useState(false);
  const activeStep = reviewSteps[reviewStepIndex];
  const selectedManagedCandidateIds = candidateSelection.managed_object;
  const rows = useMemo(
    () => rowsForReviewStep(state.candidates, activeStep.type, selectedManagedCandidateIds),
    [activeStep.type, selectedManagedCandidateIds, state.candidates]
  );
  const [selectedId, setSelectedId] = useState(rows[0]?.id ?? "");
  const selected = useMemo(() => rows.find((candidate) => candidate.id === selectedId), [rows, selectedId]);
  const [editingCandidateId, setEditingCandidateId] = useState("");
  const [editDraft, setEditDraft] = useState({
    description: "",
    title: ""
  });

  useEffect(() => {
    if (selectionInitialized || state.candidates.length === 0) {
      return;
    }

    setCandidateSelection(buildCandidateSelectionDefaults(state.candidates));
    setSelectionInitialized(true);
  }, [selectionInitialized, state.candidates]);

  useEffect(() => {
    const nextSelectedId = rows[0]?.id ?? "";
    if (!selectedId && nextSelectedId) {
      setSelectedId(nextSelectedId);
      return;
    }

    if (selectedId && !rows.some((candidate) => candidate.id === selectedId)) {
      setSelectedId(nextSelectedId);
    }
  }, [rows, selectedId]);

  useEffect(() => {
    setEditingCandidateId("");
    setEditDraft({
      description: selected?.description ?? "",
      title: selected?.title ?? ""
    });
  }, [selected?.id]);

  const everyWorkflowHasMetric = workflowsHaveSelectedMetrics(candidateSelection.workflow_event, candidateSelection.metric);
  const currentStepReady = activeStep.type === "managed_object"
    ? candidateSelection.managed_object.length > 0
    : activeStep.type === "metric"
    ? candidateSelection.metric.length > 0 && everyWorkflowHasMetric
    : rows.length === 0 || candidateSelection[activeStep.type].length > 0;
  const allStepsReady =
    candidateSelection.managed_object.length > 0 &&
    everyWorkflowHasMetric &&
    reviewSteps
      .filter((step) => step.type !== "managed_object")
      .every((step) => rowsForReviewStep(state.candidates, step.type, candidateSelection.managed_object).length === 0 || candidateSelection[step.type].length > 0);
  const selectedCandidateIds = selectedCandidateIdsFromSelection(candidateSelection);
  const stepProgress = `${reviewStepIndex + 1} / ${reviewSteps.length}`;

  function startCandidateEdit() {
    if (!selected) {
      return;
    }

    setEditingCandidateId(selected.id);
    setEditDraft({
      description: selected.description,
      title: selected.title
    });
  }

  function saveCandidateEdit() {
    if (!selected || !editDraft.title.trim() || !editDraft.description.trim()) {
      return;
    }

    const saved = commands.editCandidate(
      selected.id,
      editDraft.title.trim(),
      "후보 내용을 수정했습니다.",
      editDraft.description.trim()
    );

    if (saved) {
      setEditingCandidateId("");
    }
  }

  function focusCandidate(candidate: ExtractionCandidate) {
    setSelectedId(candidate.id);
  }

  function toggleCandidateInclusion(candidate: ExtractionCandidate) {
    setSelectedId(candidate.id);

    if (candidate.type === "managed_object") {
      setCandidateSelection((current) => {
        const isAlreadySelected = current.managed_object.includes(candidate.id);
        const nextManagedObjectIds = isAlreadySelected
          ? current.managed_object.filter((candidateId) => candidateId !== candidate.id)
          : [...current.managed_object, candidate.id];

        return buildCandidateSelectionDefaults(
          state.candidates,
          { ...current, managed_object: nextManagedObjectIds },
          manualExcludedCandidateIds
        );
      });
      return;
    }

    setCandidateSelection((current) => {
      const currentIds = current[candidate.type];
      const nextIds = currentIds.includes(candidate.id) ? currentIds.filter((id) => id !== candidate.id) : [...currentIds, candidate.id];
      return { ...current, [candidate.type]: nextIds };
    });
    setManualExcludedCandidateIds((current) =>
      candidateSelection[candidate.type].includes(candidate.id)
        ? Array.from(new Set([...current, candidate.id]))
        : current.filter((candidateId) => candidateId !== candidate.id)
    );
  }

  return (
    <section className="space-y-6">
      <SectionTitle
        title="데이터 보관함"
        description="관리 대상 유형은 여러 개를 선택할 수 있고, 이후 선택한 유형에 속한 인스턴스와 관련 업무 흐름, 연결 관계, 지표를 단계적으로 확정합니다."
        variant="section"
      />
      <div className="rounded-lg border border-brand-accent/30 bg-brand-accent/5 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <Badge tone="info">{stepProgress}</Badge>
            <h2 className="mt-3 text-title-lg text-ink">{activeStep.label} 선택</h2>
            <p className="mt-2 text-sm leading-6 text-body">{activeStep.description}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {reviewSteps.map((step, index) => (
              <button
                key={step.type}
                className={`whitespace-nowrap rounded-md border px-3 py-2 text-caption transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
                  index === reviewStepIndex ? "border-brand-accent bg-brand-accent text-white" : "border-hairline bg-white text-muted hover:text-ink"
                }`}
                type="button"
                onClick={() => setReviewStepIndex(index)}
              >
                {step.label}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
          <Card className="space-y-3">
            <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <Badge tone="info">복수 선택</Badge>
                  <h2 className="mt-2 text-lg font-bold text-slate-950">{activeStep.label} 후보</h2>
                </div>
                <span className="text-sm font-semibold text-slate-600">선택 {candidateSelection[activeStep.type].length}개</span>
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-600">{activeStep.description}</p>
              {activeStep.type === "metric" && !everyWorkflowHasMetric && (
                <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">
                  선택한 업무 흐름마다 연결 지표가 하나 이상 필요합니다.
                </p>
              )}
            </div>
            {rows.length > 0 ? (
              rows.map((candidate) => {
                const isIncluded = candidateSelection[candidate.type].includes(candidate.id);
                const isActive = selected?.id === candidate.id;
                return (
                  <div
                    key={candidate.id}
                    className={`relative w-full rounded-md border p-4 text-left transition ${
                      isActive
                        ? "border-brand-accent bg-canvas shadow-soft ring-2 ring-brand-accent ring-offset-2"
                        : isIncluded
                        ? "border-success/40 bg-success/10 shadow-sm"
                        : "border-hairline-soft bg-white hover:border-hairline hover:bg-surface-soft"
                    } ${isIncluded ? "border-l-4 border-l-success" : ""}`}
                  >
                    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
                      <button
                        aria-current={isActive ? "true" : undefined}
                        className="min-w-0 rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                        type="button"
                        onClick={() => focusCandidate(candidate)}
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="font-bold text-slate-950">{candidate.title}</h2>
                          {isActive && (
                            <span className="whitespace-nowrap rounded-full border border-brand-accent bg-brand-accent px-2 py-0.5 text-[11px] font-bold leading-4 text-white">
                              수정 대상
                            </span>
                          )}
                        </div>
                        <p className={`mt-1 text-sm ${isActive ? "text-slate-700" : "text-slate-600"}`}>{candidate.description}</p>
                      </button>
                      <button
                        aria-pressed={isIncluded}
                        className={`inline-flex items-center justify-self-start whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 sm:justify-self-end ${
                          isIncluded ? "border-success bg-success text-white shadow-sm" : "border-hairline bg-surface-card text-ink hover:border-muted"
                        }`}
                        type="button"
                        onClick={() => toggleCandidateInclusion(candidate)}
                      >
                        {isIncluded ? (candidate.type === "managed_object" ? "선택됨" : "포함됨") : "제외 예정"}
                      </button>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="rounded-md border border-dashed border-slate-300 bg-white p-5">
                <p className="font-semibold text-slate-900">연결된 후보가 없습니다</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">이전 단계의 선택을 바꾸면 관련 후보 목록이 다시 구성됩니다.</p>
              </div>
            )}
          </Card>
          <Card className="space-y-4">
            {selected ? (
              <>
                <div>
                  <Badge tone="info">신뢰도 {Math.round(selected.confidence * 100)}%</Badge>
                  <h2 className="mt-3 text-xl font-bold text-slate-950">{selected.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{selected.description}</p>
                </div>
                {selected.edgePreview && (
                  <div className="rounded-md border border-blue-100 bg-blue-50 p-3">
                    <p className="text-xs font-bold text-blue-700">연결 미리보기</p>
                    <p className="mt-2 font-semibold text-slate-950">
                      {selected.edgePreview.fromLabel} → {selected.edgePreview.toLabel}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">{selected.edgePreview.relationType}</p>
                    <p className="mt-1 text-sm text-slate-600">
                      연결 지표: {selected.edgePreview.metricLabels?.join(", ") ?? "아직 없음"}
                    </p>
                  </div>
                )}
                <div className="space-y-2">
                  {selected.evidenceIds.map((evidenceId) => {
                    const evidence = evidenceById(state, evidenceId);
                    return (
                      <div key={evidenceId} className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">
                        <p className="font-semibold text-slate-800">{evidence?.label}</p>
                        <p className="mt-1 text-slate-500">{evidence ? formatReviewEvidenceSource(evidence) : ""}</p>
                        <p className="mt-2 leading-6 text-slate-600">{evidence?.excerpt}</p>
                      </div>
                    );
                  })}
                </div>
                {canReviewCandidates && editingCandidateId === selected.id ? (
                  <div className="space-y-3 rounded-md border border-blue-100 bg-blue-50 p-3">
                    <label className="block text-sm font-semibold text-slate-700">
                      후보명
                      <input
                        className="mt-2 w-full rounded-md border border-slate-200 bg-white px-3 py-2"
                        value={editDraft.title}
                        onChange={(event) => setEditDraft((current) => ({ ...current, title: event.target.value }))}
                      />
                    </label>
                    <label className="block text-sm font-semibold text-slate-700">
                      설명
                      <textarea
                        className="mt-2 min-h-20 w-full rounded-md border border-slate-200 bg-white px-3 py-2"
                        value={editDraft.description}
                        onChange={(event) => setEditDraft((current) => ({ ...current, description: event.target.value }))}
                      />
                    </label>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Button
                        disabled={!editDraft.title.trim() || !editDraft.description.trim()}
                        onClick={saveCandidateEdit}
                      >
                        수정 저장
                      </Button>
                      <Button variant="secondary" onClick={() => setEditingCandidateId("")}>
                        취소
                      </Button>
                    </div>
                  </div>
                ) : canReviewCandidates ? (
                  <div>
                    <Button variant="secondary" onClick={startCandidateEdit}>
                      후보 수정
                    </Button>
                  </div>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" disabled={reviewStepIndex === 0} onClick={() => setReviewStepIndex((current) => Math.max(current - 1, 0))}>
                    이전 단계
                  </Button>
                  {reviewStepIndex < reviewSteps.length - 1 ? (
                    <Button disabled={!currentStepReady} onClick={() => setReviewStepIndex((current) => Math.min(current + 1, reviewSteps.length - 1))}>
                      다음: {reviewSteps[reviewStepIndex + 1].label}
                    </Button>
                  ) : (
                    canConfirmCandidates && (
                      <Button disabled={!allStepsReady} onClick={() => commands.confirmCandidates(selectedCandidateIds)}>
                        선택 후보 확정
                      </Button>
                    )
                  )}
                </div>
              </>
            ) : (
              <p className="text-sm text-slate-600">검토할 후보가 없습니다.</p>
            )}
          </Card>
      </div>
    </section>
  );
}

function formatReviewEvidenceSource(evidence: EvidenceReference): string {
  const sourceKind = evidence.sourceKind === "canonical_sample" ? "보관 파일" : "업로드 파일";
  const rows = evidence.rowNumbers && evidence.rowNumbers.length > 0 ? `${evidence.rowNumbers.join(", ")}행` : undefined;
  const columns = evidence.columns && evidence.columns.length > 0 ? evidence.columns.join(", ") : undefined;
  const confidence = typeof evidence.confidence === "number" ? `신뢰도 ${Math.round(evidence.confidence * 100)}%` : undefined;

  return [sourceKind, evidence.sourceName ?? evidence.location, evidence.sheetName, rows, columns, confidence].filter(Boolean).join(" · ");
}

function selectedCandidateIdsFromSelection(selection: CandidateSelectionMap): string[] {
  return Array.from(new Set(reviewSteps.flatMap((step) => selection[step.type])));
}
