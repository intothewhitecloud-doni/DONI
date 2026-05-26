import type { Dispatch } from "react";
import type { AuthAccount, PrototypeState, User, WorkspaceMember } from "../../domain/types";
import { findAuthAccount } from "../authAccounts";
import { commandMeta } from "../events";
import { normalizedEmail } from "../policy";
import type { PrototypeAction } from "../store";

export function loginWithCredentials(
  state: PrototypeState,
  dispatch: Dispatch<PrototypeAction>,
  loginId: string,
  password: string
): boolean {
  const account = findAuthAccount(state.authAccounts, loginId, password);
  if (!account) {
    return false;
  }

  dispatch({
    type: "LOGIN",
    userId: account.userId,
    role: account.role,
    ...commandMeta(state, "로그인", "session", account.userId, "사용자가 로그인했습니다.")
  });
  return true;
}

function userIdFromEmail(email: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < email.length; index += 1) {
    hash ^= email.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  const slug = email.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "member";
  return `user-${slug}-${(hash >>> 0).toString(16)}`;
}

export function requestWorkspaceAccess(
  state: PrototypeState,
  dispatch: Dispatch<PrototypeAction>,
  payload: { code?: string; email: string; name: string; password: string }
): boolean {
  return signup(state, dispatch, payload);
}

export function signup(
  state: PrototypeState,
  dispatch: Dispatch<PrototypeAction>,
  payload: { code?: string; email: string; name: string; password: string }
): boolean {
  const email = normalizedEmail(payload.email);
  const code = (payload.code ?? "").trim().toLowerCase();
  const name = payload.name.trim();
  const password = payload.password.trim();
  if (!email || !name || !password) {
    dispatch({ type: "SET_PERMISSION_DENIED", message: "이름, 이메일, 비밀번호를 모두 입력해 주세요." });
    return false;
  }

  const workspace = code ? state.workspaces.find((item) => item.inviteCode.toLowerCase() === code) : undefined;
  if (code && !workspace) {
    dispatch({ type: "SET_PERMISSION_DENIED", message: "조직코드를 확인할 수 없습니다." });
    return false;
  }

  const existingUser = state.users.find((user) => normalizedEmail(user.email ?? "") === email);
  const existingAccount = state.authAccounts.find((account) => normalizedEmail(account.email ?? account.loginId) === email);
  if (existingAccount && existingAccount.password !== payload.password) {
    dispatch({ type: "SET_PERMISSION_DENIED", message: "이미 등록된 이메일입니다. 기존 비밀번호를 확인해 주세요." });
    return false;
  }

  const user: User = existingUser ?? {
    email,
    id: userIdFromEmail(email),
    name,
    role: "member"
  };
  const account: AuthAccount = existingAccount ?? {
    email,
    loginId: email,
    password,
    role: "member",
    userId: user.id
  };
  const existingMember = workspace ? state.members.find((member) => member.workspaceId === workspace.id && member.userId === user.id) : undefined;
  const member: WorkspaceMember | undefined = workspace ? {
    id: existingMember?.id ?? `member-${workspace.id}-${user.id}`,
    name,
    role: existingMember?.role ?? "member",
    status: existingMember?.status === "active" ? "active" : "pending",
    title: existingMember?.title ?? "",
    userId: user.id,
    workspaceId: workspace.id
  } : undefined;

  dispatch({
    type: "REGISTER_ACCOUNT",
    account,
    member,
    user: { ...user, name },
    workspaceId: workspace?.id,
    ...commandMeta(
      state,
      "회원가입",
      "user",
      user.id,
      workspace ? `${workspace.name} 워크스페이스 가입 신청을 함께 등록했습니다.` : "회원가입을 완료했습니다."
    )
  });
  return true;
}

export function logout(state: PrototypeState, dispatch: Dispatch<PrototypeAction>): void {
  dispatch({
    type: "LOGOUT",
    ...commandMeta(state, "로그아웃", "session", state.session.currentUserId, "사용자가 로그아웃했습니다.")
  });
}

export function loginAsDemoUser(state: PrototypeState, dispatch: Dispatch<PrototypeAction>): void {
  loginWithCredentials(state, dispatch, "test", "test");
}
