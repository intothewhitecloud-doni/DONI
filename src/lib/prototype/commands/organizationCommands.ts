import type { Dispatch } from "react";
import type { PrototypeState, Role } from "../../domain/types";
import { commandMeta } from "../events";
import { can } from "../permissions";
import { actorMembershipForTarget, canManageMembership, membershipById } from "../policy";
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
  payload: { workspaceId: string; name: string }
): boolean {
  if (!requireOrganizationAdmin(state, dispatch)) {
    return false;
  }

  dispatch({
    type: "UPDATE_WORKSPACE",
    ...payload,
    ...commandMeta(state, "그룹 정보 수정", "workspace", payload.workspaceId, "관리자가 그룹명을 수정했습니다.")
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
    ...commandMeta(state, "조직코드 재발급", "workspace", workspaceId, "관리자가 그룹 조직코드를 새로 발급했습니다.")
  });
  return true;
}

export function updateWorkspaceMember(
  state: PrototypeState,
  dispatch: Dispatch<PrototypeAction>,
  payload: { memberId: string; role: Role; title: string }
): boolean {
  const target = membershipById(state, payload.memberId);
  const actor = actorMembershipForTarget(state, target);
  const roleChanged = Boolean(target && target.role !== payload.role);
  const titleChanged = Boolean(target && target.title !== payload.title);
  const canUpdateRole = !roleChanged || canManageMembership(actor, target, "update_role", payload.role);
  const canUpdateTitle = !titleChanged || canManageMembership(actor, target, "update_title");
  if (!target || !canUpdateRole || !canUpdateTitle) {
    dispatch({ type: "SET_PERMISSION_DENIED", message: "현재 역할은 해당 사용자의 역할 또는 직책을 변경할 수 없습니다." });
    return false;
  }

  dispatch({
    type: "UPDATE_MEMBER",
    ...payload,
    notificationId: `notice-member-update-${Date.now()}`,
    ...commandMeta(state, "사용자 정보 수정", "workspace_member", payload.memberId, "사용자의 역할 또는 직책을 수정했습니다.")
  });
  return true;
}

export function approveWorkspaceMember(state: PrototypeState, dispatch: Dispatch<PrototypeAction>, memberId: string): boolean {
  const target = membershipById(state, memberId);
  const actor = actorMembershipForTarget(state, target);
  if (!canManageMembership(actor, target, "approve")) {
    dispatch({ type: "SET_PERMISSION_DENIED", message: "현재 역할은 해당 가입 신청을 승인할 수 없습니다." });
    return false;
  }

  dispatch({
    type: "APPROVE_MEMBER",
    memberId,
    notificationId: `notice-member-approve-${Date.now()}`,
    ...commandMeta(state, "가입 신청 승인", "workspace_member", memberId, "가입 신청을 승인했습니다.")
  });
  return true;
}

export function rejectWorkspaceMember(state: PrototypeState, dispatch: Dispatch<PrototypeAction>, memberId: string): boolean {
  const target = membershipById(state, memberId);
  const actor = actorMembershipForTarget(state, target);
  if (!canManageMembership(actor, target, "reject")) {
    dispatch({ type: "SET_PERMISSION_DENIED", message: "현재 역할은 해당 가입 신청을 반려할 수 없습니다." });
    return false;
  }

  dispatch({
    type: "REJECT_MEMBER",
    memberId,
    notificationId: `notice-member-reject-${Date.now()}`,
    ...commandMeta(state, "가입 신청 반려", "workspace_member", memberId, "가입 신청을 반려했습니다.")
  });
  return true;
}

export function deactivateWorkspaceMember(state: PrototypeState, dispatch: Dispatch<PrototypeAction>, memberId: string): boolean {
  const target = membershipById(state, memberId);
  const actor = actorMembershipForTarget(state, target);
  if (!canManageMembership(actor, target, "deactivate")) {
    dispatch({ type: "SET_PERMISSION_DENIED", message: "현재 역할은 해당 사용자를 비활성화할 수 없습니다." });
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

export function transferWorkspaceOwnership(state: PrototypeState, dispatch: Dispatch<PrototypeAction>, memberId: string): boolean {
  const target = membershipById(state, memberId);
  const actor = actorMembershipForTarget(state, target);
  if (!canManageMembership(actor, target, "transfer_owner")) {
    dispatch({ type: "SET_PERMISSION_DENIED", message: "워크스페이스 소유자만 소유권을 이전할 수 있습니다." });
    return false;
  }

  dispatch({
    type: "TRANSFER_OWNERSHIP",
    memberId,
    notificationId: `notice-owner-transfer-${Date.now()}`,
    ...commandMeta(state, "소유자 이전", "workspace_member", memberId, "워크스페이스 소유자를 이전했습니다.")
  });
  return true;
}
