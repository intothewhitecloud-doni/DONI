"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card, SectionTitle } from "../../components/ui/Card";
import { Popup } from "../../components/ui/Popup";
import { Progress } from "../../components/ui/Progress";
import { workflowsHaveSelectedMetrics } from "../../lib/domain/result-scenarios";
import type { CandidateType, EvidenceReference, ExtractionCandidate } from "../../lib/domain/types";
import { shouldBlockWorkspaceLeaveForSoleOwner, willDeleteWorkspaceOnLeave } from "../../lib/domain/state-machine";
import { demoAccounts } from "../../lib/prototype/authAccounts";
import {
  buildCandidateSelectionDefaults,
  emptyCandidateSelection,
  rowsForReviewStep,
  type CandidateSelectionMap
} from "../../lib/prototype/candidateReviewSelection";
import { can, roleLabel } from "../../lib/prototype/permissions";
import { membershipStatusLabel } from "../../lib/prototype/policy";
import { evidenceById, workspaceMembershipsForUser } from "../../lib/prototype/selectors";
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
    description: "조직이 이번 분석에서 관찰할 유형을 선택합니다. 선택한 유형에 속한 관리 대상 인스턴스가 함께 따라옵니다."
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
            <p className="mt-1 text-body-sm text-slate-500">이메일 또는 테스트 아이디와 비밀번호를 입력해 접속합니다.</p>
          </div>
          <label className="block text-sm font-semibold text-slate-700">
            이메일 또는 아이디
            <input className="mt-2 w-full rounded-md border border-slate-200 px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2" value={loginId} onChange={(event) => setLoginId(event.target.value)} />
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            비밀번호
            <input
              className="mt-2 w-full rounded-md border border-slate-200 px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
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
          <Button className="w-full" variant="secondary" onClick={() => commands.navigate("signup")}>회원가입</Button>
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-bold text-slate-500">넥스트 제조 그룹 테스트 계정</p>
            <div className="mt-3 grid gap-2 text-xs text-slate-700">
              {demoAccounts.map((account) => (
                <button
                  key={account.loginId}
                  className="grid grid-cols-[128px_minmax(0,1fr)] rounded-md bg-white px-3 py-2 text-left transition hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                  onClick={() => {
                    setLoginId(account.loginId);
                    setPassword(account.password);
                  }}
                >
                  <span className="whitespace-nowrap font-bold text-slate-900">{roleLabel(account.role)}</span>
                  <span className="whitespace-nowrap">{account.loginId} / {account.password}</span>
                </button>
              ))}
            </div>
          </div>
        </Card>
      </div>
    </main>
  );
}

export function SignupScreen() {
  const { commands } = usePrototype();
  const [signup, setSignup] = useState({
    code: "",
    email: "",
    name: "",
    password: ""
  });
  const [signupError, setSignupError] = useState("");

  const submitSignup = () => {
    if (commands.signup(signup)) {
      setSignupError("");
      setSignup({ code: "", email: "", name: "", password: "" });
      return;
    }

    setSignupError("회원가입 정보를 확인해 주세요.");
  };

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-10">
      <div className="mx-auto grid min-h-[calc(100vh-5rem)] max-w-6xl items-center gap-8 lg:grid-cols-[1fr_460px]">
        <div className="space-y-5">
          <Badge tone="info">회원가입</Badge>
          <h1 className="text-display-lg text-slate-950">계정을 먼저 만들고 필요한 워크스페이스에 참여하세요</h1>
          <p className="text-body-md text-slate-600">
            조직코드는 선택 입력입니다. 코드 없이 가입하면 계정만 생성되고, 코드가 있으면 승인 대기 상태의 워크스페이스 참여 신청이 함께 등록됩니다.
          </p>
          <Button variant="secondary" onClick={() => commands.navigate("login")}>로그인으로 돌아가기</Button>
        </div>
        <Card className="space-y-4">
          <div>
            <h2 className="text-title-lg text-slate-950">새 계정 만들기</h2>
            <p className="mt-1 text-body-sm text-slate-500">이름, 이메일, 비밀번호는 필수이고 조직코드는 선택입니다.</p>
          </div>
          <label className="block text-sm font-semibold text-slate-700">
            이름
            <input className="mt-2 w-full rounded-md border border-slate-200 px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2" value={signup.name} onChange={(event) => setSignup((current) => ({ ...current, name: event.target.value }))} />
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            이메일
            <input className="mt-2 w-full rounded-md border border-slate-200 px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2" type="email" value={signup.email} onChange={(event) => setSignup((current) => ({ ...current, email: event.target.value }))} />
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            비밀번호
            <input
              className="mt-2 w-full rounded-md border border-slate-200 px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              type="password"
              value={signup.password}
              onChange={(event) => setSignup((current) => ({ ...current, password: event.target.value }))}
            />
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            조직코드 <span className="text-xs font-medium text-slate-500">(선택)</span>
            <input
              className="mt-2 w-full rounded-md border border-slate-200 px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              placeholder="예: DONI-1001"
              value={signup.code}
              onChange={(event) => setSignup((current) => ({ ...current, code: event.target.value }))}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  submitSignup();
                }
              }}
            />
          </label>
          {signupError && <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{signupError}</p>}
          <Button
            className="w-full"
            disabled={!signup.email.trim() || !signup.name.trim() || !signup.password.trim()}
            onClick={submitSignup}
          >
            회원가입
          </Button>
        </Card>
      </div>
    </main>
  );
}

