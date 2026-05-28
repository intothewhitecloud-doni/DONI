import type { Dispatch } from "react";
import { normalizeTypeLabel } from "../../domain/type-catalog";
import type { PermissionAction, PrototypeState, Role } from "../../domain/types";
import { commandMeta } from "../events";
import { canCurrentUser } from "../permissions";
import { actorCompanyUserForTarget, canManageCompanyUser, companyUserById } from "../policy";
import type { PrototypeAction } from "../store";

function requireCompanyPermission(
  state: PrototypeState,
  dispatch: Dispatch<PrototypeAction>,
  action: PermissionAction,
  message = "현재 역할은 기업 정보를 변경할 수 없습니다."
): boolean {
  if (canCurrentUser(state, action)) {
    return true;
  }

  dispatch({ type: "SET_PERMISSION_DENIED", message });
  return false;
}

function companyCode(): string {
  const segment = Math.floor(1000 + Math.random() * 9000);
  return `DONI-${segment}`;
}

export function updateCompanyProfile(
  state: PrototypeState,
  dispatch: Dispatch<PrototypeAction>,
  payload: { name: string }
): boolean {
  if (!requireCompanyPermission(state, dispatch, "company:manage")) {
    return false;
  }

  dispatch({
    type: "UPDATE_COMPANY",
    name: payload.name,
    ...commandMeta(state, "기업 정보 수정", "company", state.company.id, "기업 소유자가 기업명을 수정했습니다.")
  });
  return true;
}

export function regenerateCompanyCode(state: PrototypeState, dispatch: Dispatch<PrototypeAction>): boolean {
  if (!requireCompanyPermission(state, dispatch, "company:code:manage")) {
    return false;
  }

  dispatch({
    type: "REGENERATE_COMPANY_CODE",
    code: companyCode(),
    notificationId: `notice-company-code-${Date.now()}`,
    ...commandMeta(state, "회사코드 재발급", "company", state.company.id, "기업 소유자가 회사코드를 새로 발급했습니다.")
  });
  return true;
}

export function updateCompanyUser(
  state: PrototypeState,
  dispatch: Dispatch<PrototypeAction>,
  payload: { companyUserId: string; role: Role; title: string; organizationCategoryId: string }
): boolean {
  const target = companyUserById(state, payload.companyUserId);
  if (!requireCompanyPermission(state, dispatch, "company:user:manage", "현재 역할은 해당 사용자 정보를 변경할 수 없습니다.")) {
    return false;
  }

  const actor = actorCompanyUserForTarget(state, target);
  const roleChanged = Boolean(target && target.role !== payload.role);
  const titleChanged = Boolean(target && target.title !== payload.title);
  const categoryChanged = Boolean(target && target.organizationCategoryId !== payload.organizationCategoryId);
  const canUpdateRole = !roleChanged || canManageCompanyUser(actor, target, "update_role", payload.role);
  const canUpdateTitle = !titleChanged || canManageCompanyUser(actor, target, "update_title");
  const canAssignCategory = !categoryChanged || canManageCompanyUser(actor, target, "assign_category");
  if (!target || !canUpdateRole || !canUpdateTitle || !canAssignCategory) {
    dispatch({ type: "SET_PERMISSION_DENIED", message: "현재 역할은 해당 사용자 정보를 변경할 수 없습니다." });
    return false;
  }

  dispatch({
    type: "UPDATE_COMPANY_USER",
    ...payload,
    notificationId: `notice-company-user-update-${Date.now()}`,
    ...commandMeta(state, "사용자 정보 수정", "company_user", payload.companyUserId, "사용자의 역할, 직책 또는 조직을 수정했습니다.")
  });
  return true;
}

export function approveCompanyUser(state: PrototypeState, dispatch: Dispatch<PrototypeAction>, companyUserId: string): boolean {
  const target = companyUserById(state, companyUserId);
  if (!requireCompanyPermission(state, dispatch, "company:user:manage", "현재 역할은 해당 가입 신청을 승인할 수 없습니다.")) {
    return false;
  }

  const actor = actorCompanyUserForTarget(state, target);
  if (!canManageCompanyUser(actor, target, "approve")) {
    dispatch({ type: "SET_PERMISSION_DENIED", message: "현재 역할은 해당 가입 신청을 승인할 수 없습니다." });
    return false;
  }

  dispatch({
    type: "APPROVE_COMPANY_USER",
    companyUserId,
    notificationId: `notice-company-user-approve-${Date.now()}`,
    ...commandMeta(state, "가입 신청 승인", "company_user", companyUserId, "가입 신청을 승인했습니다.")
  });
  return true;
}

