"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card, SectionTitle } from "../../components/ui/Card";
import { Popup } from "../../components/ui/Popup";
import type { Role, WorkspaceMember } from "../../lib/domain/types";
import { can, roleLabel } from "../../lib/prototype/permissions";
import { currentWorkspace } from "../../lib/prototype/selectors";
import { usePrototype } from "../../lib/prototype/PrototypeProvider";

const memberStatusLabels: Record<WorkspaceMember["status"], string> = {
  active: "활성",
  inactive: "비활성",
  invited: "초대됨"
};

const roleOptions: Role[] = ["admin", "manager", "member"];
type MemberFilter = "all" | "active" | "inactive";

const memberFilters: Array<{ label: string; value: MemberFilter }> = [
  { label: "전체", value: "all" },
  { label: "활성", value: "active" },
  { label: "비활성", value: "inactive" }
];

export function OrganizationScreen() {
  const { commands, state } = usePrototype();
  const workspace = currentWorkspace(state);
  const canManage = can(state.session.role, "admin:manage");
  const [memberFilter, setMemberFilter] = useState<MemberFilter>("active");
  const allWorkspaceMembers = useMemo(
    () => state.members.filter((member) => member.workspaceId === workspace.id),
    [state.members, workspace.id]
  );
  const workspaceMembers = useMemo(
    () =>
      allWorkspaceMembers.filter((member) => {
        if (memberFilter === "all") {
          return true;
        }

        return member.status === memberFilter;
      }),
    [allWorkspaceMembers, memberFilter]
  );
  const memberCounts = useMemo(
    () => ({
      active: allWorkspaceMembers.filter((member) => member.status === "active").length,
      all: allWorkspaceMembers.length,
      inactive: allWorkspaceMembers.filter((member) => member.status === "inactive").length
    }),
    [allWorkspaceMembers]
  );
  const [profile, setProfile] = useState({
    goal: workspace.decisionGoal,
    industry: workspace.industry,
    name: workspace.name
  });
  const [copied, setCopied] = useState(false);
  const [memberToDeactivate, setMemberToDeactivate] = useState<WorkspaceMember | undefined>();

  useEffect(() => {
    setProfile({
      goal: workspace.decisionGoal,
      industry: workspace.industry,
      name: workspace.name
    });
  }, [workspace.decisionGoal, workspace.industry, workspace.name]);

  function saveProfile() {
    commands.updateWorkspaceProfile({
      goal: profile.goal,
      industry: profile.industry,
      name: profile.name,
      workspaceId: workspace.id
    });
  }

  function copyInviteCode() {
    void navigator.clipboard?.writeText(workspace.inviteCode);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  function confirmDeactivateMember() {
    if (memberToDeactivate && commands.deactivateWorkspaceMember(memberToDeactivate.id)) {
      setMemberToDeactivate(undefined);
    }
  }

  return (
    <div className="space-y-8">
      <SectionTitle
        eyebrow="조직 관리"
        title="그룹 정보와 사용자를 관리합니다"
        description="현재 접속한 그룹의 기본 정보, 초대 코드, 사용자 참여 상태를 관리합니다."
      />

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <Card className="space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <Badge tone="info">그룹 정보</Badge>
              <h2 className="mt-3 text-lg font-bold text-slate-950">기본 정보</h2>
            </div>
            <Badge tone={canManage ? "success" : "neutral"}>{canManage ? "관리 가능" : "조회 전용"}</Badge>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block text-sm font-semibold text-slate-700">
              그룹명
              <input
                className="mt-2 w-full rounded-md border border-slate-200 px-3 py-2"
                disabled={!canManage}
                value={profile.name}
                onChange={(event) => setProfile((current) => ({ ...current, name: event.target.value }))}
              />
            </label>
            <label className="block text-sm font-semibold text-slate-700">
              산업
              <input
                className="mt-2 w-full rounded-md border border-slate-200 px-3 py-2"
                disabled={!canManage}
                value={profile.industry}
                onChange={(event) => setProfile((current) => ({ ...current, industry: event.target.value }))}
              />
            </label>
          </div>
          <label className="block text-sm font-semibold text-slate-700">
            의사결정 목표
            <textarea
              className="mt-2 min-h-24 w-full rounded-md border border-slate-200 px-3 py-2"
              disabled={!canManage}
              value={profile.goal}
              onChange={(event) => setProfile((current) => ({ ...current, goal: event.target.value }))}
            />
          </label>
          <Button
            disabled={!canManage || !profile.name.trim() || !profile.industry.trim() || !profile.goal.trim()}
            onClick={saveProfile}
          >
            그룹 정보 저장
          </Button>
        </Card>

        <Card className="space-y-5">
          <div>
            <Badge tone="neutral">초대 코드</Badge>
            <h2 className="mt-3 text-lg font-bold text-slate-950">그룹 참여 코드</h2>
          </div>
          <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="font-mono text-xl font-bold text-slate-950">{workspace.inviteCode}</p>
            <p className="mt-1 text-sm text-slate-500">새 사용자가 워크스페이스 선택 화면에서 입력할 수 있습니다.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={copyInviteCode}>{copied ? "복사됨" : "코드 복사"}</Button>
            <Button disabled={!canManage} onClick={() => commands.regenerateInviteCode(workspace.id)}>새 코드 발급</Button>
          </div>
        </Card>
      </div>

      <Card className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Badge tone="neutral">사용자</Badge>
            <h2 className="mt-3 text-lg font-bold text-slate-950">그룹 사용자</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              새 사용자는 초대 코드로 직접 참여합니다. 처음에는 구성원으로 들어오며, 관리자가 필요할 때 매니저로 승급합니다.
            </p>
          </div>
          <div className="rounded-md border border-slate-200 bg-slate-50 p-1">
            {memberFilters.map((filter) => (
              <button
                key={filter.value}
                aria-pressed={memberFilter === filter.value}
                className={`rounded px-3 py-1.5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
                  memberFilter === filter.value ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-white hover:text-slate-950"
                }`}
                type="button"
                onClick={() => setMemberFilter(filter.value)}
              >
                {filter.label} {memberCounts[filter.value]}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-3">
          {workspaceMembers.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">
              선택한 상태에 해당하는 사용자가 없습니다.
            </div>
          ) : (
            workspaceMembers.map((member) => (
              <MemberRow
                key={member.id}
                canManage={canManage}
                currentUserId={state.session.currentUserId}
                member={member}
                onActivate={commands.activateWorkspaceMember}
                onDeactivate={() => setMemberToDeactivate(member)}
                onUpdate={commands.updateWorkspaceMember}
              />
            ))
          )}
        </div>
      </Card>
      {memberToDeactivate && (
        <Popup
          eyebrow="확인 필요"
          title="사용자 비활성화"
          tone="warning"
          onClose={() => setMemberToDeactivate(undefined)}
          footer={
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setMemberToDeactivate(undefined)}>취소</Button>
              <Button variant="danger" onClick={confirmDeactivateMember}>비활성화</Button>
            </div>
          }
        >
          <p className="text-sm leading-6 text-muted">
            {memberToDeactivate.name} 사용자는 이 그룹에 더 이상 접근할 수 없습니다. 필요하면 이후 다시 활성화할 수 있습니다.
          </p>
        </Popup>
      )}
    </div>
  );
}

function MemberRow({
  canManage,
  currentUserId,
  member,
  onActivate,
  onDeactivate,
  onUpdate
}: {
  canManage: boolean;
  currentUserId: string;
  member: WorkspaceMember;
  onActivate: (memberId: string) => boolean;
  onDeactivate: () => void;
  onUpdate: (payload: { memberId: string; role: Role; eligibleVoter: boolean; title: string }) => boolean;
}) {
  const [draft, setDraft] = useState({
    eligibleVoter: member.eligibleVoter,
    role: member.role,
    title: member.title
  });
  const isCurrentUser = currentUserId === member.userId;
  const disabled = !canManage || member.status === "inactive";

  useEffect(() => {
    setDraft({
      eligibleVoter: member.eligibleVoter,
      role: member.role,
      title: member.title
    });
  }, [member.eligibleVoter, member.role, member.title]);

  return (
    <div className="rounded-md border border-slate-200 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-bold text-slate-950">{member.name}</p>
          <p className="text-sm text-slate-600">{member.title}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge tone={member.status === "active" ? "success" : member.status === "invited" ? "warning" : "neutral"}>
            {memberStatusLabels[member.status]}
          </Badge>
          <Badge tone="info">{roleLabel(member.role)}</Badge>
        </div>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-[1fr_150px]">
        <label className="block text-sm font-semibold text-slate-700">
          직책
          <input
            className="mt-2 w-full rounded-md border border-slate-200 px-3 py-2"
            disabled={disabled}
            value={draft.title}
            onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
          />
        </label>
        <label className="block text-sm font-semibold text-slate-700">
          역할
          <select
            className="mt-2 w-full rounded-md border border-slate-200 bg-white px-3 py-2"
            disabled={disabled || isCurrentUser}
            value={draft.role}
            onChange={(event) => setDraft((current) => ({ ...current, role: event.target.value as Role }))}
          >
            {roleOptions.map((role) => (
              <option key={role} value={role}>{roleLabel(role)}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <input
            checked={draft.eligibleVoter}
            disabled={disabled}
            type="checkbox"
            onChange={(event) => setDraft((current) => ({ ...current, eligibleVoter: event.target.checked }))}
          />
          투표 참여 가능
        </label>
        <div className="flex flex-wrap gap-2">
          {member.status === "inactive" && (
            <Button disabled={!canManage || isCurrentUser} onClick={() => onActivate(member.id)}>
              활성화
            </Button>
          )}
          <Button
            disabled={disabled || !draft.title.trim()}
            variant="secondary"
            onClick={() => onUpdate({ memberId: member.id, ...draft })}
          >
            저장
          </Button>
          <Button disabled={!canManage || member.status === "inactive" || isCurrentUser} variant="danger" onClick={onDeactivate}>
            비활성화
          </Button>
        </div>
      </div>
    </div>
  );
}

export function SettingsScreen() {
  return (
    <div className="space-y-8">
      <SectionTitle eyebrow="설정" title="인공지능 사용량과 알림" description="사용량과 예산 상태를 기준으로 운영 알림을 관리합니다." />
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <Badge tone="info">이번 달 호출</Badge>
          <p className="mt-4 text-3xl font-bold text-slate-950">184회</p>
        </Card>
        <Card>
          <Badge tone="warning">예상 비용</Badge>
          <p className="mt-4 text-3xl font-bold text-slate-950">42만원</p>
        </Card>
        <Card>
          <Badge tone="success">예산 사용률</Badge>
          <p className="mt-4 text-3xl font-bold text-slate-950">58%</p>
        </Card>
      </div>
      <Card className="space-y-4">
        <h2 className="text-lg font-bold text-slate-950">알림 기준</h2>
        <p className="text-sm text-slate-600">예산 사용률 80% 도달, 위험 지표 2개 이상 발생, 투표 마감 12시간 전 알림을 제공합니다.</p>
      </Card>
    </div>
  );
}
