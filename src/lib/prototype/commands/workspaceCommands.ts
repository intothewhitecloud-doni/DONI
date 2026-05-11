import type { Dispatch } from "react";
import { shouldBlockWorkspaceLeaveForSoleAdmin, SOLE_ADMIN_LEAVE_BLOCKED_MESSAGE, userCanAccessWorkspace } from "../../domain/state-machine";
import type { PrototypeState, WorkspaceMember } from "../../domain/types";
import { commandMeta } from "../events";
import type { PrototypeAction } from "../store";

export function selectWorkspace(state: PrototypeState, dispatch: Dispatch<PrototypeAction>, workspaceId: string): boolean {
  const workspace = state.workspaces.find((item) => item.id === workspaceId);
  if (!workspace || !userCanAccessWorkspace(state, workspace.id)) {
    dispatch({ type: "SET_PERMISSION_DENIED", message: "현재 사용자는 해당 그룹에 속해 있지 않습니다." });
    return false;
  }

  dispatch({
    type: "SELECT_WORKSPACE",
    workspaceId,
    ...commandMeta(state, "워크스페이스 선택", "workspace", workspace.id, `${workspace.name} 워크스페이스를 선택했습니다.`)
  });
  return true;
}

export function joinWorkspaceByInviteCode(state: PrototypeState, dispatch: Dispatch<PrototypeAction>, inviteCode: string): boolean {
  const normalizedCode = inviteCode.trim().toLowerCase();
  const workspace = state.workspaces.find((item) => item.inviteCode.toLowerCase() === normalizedCode);
  const currentUser = state.users.find((user) => user.id === state.session.currentUserId);
  if (!workspace || !currentUser) {
    dispatch({ type: "SET_PERMISSION_DENIED", message: "초대 코드를 확인할 수 없습니다." });
    return false;
  }

  if (userCanAccessWorkspace(state, workspace.id)) {
    return selectWorkspace(state, dispatch, workspace.id);
  }

  const member: WorkspaceMember = {
    id: `member-${workspace.id}-${currentUser.id}`,
    eligibleVoter: true,
    name: currentUser.name,
    role: "member",
    status: "active",
    title: currentUser.title,
    userId: currentUser.id,
    workspaceId: workspace.id
  };

  dispatch({
    type: "JOIN_WORKSPACE",
    member,
    workspaceId: workspace.id,
    ...commandMeta(state, "워크스페이스 참여", "workspace", workspace.id, `${workspace.name} 워크스페이스에 참여했습니다.`)
  });
  return true;
}

export function leaveWorkspace(state: PrototypeState, dispatch: Dispatch<PrototypeAction>, workspaceId: string): boolean {
  const workspace = state.workspaces.find((item) => item.id === workspaceId);
  if (!workspace || !userCanAccessWorkspace(state, workspace.id)) {
    dispatch({ type: "SET_PERMISSION_DENIED", message: "현재 사용자는 해당 그룹에 속해 있지 않습니다." });
    return false;
  }

  if (shouldBlockWorkspaceLeaveForSoleAdmin(state, workspace.id)) {
    dispatch({
      type: "SET_PERMISSION_DENIED",
      message: SOLE_ADMIN_LEAVE_BLOCKED_MESSAGE
    });
    return false;
  }

  dispatch({
    type: "LEAVE_WORKSPACE",
    workspaceId,
    ...commandMeta(state, "워크스페이스 나가기", "workspace", workspace.id, `${workspace.name} 워크스페이스에서 나갔습니다.`)
  });
  return true;
}

export function createWorkspace(
  state: PrototypeState,
  dispatch: Dispatch<PrototypeAction>,
  payload: { name: string; industry: string; goal: string }
): void {
  dispatch({
    type: "CREATE_WORKSPACE",
    ...payload,
    ...commandMeta(state, "워크스페이스 생성", "workspace", state.session.workspaceId, "새 워크스페이스의 회사 맥락과 의사결정 목표를 확정했습니다.")
  });
}
