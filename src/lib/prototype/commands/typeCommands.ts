import type { Dispatch } from "react";
import type { DomainTypeScope, PrototypeState } from "../../domain/types";
import { isSystemDomainType, isSystemWorkflowTypeLabel, normalizeTypeColor, normalizeTypeLabel } from "../../domain/type-catalog";
import { commandMeta } from "../events";
import { canCurrentUser } from "../permissions";
import type { PrototypeAction } from "../store";

function scopeLabel(scope: DomainTypeScope): string {
  return scope === "managed_object" ? "관리대상" : "업무흐름";
}

function catalogForScope(state: PrototypeState, scope: DomainTypeScope) {
  return scope === "managed_object" ? state.managedObjectTypes : state.workflowTypes;
}

export function addDomainType(
  state: PrototypeState,
  dispatch: Dispatch<PrototypeAction>,
  scope: DomainTypeScope,
  label: string,
  color?: string
): boolean {
  if (!canCurrentUser(state, "company:type:manage")) {
    dispatch({ type: "SET_PERMISSION_DENIED", message: "현재 역할은 유형을 관리할 수 없습니다." });
    return false;
  }

  const normalizedLabel = normalizeTypeLabel(label);
  if (!normalizedLabel) {
    dispatch({ type: "SET_PERMISSION_DENIED", message: "추가할 유형 이름을 입력해 주세요." });
    return false;
  }
  if (isSystemWorkflowTypeLabel(scope, normalizedLabel)) {
    dispatch({ type: "SET_PERMISSION_DENIED", message: "시스템 업무흐름 유형은 추가/수정/삭제할 수 없습니다." });
    return false;
  }

  if (catalogForScope(state, scope).some((item) => normalizeTypeLabel(item.label) === normalizedLabel)) {
    dispatch({ type: "SET_PERMISSION_DENIED", message: "이미 등록된 유형입니다." });
    return false;
  }

  dispatch({
    type: "ADD_DOMAIN_TYPE",
    scope,
    label: normalizedLabel,
    color: normalizeTypeColor(color),
    notificationId: `notice-type-add-${Date.now()}`,
    ...commandMeta(state, `${scopeLabel(scope)} 유형 추가`, "domain_type", scope, `${normalizedLabel} 유형을 추가했습니다.`)
  });
  return true;
}

export function updateDomainType(
  state: PrototypeState,
  dispatch: Dispatch<PrototypeAction>,
  scope: DomainTypeScope,
  typeId: string,
  label: string,
  color?: string
): boolean {
  if (!canCurrentUser(state, "company:type:manage")) {
    dispatch({ type: "SET_PERMISSION_DENIED", message: "현재 역할은 유형을 관리할 수 없습니다." });
    return false;
  }

  const normalizedLabel = normalizeTypeLabel(label);
  if (!normalizedLabel) {
    dispatch({ type: "SET_PERMISSION_DENIED", message: "수정할 유형 이름을 입력해 주세요." });
    return false;
  }

  const current = catalogForScope(state, scope).find((item) => item.id === typeId);
  if (!current) {
    dispatch({ type: "SET_PERMISSION_DENIED", message: "수정할 유형을 찾지 못했습니다." });
    return false;
  }
  if (isSystemDomainType(current) || isSystemWorkflowTypeLabel(scope, normalizedLabel)) {
    dispatch({ type: "SET_PERMISSION_DENIED", message: "시스템 업무흐름 유형은 추가/수정/삭제할 수 없습니다." });
    return false;
  }

  if (catalogForScope(state, scope).some((item) => item.id !== typeId && normalizeTypeLabel(item.label) === normalizedLabel)) {
    dispatch({ type: "SET_PERMISSION_DENIED", message: "이미 등록된 유형입니다." });
    return false;
  }

  dispatch({
    type: "UPDATE_DOMAIN_TYPE",
    scope,
    typeId,
    label: normalizedLabel,
    color: color === undefined ? undefined : normalizeTypeColor(color),
    notificationId: `notice-type-update-${Date.now()}`,
    ...commandMeta(state, `${scopeLabel(scope)} 유형 수정`, "domain_type", typeId, `${normalizedLabel} 유형으로 수정했습니다.`)
  });
  return true;
}

export function deleteDomainType(
  state: PrototypeState,
  dispatch: Dispatch<PrototypeAction>,
  scope: DomainTypeScope,
  typeId: string
): boolean {
  if (!canCurrentUser(state, "company:type:manage")) {
    dispatch({ type: "SET_PERMISSION_DENIED", message: "현재 역할은 유형을 관리할 수 없습니다." });
    return false;
  }

  const current = catalogForScope(state, scope).find((item) => item.id === typeId);
  if (!current) {
    dispatch({ type: "SET_PERMISSION_DENIED", message: "삭제할 유형을 찾지 못했습니다." });
    return false;
  }
  if (isSystemDomainType(current)) {
    dispatch({ type: "SET_PERMISSION_DENIED", message: "시스템 업무흐름 유형은 추가/수정/삭제할 수 없습니다." });
    return false;
  }

  dispatch({
    type: "DELETE_DOMAIN_TYPE",
    scope,
    typeId,
    notificationId: `notice-type-delete-${Date.now()}`,
    ...commandMeta(state, `${scopeLabel(scope)} 유형 삭제`, "domain_type", typeId, `${current.label} 유형을 삭제했습니다.`)
  });
  return true;
}
