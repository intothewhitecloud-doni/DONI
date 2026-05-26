"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card, SectionTitle } from "../../components/ui/Card";
import { Popup } from "../../components/ui/Popup";
import type { Role, WorkspaceMember } from "../../lib/domain/types";
import { can, roleLabel } from "../../lib/prototype/permissions";
import { actorMembershipForTarget, canManageMembership, membershipStatusLabel } from "../../lib/prototype/policy";
import { currentWorkspace } from "../../lib/prototype/selectors";
import { usePrototype } from "../../lib/prototype/PrototypeProvider";

const roleOptions: Role[] = ["owner", "manager", "member"];
type MemberFilter = "all" | WorkspaceMember["status"];

const memberFilters: Array<{ label: string; value: MemberFilter }> = [
  { label: "전체", value: "all" },
  { label: "승인 대기", value: "pending" },
  { label: "승인 완료", value: "active" },
  { label: "반려", value: "rejected" },
  { label: "비활성화", value: "inactive" }
];

export function OrganizationScreen() {
  const { commands, state } = usePrototype();
  const workspace = currentWorkspace(state);
  const canManageProfile = can(state.session.role, "admin:manage");
  const actor = state.members.find(
    (member) => member.userId === state.session.currentUserId && member.workspaceId === workspace.id && member.status === "active"
  );
  const [memberFilter, setMemberFilter] = useState<MemberFilter>("pending");
  const allWorkspaceMembers = useMemo(
    () => state.members.filter((member) => member.workspaceId === workspace.id),
    [state.members, workspace.id]
  );
  const memberCounts = useMemo(
    () => ({
      active: allWorkspaceMembers.filter((member) => member.status === "active").length,
      all: allWorkspaceMembers.length,
      inactive: allWorkspaceMembers.filter((member) => member.status === "inactive").length,
      pending: allWorkspaceMembers.filter((member) => member.status === "pending").length,
      rejected: allWorkspaceMembers.filter((member) => member.status === "rejected").length
    }),
    [allWorkspaceMembers]
  );
  const effectiveMemberFilter: MemberFilter = memberFilter === "pending" && memberCounts.pending === 0 ? "all" : memberFilter;
  const workspaceMembers = useMemo(
    () =>
      allWorkspaceMembers.filter((member) => {
        if (effectiveMemberFilter === "all") {
          return true;
        }

        return member.status === effectiveMemberFilter;
      }),
    [allWorkspaceMembers, effectiveMemberFilter]
  );
  const [profile, setProfile] = useState({ name: workspace.name });
  const [copied, setCopied] = useState(false);
  const [memberToDeactivate, setMemberToDeactivate] = useState<WorkspaceMember | undefined>();
  const [memberToTransferOwnership, setMemberToTransferOwnership] = useState<WorkspaceMember | undefined>();

  useEffect(() => {
    setProfile({ name: workspace.name });
  }, [workspace.name]);

  useEffect(() => {
    if (memberFilter === "pending" && memberCounts.pending === 0) {
      setMemberFilter("all");
    }
  }, [memberCounts.pending, memberFilter]);

  function saveProfile() {
    commands.updateWorkspaceProfile({
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

  function confirmTransferOwnership() {
    if (memberToTransferOwnership && commands.transferWorkspaceOwnership(memberToTransferOwnership.id)) {
      setMemberToTransferOwnership(undefined);
    }
  }

  return (
    <div className="space-y-8">
      <SectionTitle
        eyebrow="조직 관리"
        title="그룹 정보와 사용자를 관리합니다"
        description="현재 접속한 그룹의 기본 정보, 조직코드, 사용자 참여 상태를 관리합니다."
      />

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <Card className="space-y-5">
          <div>
            <Badge tone="info">그룹 정보</Badge>
            <h2 className="mt-3 text-lg font-bold text-slate-950">기본 정보</h2>
          </div>
          {canManageProfile ? (
            <>
              <label className="block text-sm font-semibold text-slate-700">
                그룹명
                <input
                  className="mt-2 w-full rounded-md border border-slate-200 px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                  value={profile.name}
                  onChange={(event) => setProfile({ name: event.target.value })}
                />
              </label>
              <Button disabled={!profile.name.trim()} onClick={saveProfile}>그룹 정보 저장</Button>
            </>
          ) : (
            <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs font-bold text-slate-500">그룹명</p>
              <p className="mt-1 text-lg font-bold text-slate-950">{workspace.name}</p>
            </div>
          )}
        </Card>

        <Card className="space-y-5">
          <div>
            <Badge tone="neutral">조직코드</Badge>
            <h2 className="mt-3 text-lg font-bold text-slate-950">그룹 참여 코드</h2>
          </div>
          <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="font-mono text-xl font-bold text-slate-950">{workspace.inviteCode}</p>
            <p className="mt-1 text-sm text-slate-500">새 사용자가 워크스페이스 참여하기 화면에서 입력할 수 있습니다.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={copyInviteCode}>{copied ? "복사됨" : "조직코드 복사"}</Button>
            {canManageProfile && <Button onClick={() => commands.regenerateInviteCode(workspace.id)}>새 코드 발급</Button>}
          </div>
        </Card>
      </div>

      <Card className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Badge tone="neutral">사용자</Badge>
            <h2 className="mt-3 text-lg font-bold text-slate-950">그룹 사용자</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              새 사용자는 조직코드로 승인 요청을 생성합니다. 소유자는 운영 관리자와 일반 사용자를, 운영 관리자는 일반 사용자를 승인/반려/비활성화할 수 있습니다.
            </p>
          </div>
          <div className="rounded-md border border-slate-200 bg-slate-50 p-1">
            {memberFilters.map((filter) => (
              <button
                key={filter.value}
                aria-pressed={effectiveMemberFilter === filter.value}
                className={`rounded px-3 py-1.5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
                  effectiveMemberFilter === filter.value ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-white hover:text-slate-950"
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
                actor={actorMembershipForTarget(state, member)}
                currentUserId={state.session.currentUserId}
                member={member}
                onApprove={commands.approveWorkspaceMember}
                onDeactivate={() => setMemberToDeactivate(member)}
                onReject={commands.rejectWorkspaceMember}
                onTransferOwnership={() => setMemberToTransferOwnership(member)}
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
      {memberToTransferOwnership && (
        <Popup
          eyebrow="주의 필요"
          title="소유자 이전"
          tone="warning"
          onClose={() => setMemberToTransferOwnership(undefined)}
          footer={
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setMemberToTransferOwnership(undefined)}>취소</Button>
              <Button variant="danger" onClick={confirmTransferOwnership}>소유자 이전</Button>
            </div>
          }
        >
          <div className="space-y-3 text-sm leading-6 text-muted">
            <p>
              {memberToTransferOwnership.name} 사용자에게 이 그룹의 소유자 권한을 이전합니다. 이전 후 현재 소유자는 운영 관리자로 변경됩니다.
            </p>
            <p className="rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-warning">
              소유자 이전은 그룹 권한의 최상위 관리자를 바꾸는 작업입니다. 새 소유자만 이후 소유자 이전과 전체 조직 관리를 수행할 수 있습니다.
            </p>
          </div>
        </Popup>
      )}
    </div>
  );
}

function MemberRow({
  actor,
  currentUserId,
  member,
  onApprove,
  onDeactivate,
  onReject,
  onTransferOwnership,
  onUpdate
}: {
  actor?: WorkspaceMember;
  currentUserId: string;
  member: WorkspaceMember;
  onApprove: (memberId: string) => boolean;
  onDeactivate: () => void;
  onReject: (memberId: string) => boolean;
  onTransferOwnership: () => void;
  onUpdate: (payload: { memberId: string; role: Role; title: string }) => boolean;
}) {
  const [draft, setDraft] = useState({
    role: member.role,
    title: member.title
  });
  const isCurrentUser = currentUserId === member.userId;
  const roleChanged = draft.role !== member.role;
  const titleChanged = draft.title !== member.title;
  const canApprove = canManageMembership(actor, member, "approve");
  const canReject = canManageMembership(actor, member, "reject");
  const canDeactivate = canManageMembership(actor, member, "deactivate") && !isCurrentUser;
  const canUpdateRole = canManageMembership(actor, member, "update_role", draft.role) && !isCurrentUser;
  const canUpdateTitle = canManageMembership(actor, member, "update_title") && !isCurrentUser;
  const canTransferOwnership = canManageMembership(actor, member, "transfer_owner");
  const canRenderRoleSelect = canUpdateRole || (member.role !== "owner" && actor?.role === "owner" && !isCurrentUser);
  const canSave = (roleChanged ? canUpdateRole : true) && (titleChanged ? canUpdateTitle : true) && (roleChanged || titleChanged) && !isCurrentUser;

  useEffect(() => {
    setDraft({
      role: member.role,
      title: member.title
    });
  }, [member.role, member.title]);

  return (
    <div className="rounded-md border border-slate-200 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-bold text-slate-950">{member.name}</p>
          <p className="text-sm text-slate-600">{member.title.trim() || "미지정"}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge tone={member.status === "active" ? "success" : member.status === "pending" ? "warning" : member.status === "rejected" ? "danger" : "neutral"}>
            {membershipStatusLabel(member.status)}
          </Badge>
          <Badge tone="info">{roleLabel(member.role)}</Badge>
        </div>
      </div>
      {(canUpdateTitle || canRenderRoleSelect) && (
        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_150px]">
          {canUpdateTitle ? (
            <label className="block text-sm font-semibold text-slate-700">
              직책
              <input
                className="mt-2 w-full rounded-md border border-slate-200 px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                value={draft.title}
                onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
              />
            </label>
          ) : (
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="text-xs font-bold text-slate-500">직책</p>
              <p className="mt-1 text-sm font-semibold text-slate-800">{member.title.trim() || "미지정"}</p>
            </div>
          )}
          {canRenderRoleSelect ? (
            <label className="block text-sm font-semibold text-slate-700">
              역할
              <select
                className="mt-2 w-full rounded-md border border-slate-200 bg-white px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                value={draft.role}
                onChange={(event) => setDraft((current) => ({ ...current, role: event.target.value as Role }))}
              >
                {roleOptions.filter((role) => role !== "owner" || member.role === "owner").map((role) => (
                  <option key={role} value={role}>{roleLabel(role)}</option>
                ))}
              </select>
            </label>
          ) : (
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="text-xs font-bold text-slate-500">역할</p>
              <p className="mt-1 text-sm font-semibold text-slate-800">{roleLabel(member.role)}</p>
            </div>
          )}
        </div>
      )}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-600">
          투표 참여는 역할에서 자동 결정됩니다. 워크스페이스 소유자와 운영 관리자만 투표할 수 있습니다.
        </p>
        <div className="flex flex-wrap gap-2">
          {(member.status === "pending" || member.status === "rejected") && canApprove && (
            <Button onClick={() => onApprove(member.id)}>승인</Button>
          )}
          {member.status === "pending" && canReject && (
            <Button variant="secondary" onClick={() => onReject(member.id)}>반려</Button>
          )}
          {canSave && (
            <Button variant="secondary" onClick={() => onUpdate({ memberId: member.id, ...draft })}>저장</Button>
          )}
          {canTransferOwnership && (
            <Button variant="secondary" onClick={onTransferOwnership}>소유자 이전</Button>
          )}
          {canDeactivate && (
            <Button variant="danger" onClick={onDeactivate}>비활성화</Button>
          )}
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