export function WorkspaceScreen() {
  const { commands, state } = usePrototype();
  const workspaceEntries = workspaceMembershipsForUser(state);
  const [inviteCode, setInviteCode] = useState("");
  const [modal, setModal] = useState<"create" | "invite" | "">("");
  const [leaveWorkspaceId, setLeaveWorkspaceId] = useState("");
  const [newWorkspace, setNewWorkspace] = useState({ name: "" });

  function createWorkspaceFromModal() {
    if (!newWorkspace.name.trim()) {
      return;
    }

    if (commands.createWorkspace({ name: newWorkspace.name.trim() })) {
      setModal("");
      setNewWorkspace({ name: "" });
    }
  }

  function requestWorkspaceParticipation() {
    if (commands.joinWorkspaceByInviteCode(inviteCode)) {
      setInviteCode("");
      setModal("");
    }
  }

  function confirmLeaveWorkspace() {
    if (leaveWorkspaceId && commands.leaveWorkspace(leaveWorkspaceId)) {
      setLeaveWorkspaceId("");
    }
  }

  const workspaceToLeave = workspaceEntries.find((entry) => entry.workspace.id === leaveWorkspaceId)?.workspace;
  const leaveDeletesWorkspace = workspaceToLeave ? willDeleteWorkspaceOnLeave(state, workspaceToLeave.id) : false;
  const leaveBlockedBySoleOwner = workspaceToLeave ? shouldBlockWorkspaceLeaveForSoleOwner(state, workspaceToLeave.id) : false;

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
            description="회원가입 직후에는 승인 상태를 확인할 수 있습니다. 승인 완료 전에는 워크스페이스 접속/나가기 버튼이 표시되지 않습니다."
          />
          <div className="flex flex-wrap gap-2">
            {state.session.loggedIn ? <Button variant="secondary" onClick={commands.logout}>로그아웃</Button> : <Button variant="secondary" onClick={() => commands.navigate("login")}>로그인</Button>}
            {state.session.loggedIn && <Button variant="secondary" onClick={() => setModal("invite")}>워크스페이스 참여하기</Button>}
            {state.session.loggedIn && <Button onClick={() => setModal("create")}>새 워크스페이스 만들기</Button>}
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {workspaceEntries.length === 0 ? (
            <Card className="md:col-span-2">
              <div className="space-y-3">
                <Badge tone="neutral">워크스페이스 없음</Badge>
                <h2 className="text-xl font-bold text-slate-950">참여 중인 워크스페이스가 없습니다</h2>
                <p className="text-sm leading-6 text-slate-600">조직코드가 있다면 워크스페이스 참여하기로 가입 신청을 등록하거나, 새 워크스페이스를 만들어 시작하세요.</p>
              </div>
            </Card>
          ) : (
            workspaceEntries.map(({ member, workspace }) => {
              const ownerActive = member.status === "active" && member.role === "owner";
              return (
                <Card key={workspace.id}>
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      <Badge tone={ownerActive ? "info" : member.status === "active" ? "success" : member.status === "pending" ? "warning" : "neutral"}>
                        {ownerActive ? "소유자" : membershipStatusLabel(member.status)}
                      </Badge>
                      <Badge tone="neutral">{roleLabel(member.role)}</Badge>
                    </div>
                    <h2 className="text-xl font-bold text-slate-950">{workspace.name}</h2>
                    <p className="text-sm leading-6 text-slate-600">현재 가입 상태와 역할을 확인할 수 있습니다. 조직코드는 조직 관리 화면에서 확인합니다.</p>
                    {member.status === "active" ? (
                      <div className="flex flex-wrap gap-2">
                        <Button onClick={() => commands.selectWorkspace(workspace.id)}>이 워크스페이스로 접속</Button>
                        <Button variant="danger" onClick={() => setLeaveWorkspaceId(workspace.id)}>나가기</Button>
                      </div>
                    ) : (
                      <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-600">
                        현재는 상태 조회만 가능하며 워크스페이스 접속/나가기 버튼은 표시되지 않습니다.
                      </p>
                    )}
                  </div>
                </Card>
              );
            })
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
              <Button disabled={!newWorkspace.name.trim()} onClick={createWorkspaceFromModal}>목록에 추가</Button>
            </div>
          }
        >
          <p className="text-sm leading-6 text-slate-600">
            워크스페이스 이름만 입력하면 새 조직 공간이 만들어집니다. 직책은 승인 후 조직 관리에서 워크스페이스별로 지정합니다.
          </p>
          <div className="mt-5 space-y-4">
            <label className="block text-sm font-semibold text-slate-700">
              워크스페이스명
              <input
                className="mt-2 w-full rounded-md border border-slate-200 px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                placeholder="예: 신규 운영 조직"
                value={newWorkspace.name}
                onChange={(event) => setNewWorkspace({ name: event.target.value })}
              />
            </label>
          </div>
        </Popup>
      )}
      {modal === "invite" && (
        <Popup
          eyebrow="워크스페이스"
          title="워크스페이스 참여하기"
          onClose={() => setModal("")}
          footer={
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setModal("")}>취소</Button>
              <Button disabled={!inviteCode.trim()} onClick={requestWorkspaceParticipation}>가입 신청</Button>
            </div>
          }
        >
          <label className="block text-sm font-semibold text-slate-700">
            조직코드
            <input
              className="mt-2 w-full rounded-md border border-slate-200 px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              placeholder="조직코드를 입력하세요"
              value={inviteCode}
              onChange={(event) => setInviteCode(event.target.value)}
            />
          </label>
          <p className="mt-3 text-sm leading-6 text-slate-600">조직코드가 확인되면 승인 대기 상태로 등록되고 조직 관리에서 승인/반려할 수 있습니다.</p>
        </Popup>
      )}
      {workspaceToLeave && (
        <Popup
          eyebrow={leaveBlockedBySoleOwner ? "소유자 이전 필요" : leaveDeletesWorkspace ? "조직 삭제" : "워크스페이스"}
          title={leaveDeletesWorkspace ? "마지막 사용자 나가기" : "워크스페이스 나가기"}
          tone={leaveBlockedBySoleOwner ? "warning" : "danger"}
          onClose={() => setLeaveWorkspaceId("")}
          footer={
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setLeaveWorkspaceId("")}>취소</Button>
              {leaveBlockedBySoleOwner ? (
                <Button onClick={moveToOrganizationForSuccession}>조직 관리로 이동</Button>
              ) : (
                <Button variant="danger" onClick={confirmLeaveWorkspace}>
                  {leaveDeletesWorkspace ? "삭제 후 나가기" : "나가기"}
                </Button>
              )}
            </div>
          }
        >
          {leaveBlockedBySoleOwner ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm leading-6 text-amber-900">
                현재 {workspaceToLeave.name}의 유일한 워크스페이스 소유자입니다. 먼저 다른 사용자에게 소유자 권한을 이전한 뒤 나갈 수 있습니다.
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
              {workspaceToLeave.name}에서 나가면 비활성화 상태로 전환되어 접속할 수 없습니다. 다시 참여하려면 가입 승인 절차가 필요합니다.
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
            description="업무 파일을 추가하면 관리 대상과 연결 관계, 지표 근거를 구성할 수 있습니다."
          />
          <Card className="space-y-4">
            <p className="text-sm leading-6 text-slate-600">
              원본 표 구조 읽기, 관리대상 후보 생성, 업무흐름 후보 생성, 연결 관계 구성, 지표 계산, 인사이트 근거 조합이 순서대로 진행됩니다.
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
          <p className="text-sm text-slate-600">관리대상, 업무흐름, 연결 관계, 지표, 인사이트 근거를 같은 파일 근거로 연결합니다.</p>
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
    <main className="min-h-screen bg-slate-50 px-5 py-10">
      <div className="mx-auto max-w-6xl space-y-8">
        <SectionTitle
          eyebrow="데이터 보관함 > 구조 검토"
          title="관리 대상 유형을 먼저 정하고 관련 후보를 확정합니다"
          description="관리 대상 유형은 여러 개를 선택할 수 있고, 이후 선택한 유형에 속한 인스턴스와 관련 업무 흐름, 연결 관계, 지표를 단계적으로 확정합니다."
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
                            <span className="rounded-full border border-brand-accent bg-brand-accent px-2 py-0.5 text-[11px] font-bold leading-4 text-white">
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
      </div>
    </main>
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
