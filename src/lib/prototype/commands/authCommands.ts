import type { Dispatch } from "react";
import type { AuthAccount, CompanyUser, PrototypeState, User } from "../../domain/types";
import { UNASSIGNED_ORGANIZATION_CATEGORY_ID } from "../../domain/types";
import { findAuthAccount } from "../authAccounts";
import { commandMeta } from "../events";
import { normalizedEmail } from "../policy";
import type { PrototypeAction } from "../store";

export const APPROVAL_PENDING_MESSAGE = "가입 신청이 등록되었습니다. 승인 완료 후 접속할 수 있습니다.";
export const LOGIN_FAILED_MESSAGE = "아이디 또는 비밀번호를 확인해 주세요.";

export function loginWithCredentials(
  state: PrototypeState,
  dispatch: Dispatch<PrototypeAction>,
  loginId: string,
  password: string
): boolean {
  const account = findAuthAccount(state.authAccounts, loginId, password);
  if (!account) {
    dispatch({ type: "SET_PERMISSION_DENIED", message: LOGIN_FAILED_MESSAGE });
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

  const slug = email.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "company-user";
  return `user-${slug}-${(hash >>> 0).toString(16)}`;
}

export function signup(
  state: PrototypeState,
  dispatch: Dispatch<PrototypeAction>,
  payload: { code: string; email: string; name: string; password: string }
): boolean {
  const email = normalizedEmail(payload.email);
  const code = payload.code.trim().toLowerCase();
  const name = payload.name.trim();
  const password = payload.password.trim();
  if (!email || !name || !password || !code) {
    dispatch({ type: "SET_PERMISSION_DENIED", message: "이름, 이메일, 비밀번호, 회사코드를 모두 입력해 주세요." });
    return false;
  }

  if (state.company.code.toLowerCase() !== code) {
    dispatch({ type: "SET_PERMISSION_DENIED", message: "회사코드를 확인할 수 없습니다." });
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
    role: "manager"
  };
  const account: AuthAccount = existingAccount ?? {
    email,
    loginId: email,
    password,
    role: "manager",
    userId: user.id
  };
  const existingCompanyUser = state.companyUsers.find((companyUser) => companyUser.userId === user.id);
  const companyUser: CompanyUser = {
    id: existingCompanyUser?.id ?? `company-user-${user.id}`,
    name,
    email,
    role: existingCompanyUser?.role ?? "manager",
    status: existingCompanyUser?.status === "active" ? "active" : "pending",
    title: existingCompanyUser?.title ?? "",
    userId: user.id,
    organizationCategoryId: existingCompanyUser?.organizationCategoryId ?? UNASSIGNED_ORGANIZATION_CATEGORY_ID
  };

  dispatch({
    type: "REGISTER_ACCOUNT",
    account,
    companyUser,
    user: { ...user, name },
    ...commandMeta(
      state,
      "회원가입",
      "company_user",
      user.id,
      `${state.company.name} 기업 콘솔 가입 신청을 등록했습니다.`
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
