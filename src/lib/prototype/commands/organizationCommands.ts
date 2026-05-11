import type { Dispatch } from "react";
import type { PrototypeState, Role } from "../../domain/types";
import { commandMeta } from "../events";
import { can } from "../permissions";
import type { PrototypeAction } from "../store";

function requireOrganizationAdmin(state: PrototypeState, dispatch: Dispatch<PrototypeAction>): boolean {
  if (can(state.session.role, "admin:manage")) {
    return true;
  }

  dispatch({ type: "SET_PERMISSION_DENIED", message: "현재 역할은 그룹 정보를 관리할 수 없습니다." });
  return false;
}

function inviteCode(): string {
  const segment = Math.floor(1000 + Math.random() * 9000);
  return `DONI-${segment}`;
}

export function updateWorkspaceProfile(
  state: PrototypeState,
  dispatch: Dispatch<PrototypeAction>,
  payload: { workspaceId: string; name: string; industry: string; goal: string }
): boolean {
  if (!requireOrganizationAdmin(state, dispatch)) {
    return false;
  }

  dispatch({
    type: "UPDATE_WORKSPACE",
    ...payload,
    ...commandMeta(state, "그룹 정보 수정", "workspace", payload.workspaceId, "관리자가 그룹 기본 정보를 수정했습니다.")
  });
  return true;
}

export function regenerateInviteCode(state: PrototypeState, dispatch: Dispatch<PrototypeAction>, workspaceId: string): boolean {
  if (!requireOrganizationAdmin(state, dispatch)) {
    return false;
  }

  dispatch({
    type: "REGENERATE_INVITE_CODE",
    workspaceId,
    inviteCode: inviteCode(),
    notificationId: `notice-invite-code-${Date.now()}`,
    ...commandMeta(state, "초대 코드 재발급", "workspace", workspaceId, "관리자가 그룹 초대 코드를 새로 발급했습니다.")
  });
  return true;
}

export function updateWorkspaceMember(
  state: PrototypeState,
  dispatch: Dispatch<PrototypeAction>,
  payload: { memberId: string; role: Role; eligibleVoter: boolean; title: string }
): boolean {
  if (!requireOrganizationAdmin(state, dispatch)) {
    return false;
  }

  dispatch({
    type: "UPDATE_MEMBER",
    ...payload,
    notificationId: `notice-member-update-${Date.now()}`,
    ...commandMeta(state, "사용자 정보 수정", "workspace_member", payload.memberId, "관리자가 사용자 역할과 투표 참여 여부를 수정했습니다.")
  });
  return true;
}

export function activateWorkspaceMember(state: PrototypeState, dispatch: Dispatch<PrototypeAction>, memberId: string): boolean {
  if (!requireOrganizationAdmin(state, dispatch)) {
    return false;
  }

  dispatch({
    type: "ACTIVATE_MEMBER",
    memberId,
    notificationId: `notice-member-activate-${Date.now()}`,
    ...commandMeta(state, "사용자 활성화", "workspace_member", memberId, "관리자가 사용자를 다시 활성화했습니다.")
  });
  return true;
}

export function deactivateWorkspaceMember(state: PrototypeState, dispatch: Dispatch<PrototypeAction>, memberId: string): boolean {
  if (!requireOrganizationAdmin(state, dispatch)) {
    return false;
  }

  dispatch({
    type: "DEACTIVATE_MEMBER",
    memberId,
    notificationId: `notice-member-deactivate-${Date.now()}`,
    ...commandMeta(state, "사용자 비활성화", "workspace_member", memberId, "관리자가 사용자를 비활성화했습니다.")
  });
  return true;
}
