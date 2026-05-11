import type { Dispatch } from "react";
import type { PrototypeState } from "../../domain/types";
import { findDemoAccount } from "../authAccounts";
import { commandMeta } from "../events";
import type { PrototypeAction } from "../store";

export function loginWithCredentials(
  state: PrototypeState,
  dispatch: Dispatch<PrototypeAction>,
  loginId: string,
  password: string
): boolean {
  const account = findDemoAccount(loginId, password);
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

export function logout(state: PrototypeState, dispatch: Dispatch<PrototypeAction>): void {
  dispatch({
    type: "LOGOUT",
    ...commandMeta(state, "로그아웃", "session", state.session.currentUserId, "사용자가 로그아웃했습니다.")
  });
}

export function loginAsDemoUser(state: PrototypeState, dispatch: Dispatch<PrototypeAction>): void {
  loginWithCredentials(state, dispatch, "test", "test");
}