export function rejectCompanyUser(state: PrototypeState, dispatch: Dispatch<PrototypeAction>, companyUserId: string): boolean {
  const target = companyUserById(state, companyUserId);
  if (!requireCompanyPermission(state, dispatch, "company:user:manage", "현재 역할은 해당 가입 신청을 반려할 수 없습니다.")) {
    return false;
  }

  const actor = actorCompanyUserForTarget(state, target);
  if (!canManageCompanyUser(actor, target, "reject")) {
    dispatch({ type: "SET_PERMISSION_DENIED", message: "현재 역할은 해당 가입 신청을 반려할 수 없습니다." });
    return false;
  }

  dispatch({
    type: "REJECT_COMPANY_USER",
    companyUserId,
    notificationId: `notice-company-user-reject-${Date.now()}`,
    ...commandMeta(state, "가입 신청 반려", "company_user", companyUserId, "가입 신청을 반려했습니다.")
  });
  return true;
}

export function deleteCompanyUserAccount(state: PrototypeState, dispatch: Dispatch<PrototypeAction>, companyUserId: string): boolean {
  const target = companyUserById(state, companyUserId);
  if (!requireCompanyPermission(state, dispatch, "company:user:manage", "현재 역할은 해당 사용자 계정을 삭제할 수 없습니다.")) {
    return false;
  }

  const actor = actorCompanyUserForTarget(state, target);
  if (!canManageCompanyUser(actor, target, "delete_account")) {
    dispatch({ type: "SET_PERMISSION_DENIED", message: "현재 역할은 해당 사용자 계정을 삭제할 수 없습니다." });
    return false;
  }

  dispatch({
    type: "DELETE_COMPANY_USER_ACCOUNT",
    companyUserId,
    notificationId: `notice-company-user-delete-${Date.now()}`,
    ...commandMeta(state, "사용자 계정 삭제", "company_user", companyUserId, "기업 콘솔에서 사용자 계정을 삭제했습니다.")
  });
  return true;
}

export function addOrganizationCategory(state: PrototypeState, dispatch: Dispatch<PrototypeAction>, name: string): boolean {
  if (!requireCompanyPermission(state, dispatch, "company:organization:manage")) {
    return false;
  }

  const normalizedName = normalizeTypeLabel(name);
  if (!normalizedName) {
    dispatch({ type: "SET_PERMISSION_DENIED", message: "조직 이름을 입력해 주세요." });
    return false;
  }
  if (state.organizationCategories.some((category) => normalizeTypeLabel(category.name) === normalizedName)) {
    dispatch({ type: "SET_PERMISSION_DENIED", message: "이미 등록된 조직입니다." });
    return false;
  }

  dispatch({
    type: "ADD_ORGANIZATION_CATEGORY",
    name: normalizedName,
    notificationId: `notice-organization-category-add-${Date.now()}`,
    ...commandMeta(state, "조직 추가", "organization_category", state.company.id, "조직을 추가했습니다.")
  });
  return true;
}

export function updateOrganizationCategory(
  state: PrototypeState,
  dispatch: Dispatch<PrototypeAction>,
  organizationCategoryId: string,
  name: string
): boolean {
  if (!requireCompanyPermission(state, dispatch, "company:organization:manage")) {
    return false;
  }

  const normalizedName = normalizeTypeLabel(name);
  if (!normalizedName) {
    dispatch({ type: "SET_PERMISSION_DENIED", message: "조직 이름을 입력해 주세요." });
    return false;
  }
  if (
    state.organizationCategories.some(
      (category) => category.id !== organizationCategoryId && normalizeTypeLabel(category.name) === normalizedName
    )
  ) {
    dispatch({ type: "SET_PERMISSION_DENIED", message: "이미 등록된 조직입니다." });
    return false;
  }

  dispatch({
    type: "UPDATE_ORGANIZATION_CATEGORY",
    organizationCategoryId,
    name,
    notificationId: `notice-organization-category-update-${Date.now()}`,
    ...commandMeta(state, "조직 수정", "organization_category", organizationCategoryId, "조직을 수정했습니다.")
  });
  return true;
}

export function deleteOrganizationCategory(
  state: PrototypeState,
  dispatch: Dispatch<PrototypeAction>,
  organizationCategoryId: string
): boolean {
  if (!requireCompanyPermission(state, dispatch, "company:organization:manage")) {
    return false;
  }

  dispatch({
    type: "DELETE_ORGANIZATION_CATEGORY",
    organizationCategoryId,
    notificationId: `notice-organization-category-delete-${Date.now()}`,
    ...commandMeta(state, "조직 삭제", "organization_category", organizationCategoryId, "조직을 삭제했습니다.")
  });
  return true;
}
