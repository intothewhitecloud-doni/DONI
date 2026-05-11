"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card, SectionTitle } from "../../components/ui/Card";
import { Popup } from "../../components/ui/Popup";
import { Progress } from "../../components/ui/Progress";
import { relatedCandidateIdsByManagedObject, workflowsHaveSelectedMetrics } from "../../lib/domain/result-scenarios";
import type { CandidateType, EvidenceReference, ExtractionCandidate } from "../../lib/domain/types";
import { shouldBlockWorkspaceLeaveForSoleAdmin, willDeleteWorkspaceOnLeave } from "../../lib/domain/state-machine";
import { demoAccounts } from "../../lib/prototype/authAccounts";
import { can, roleLabel } from "../../lib/prototype/permissions";
import { accessibleWorkspaces, evidenceById } from "../../lib/prototype/selectors";
import { usePrototype } from "../../lib/prototype/PrototypeProvider";

type ReviewStep = {
  type: CandidateType;
  label: string;
  description: string;
};

type CandidateSelectionMap = Record<CandidateType, string[]>;

const reviewSteps: ReviewStep[] = [
  {
    type: "managed_object",
    label: "관리 대상",
    description: "조직이 이번 분석에서 함께 관찰할 최상위 분류군을 선택합니다."
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

const emptyCandidateSelection: CandidateSelectionMap = {
  managed_object: [],
  workflow_event: [],
  relation: [],
  metric: []
};

const homeHighlights = [
  { label: "관리 대상과 업무 이벤트 정의", title: "업무 구조 정리" },
  { label: "연결 관계와 지표 분석", title: "영향 신호 탐지" },
  { label: "의사결정 검증 루프", title: "안건 실행 추적" }
];

export function HomeScreen() {
  const { commands } = usePrototype();

  return (
    <main className="min-h-screen bg-slate-950 px-5 py-10 text-white">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-6xl flex-col justify-center gap-10">
        <div className="max-w-3xl space-y-6">
          <Badge tone="info">기업 의사결정 운영 플랫폼</Badge>
          <h1 className="text-display-lg text-white md:text-display-xl">DONI 관리 콘솔</h1>
          <p className="text-body-md text-slate-300 md:text-title-md">
            흩어진 업무 데이터를 관리 대상과 업무 이벤트로 정리하고, 연결 관계와 지표 분석을 통해 실행 가능한 의사결정을
            안건, 투표, 검증, 재분석까지 연결합니다.
          </p>
          <Button variant="secondary" className="border-white bg-white text-slate-950 hover:bg-slate-100" onClick={() => commands.navigate("login")}>
            로그인
          </Button>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {homeHighlights.map((item) => (
            <div key={item.label} className="rounded-lg border border-white/10 bg-white/5 p-5">
              <p className="text-caption text-slate-300">{item.label}</p>
              <p className="mt-2 text-title-lg text-white">{item.title}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}

export function LoginScreen() {
  const { commands } = usePrototype();
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const submit = () => {
    if (commands.login(loginId, password)) {
      setError("");
      return;
    }

    setError("아이디와 비밀번호를 확인해 주세요.");
  };

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-10">
      <div className="mx-auto grid min-h-[calc(100vh-5rem)] max-w-6xl items-center gap-8 lg:grid-cols-[1fr_420px]">
        <div className="space-y-5">
          <Badge tone="info">보안 로그인</Badge>
          <h1 className="text-display-lg text-slate-950">운영 데이터를 의사결정으로 연결합니다</h1>
          <p className="text-body-md text-slate-600">
            계정으로 로그인하면 최초 설정을 거쳐 관리 대상과 업무 이벤트 정의부터 의사결정 검증까지 이어지는 운영 흐름을 확인할 수 있습니다.
          </p>
        </div>
        <Card className="space-y-4">
          <div>
            <h2 className="text-title-lg text-slate-950">로그인</h2>
            <p className="mt-1 text-body-sm text-slate-500">아이디와 비밀번호를 입력해 접속합니다.</p>
          </div>
          <label className="block text-sm font-semibold text-slate-700">
            아이디
            <input className="mt-2 w-full rounded-md border border-slate-200 px-3 py-2" value={loginId} onChange={(event) => setLoginId(event.target.value)} />
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            비밀번호
            <input
              className="mt-2 w-full rounded-md border border-slate-200 px-3 py-2"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  submit();
                }
              }}
            />
          </label>
          {error && <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
          <Button className="w-full" onClick={submit}>로그인</Button>
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-bold text-slate-500">넥스트 제조 그룹 테스트 계정</p>
            <div className="mt-3 grid gap-2 text-xs text-slate-700">
              {demoAccounts.map((account) => (
                <button
                  key={account.loginId}
                  className="grid grid-cols-[80px_1fr] rounded-md bg-white px-3 py-2 text-left transition hover:bg-blue-50"
                  onClick={() => {
                    setLoginId(account.loginId);
                    setPassword(account.password);
                  }}
                >
                  <span className="font-bold text-slate-900">{roleLabel(account.role)}</span>
                  <span>{account.loginId} / {account.password}</span>
                </button>
              ))}
            </div>
          </div>
        </Card>
      </div>
    </main>
  );
}

export function WorkspaceScreen() {
  const { commands, state } = usePrototype();
  const workspaces = accessibleWorkspaces(state);
  const [inviteCode, setInviteCode] = useState("");
  const [modal, setModal] = useState<"create" | "invite" | "">("");
  const [leaveWorkspaceId, setLeaveWorkspaceId] = useState("");
  const [newWorkspace, setNewWorkspace] = useState({
    goal: "",
    industry: "",
    name: ""
  });

  function createWorkspaceFromModal() {
    if (!newWorkspace.name.trim() || !newWorkspace.industry.trim() || !newWorkspace.goal.trim()) {
      return;
    }

    if (commands.createWorkspace(newWorkspace)) {
      setModal("");
      setNewWorkspace({
        goal: "",
        industry: "",
        name: ""
      });
    }
  }

  function confirmLeaveWorkspace() {
    if (leaveWorkspaceId && commands.leaveWorkspace(leaveWorkspaceId)) {
      setLeaveWorkspaceId("");
    }
  }

  const workspaceToLeave = workspaces.find((workspace) => workspace.id === leaveWorkspaceId);
  const leaveDeletesWorkspace = workspaceToLeave ? willDeleteWorkspaceOnLeave(state, workspaceToLeave.id) : false;
  const leaveBlockedBySoleAdmin = workspaceToLeave ? shouldBlockWorkspaceLeaveForSoleAdmin(state, workspaceToLeave.id) : false;

  function moveToOrganizationForSuccession() {
    if (!workspaceToLeave) {
      return;
    }

    if (commands.selectWorkspace(workspaceToLeave.id)) {
      setLeaveWorkspaceId("");
      commands.navigate("organization");
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-10">
      <div className="mx-auto max-w-5xl space-y-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <SectionTitle
            eyebrow="워크스페이스"
            title="접속할 조직 워크스페이스를 선택하세요"
            description="선택한 워크스페이스가 현재 사용자의 조직 경계가 됩니다. 새 조직은 별도로 만들 수 있습니다."
          />
          <div className="flex flex-wrap gap-2">
            {state.session.loggedIn && <Button variant="secondary" onClick={commands.logout}>로그아웃</Button>}
            <Button variant="secondary" onClick={() => setModal("invite")}>초대 코드로 참여</Button>
            <Button onClick={() => setModal("create")}>새 워크스페이스 만들기</Button>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {workspaces.length === 0 ? (
            <Card className="md:col-span-2">
              <div className="space-y-3">
                <Badge tone="neutral">워크스페이스 없음</Badge>
                <h2 className="text-xl font-bold text-slate-950">참여 중인 워크스페이스가 없습니다</h2>
                <p className="text-sm leading-6 text-slate-600">새 워크스페이스를 만들거나 초대 코드로 참여해 조직 작업 공간을 시작하세요.</p>
              </div>
            </Card>
          ) : (
            workspaces.map((workspace) => (
              <Card key={workspace.id}>
                <div className="space-y-3">
                  <Badge tone="info">{workspace.industry}</Badge>
                  <h2 className="text-xl font-bold text-slate-950">{workspace.name}</h2>
                  <p className="text-sm leading-6 text-slate-600">{workspace.decisionGoal}</p>
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={() => commands.selectWorkspace(workspace.id)}>이 워크스페이스로 접속</Button>
                    <Button variant="danger" onClick={() => setLeaveWorkspaceId(workspace.id)}>나가기</Button>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      </div>
      {modal === "create" && (
        <Popup
          eyebrow="워크스페이스"
          title="새 워크스페이스 만들기"
          onClose={() => setModal("")}
          footer={
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setModal("")}>취소</Button>
              <Button
                disabled={!newWorkspace.name.trim() || !newWorkspace.industry.trim() || !newWorkspace.goal.trim()}
                onClick={createWorkspaceFromModal}
              >
                목록에 추가
              </Button>
            </div>
          }
        >
          <p className="text-sm leading-6 text-slate-600">
            회사 맥락과 의사결정 목표를 입력하면 워크스페이스 목록에 추가됩니다. 접속할 조직은 목록에서 직접 선택합니다.
          </p>
          <div className="mt-5 space-y-4">
            <label className="block text-sm font-semibold text-slate-700">
              회사명
              <input
                className="mt-2 w-full rounded-md border border-slate-200 px-3 py-2"
                placeholder="예: 신규 운영 조직"
                value={newWorkspace.name}
                onChange={(event) => setNewWorkspace((current) => ({ ...current, name: event.target.value }))}
              />
            </label>
            <label className="block text-sm font-semibold text-slate-700">
              산업
              <input
                className="mt-2 w-full rounded-md border border-slate-200 px-3 py-2"
                placeholder="예: 제조 및 유통"
                value={newWorkspace.industry}
                onChange={(event) => setNewWorkspace((current) => ({ ...current, industry: event.target.value }))}
              />
            </label>
            <label className="block text-sm font-semibold text-slate-700">
              의사결정 목표
              <textarea
                className="mt-2 min-h-24 w-full rounded-md border border-slate-200 px-3 py-2"
                placeholder="예: 저마진 상품을 줄이고 공급망 지연 리스크를 조기에 발견"
                value={newWorkspace.goal}
                onChange={(event) => setNewWorkspace((current) => ({ ...current, goal: event.target.value }))}
              />
            </label>
          </div>
        </Popup>
      )}
      {modal === "invite" && (
        <Popup
          eyebrow="워크스페이스"
          title="초대 코드로 참여"
          onClose={() => setModal("")}
          footer={
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setModal("")}>취소</Button>
              <Button disabled={!inviteCode.trim()} onClick={() => commands.joinWorkspaceByInviteCode(inviteCode)}>
                참여하기
              </Button>
            </div>
          }
        >
          <label className="block text-sm font-semibold text-slate-700">
            초대 코드
            <input
              className="mt-2 w-full rounded-md border border-slate-200 px-3 py-2"
              placeholder="초대 코드를 입력하세요"
              value={inviteCode}
              onChange={(event) => setInviteCode(event.target.value)}
            />
          </label>
          <p className="mt-3 text-sm leading-6 text-slate-600">초대 코드가 확인되면 연결된 워크스페이스로 접속합니다.</p>
        </Popup>
      )}
      {workspaceToLeave && (
        <Popup
          eyebrow={leaveBlockedBySoleAdmin ? "관리자 승계 필요" : leaveDeletesWorkspace ? "조직 삭제" : "워크스페이스"}
          title={leaveDeletesWorkspace ? "마지막 사용자 나가기" : "워크스페이스 나가기"}
          tone={leaveBlockedBySoleAdmin ? "warning" : "danger"}
          onClose={() => setLeaveWorkspaceId("")}
          footer={
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setLeaveWorkspaceId("")}>취소</Button>
              {leaveBlockedBySoleAdmin ? (
                <Button onClick={moveToOrganizationForSuccession}>조직 관리로 이동</Button>
              ) : (
                <Button variant="danger" onClick={confirmLeaveWorkspace}>
                  {leaveDeletesWorkspace ? "삭제 후 나가기" : "나가기"}
                </Button>
              )}
            </div>
          }
        >
          {leaveBlockedBySoleAdmin ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm leading-6 text-amber-900">
                현재 {workspaceToLeave.name}의 유일한 관리자입니다. 먼저 다른 사용자에게 관리자 권한을 승계한 뒤 나갈 수 있습니다.
              </p>
            </div>
          ) : leaveDeletesWorkspace ? (
            <div className="rounded-md border border-rose-200 bg-rose-50 p-4">
              <p className="text-sm leading-6 text-rose-900">
                현재 {workspaceToLeave.name}의 마지막 사용자입니다. 나가면 조직, 사용자 참여 기록, 데이터 보관함, 분석 결과가 모두 삭제됩니다.
              </p>
            </div>
          ) : (
            <p className="text-sm leading-6 text-slate-600">
              {workspaceToLeave.name}에서 나가면 이 목록에서 사라집니다. 다시 참여하려면 초대 코드가 필요합니다.
            </p>
          )}
        </Popup>
      )}
    </main>
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
      <main className="min-h-screen bg-slate-50 px-5 py-10">
        <div className="mx-auto max-w-4xl space-y-8">
          <SectionTitle
            eyebrow="데이터 보관함 > 인공지능 구조 분석"
            title="분석할 소스 데이터가 없습니다"
            description="업무 파일을 추가하면 관리 대상과 edge, 지표 근거를 구성할 수 있습니다."
          />
          <Card className="space-y-4">
            <p className="text-sm leading-6 text-slate-600">
              원본 표 구조 읽기, 관리대상 후보 생성, 업무흐름 후보 생성, 관계 edge 구성, 지표 계산, 인사이트 근거 조합이 순서대로 진행됩니다.
            </p>
            <Button onClick={() => commands.navigate("vault")}>데이터 보관함으로 이동</Button>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-10">
      <div className="mx-auto max-w-4xl space-y-8">
        <SectionTitle
          eyebrow="데이터 보관함 > 인공지능 구조 분석"
          title="업로드 파일에서 운영 구조를 구성하고 있습니다"
          description="보관함의 파일을 바탕으로 관리 대상, 업무흐름, 연결관계, 지표, 인사이트를 구성합니다."
        />
        <Card className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-900">{job?.currentStep ?? "분석 준비 중"}</span>
            <Badge tone={job?.status === "reviewing_ready" ? "success" : "info"}>{job?.progress ?? 0}%</Badge>
          </div>
          <Progress value={job?.progress ?? 0} />
          <p className="text-sm text-slate-600">관리대상, 업무흐름, 관계 edge, 지표, 인사이트 근거를 같은 파일 근거로 연결합니다.</p>
        </Card>
      </div>
    </main>
  );
}

export function ReviewScreen() {
  const { commands, state } = usePrototype();
  const canConfirmCandidates = can(state.session.role, "candidate:confirm");
  const canReviewCandidates = can(state.session.role, "candidate:review");
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
  const selected = useMemo(() => rows.find((candidate) => candidate.id === selectedId) ?? rows[0], [rows, selectedId]);
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
    if (!selectedId || rows.some((candidate) => candidate.id === selectedId)) {
      return;
    }

    setSelectedId(rows[0]?.id ?? "");
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

  function toggleCandidate(candidate: ExtractionCandidate) {
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
    <main className="min-h-screen bg-slate-50 px-5 py-10">
      <div className="mx-auto max-w-6xl space-y-8">
        <SectionTitle
          eyebrow="데이터 보관함 > 구조 검토"
          title="관리 대상을 먼저 정하고 관련 후보를 확정합니다"
          description="관리 대상은 여러 개를 선택할 수 있고, 이후 선택한 관리 대상과 관련된 업무 흐름, 연결 관계, 지표를 단계적으로 확정합니다."
        />
        <div className="rounded-lg border border-blue-100 bg-blue-50 p-5">
          <Badge tone="info">{reviewStepIndex + 1} / {reviewSteps.length}</Badge>
          <h2 className="mt-3 text-xl font-bold text-slate-950">{activeStep.label} 선택</h2>
          <p className="mt-2 text-sm leading-6 text-slate-700">{activeStep.description}</p>
        </div>
        <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
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
                return (
                  <button
                    key={candidate.id}
                    className={`w-full rounded-md border p-4 text-left transition ${
                      isIncluded ? "border-blue-500 bg-blue-50" : "border-slate-200 bg-white hover:bg-slate-50"
                    } ${selected?.id === candidate.id ? "ring-2 ring-blue-100" : ""}`}
                    onClick={() => toggleCandidate(candidate)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h2 className="font-bold text-slate-950">{candidate.title}</h2>
                        <p className="mt-1 text-sm text-slate-600">{candidate.description}</p>
                      </div>
                      <Badge tone={isIncluded ? "success" : "neutral"}>
                        {isIncluded ? (candidate.type === "managed_object" ? "선택됨" : "포함됨") : "제외 예정"}
                      </Badge>
                    </div>
                  </button>
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
                    <p className="text-xs font-bold text-blue-700">edge 미리보기</p>
                    <p className="mt-2 font-semibold text-slate-950">
                      {selected.edgePreview.fromLabel} → {selected.edgePreview.toLabel}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">유형: {selected.edgePreview.relationType}</p>
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
      </div>
    </main>
  );
}

function rowsForReviewStep(candidates: ExtractionCandidate[], candidateType: CandidateType, managedCandidateIds: string[]): ExtractionCandidate[] {
  const rows = candidates.filter((candidate) => candidate.type === candidateType && candidate.status !== "excluded");
  if (candidateType === "managed_object") {
    return rows;
  }

  if (managedCandidateIds.length === 0) {
    return [];
  }

  const relatedIds = Array.from(
    new Set(managedCandidateIds.flatMap((managedCandidateId) => relatedCandidateIdsByManagedObject[managedCandidateId]?.[candidateType] ?? []))
  );
  return rows.filter((candidate) => relatedIds.includes(candidate.id));
}

function formatReviewEvidenceSource(evidence: EvidenceReference): string {
  const sourceKind = evidence.sourceKind === "canonical_sample" ? "보관 파일" : "업로드 파일";
  const rows = evidence.rowNumbers && evidence.rowNumbers.length > 0 ? `${evidence.rowNumbers.join(", ")}행` : undefined;
  const columns = evidence.columns && evidence.columns.length > 0 ? evidence.columns.join(", ") : undefined;
  const confidence = typeof evidence.confidence === "number" ? `신뢰도 ${Math.round(evidence.confidence * 100)}%` : undefined;

  return [sourceKind, evidence.sourceName ?? evidence.location, evidence.sheetName, rows, columns, confidence].filter(Boolean).join(" · ");
}

function buildCandidateSelectionDefaults(
  candidates: ExtractionCandidate[],
  current: CandidateSelectionMap = emptyCandidateSelection,
  manualExcludedCandidateIds: string[] = []
): CandidateSelectionMap {
  const managedRows = rowsForReviewStep(candidates, "managed_object", []);
  const manualExclusions = new Set(manualExcludedCandidateIds);
  const selectedManagedCandidateIds = current.managed_object.filter((candidateId) => managedRows.some((candidate) => candidate.id === candidateId));
  const managedCandidateIds = selectedManagedCandidateIds.length > 0 ? selectedManagedCandidateIds : managedRows.map((candidate) => candidate.id);
  const next: CandidateSelectionMap = {
    managed_object: managedCandidateIds,
    workflow_event: [],
    relation: [],
    metric: []
  };

  (["workflow_event", "relation", "metric"] as CandidateType[]).forEach((candidateType) => {
    const rows = rowsForReviewStep(candidates, candidateType, managedCandidateIds);
    next[candidateType] = rows.map((candidate) => candidate.id).filter((candidateId) => !manualExclusions.has(candidateId));
  });

  return next;
}

function selectedCandidateIdsFromSelection(selection: CandidateSelectionMap): string[] {
  return Array.from(new Set(reviewSteps.flatMap((step) => selection[step.type])));
}
