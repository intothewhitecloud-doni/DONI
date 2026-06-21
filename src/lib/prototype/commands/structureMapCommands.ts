import type { Dispatch } from "react";
import type {
  PrototypeState,
  StructureMapNodePatch,
  StructureMapRelationInput,
  StructureMapRelationPatch,
  StructureMapViewState
} from "../../domain/types";
import { commandMeta } from "../events";
import { canCurrentUser } from "../permissions";
import type { PrototypeAction } from "../store";

function canUseStructureMap(state: PrototypeState): boolean {
  return canCurrentUser(state, "company:read");
}

function structureMapNodeExists(state: PrototypeState, nodeId: string): boolean {
  return (
    state.entities.some((entity) => entity.id === nodeId) ||
    state.events.some((event) => event.id === nodeId) ||
    state.metricDefinitions.some((metric) => metric.id === nodeId) ||
    state.insights.some((insight) => insight.id === nodeId)
  );
}

export function setStructureMapView(dispatch: Dispatch<PrototypeAction>, patch: Partial<StructureMapViewState>): void {
  dispatch({ type: "SET_STRUCTURE_MAP_VIEW", patch });
}

export function updateStructureMapNode(
  state: PrototypeState,
  dispatch: Dispatch<PrototypeAction>,
  nodeId: string,
  patch: StructureMapNodePatch
): boolean {
  if (!canUseStructureMap(state)) {
    dispatch({ type: "SET_PERMISSION_DENIED", message: "현재 역할은 구조맵을 수정할 수 없습니다." });
    return false;
  }

  if (!structureMapNodeExists(state, nodeId)) {
    dispatch({ type: "SET_PERMISSION_DENIED", message: "수정할 구조 맵 노드를 찾지 못했습니다." });
    return false;
  }

  dispatch({
    type: "UPDATE_STRUCTURE_MAP_NODE",
    nodeId,
    patch,
    ...commandMeta(state, "구조맵 노드 수정", "structure_map_node", nodeId, "구조맵 노드 정보를 수정했습니다.")
  });
  return true;
}

export function updateStructureMapRelation(
  state: PrototypeState,
  dispatch: Dispatch<PrototypeAction>,
  relationId: string,
  patch: StructureMapRelationPatch
): boolean {
  if (!canUseStructureMap(state)) {
    dispatch({ type: "SET_PERMISSION_DENIED", message: "현재 역할은 구조맵 관계를 수정할 수 없습니다." });
    return false;
  }

  const relation = state.relations.find((item) => item.id === relationId);
  if (!relation) {
    dispatch({ type: "SET_PERMISSION_DENIED", message: "수정할 관계를 찾지 못했습니다." });
    return false;
  }

  const normalizedPatch = { ...patch };
  if (patch.type !== undefined) {
    const type = patch.type.trim();
    if (!type) {
      dispatch({ type: "SET_PERMISSION_DENIED", message: "관계 유형을 입력해 주세요." });
      return false;
    }
    normalizedPatch.type = type;
  }

  const fromId = normalizedPatch.fromId ?? relation.fromId;
  const toId = normalizedPatch.toId ?? relation.toId;
  if (!structureMapNodeExists(state, fromId) || !structureMapNodeExists(state, toId)) {
    dispatch({ type: "SET_PERMISSION_DENIED", message: "관계의 시작 또는 끝 노드를 찾지 못했습니다." });
    return false;
  }

  dispatch({
    type: "UPDATE_STRUCTURE_MAP_RELATION",
    relationId,
    patch: normalizedPatch,
    ...commandMeta(state, "구조맵 관계 수정", "structure_map_relation", relationId, "구조맵 관계 정보를 수정했습니다.")
  });
  return true;
}

export function addStructureMapRelation(
  state: PrototypeState,
  dispatch: Dispatch<PrototypeAction>,
  relation: StructureMapRelationInput
): boolean {
  if (!canUseStructureMap(state)) {
    dispatch({ type: "SET_PERMISSION_DENIED", message: "현재 역할은 구조맵 관계를 추가할 수 없습니다." });
    return false;
  }

  if (!structureMapNodeExists(state, relation.fromId) || !structureMapNodeExists(state, relation.toId)) {
    dispatch({ type: "SET_PERMISSION_DENIED", message: "관계의 시작 또는 끝 노드를 찾지 못했습니다." });
    return false;
  }

  if (!relation.type.trim()) {
    dispatch({ type: "SET_PERMISSION_DENIED", message: "관계 유형을 입력해 주세요." });
    return false;
  }

  dispatch({
    type: "ADD_STRUCTURE_MAP_RELATION",
    relation,
    ...commandMeta(state, "구조맵 관계 추가", "structure_map_relation", relation.id ?? relation.type, "구조맵 관계를 추가했습니다.")
  });
  return true;
}

export function deleteStructureMapRelation(
  state: PrototypeState,
  dispatch: Dispatch<PrototypeAction>,
  relationId: string
): boolean {
  if (!canUseStructureMap(state)) {
    dispatch({ type: "SET_PERMISSION_DENIED", message: "현재 역할은 구조맵 관계를 삭제할 수 없습니다." });
    return false;
  }

  if (!state.relations.some((relation) => relation.id === relationId)) {
    dispatch({ type: "SET_PERMISSION_DENIED", message: "삭제할 관계를 찾지 못했습니다." });
    return false;
  }

  dispatch({
    type: "DELETE_STRUCTURE_MAP_RELATION",
    relationId,
    ...commandMeta(state, "구조맵 관계 삭제", "structure_map_relation", relationId, "구조맵 관계를 삭제했습니다.")
  });
  return true;
}

export function hideStructureMapItem(dispatch: Dispatch<PrototypeAction>, itemId: string, kind: "node" | "edge"): void {
  dispatch({ type: "HIDE_STRUCTURE_MAP_ITEM", itemId, kind });
}

export function unhideStructureMapItem(dispatch: Dispatch<PrototypeAction>, itemId: string, kind: "node" | "edge"): void {
  dispatch({ type: "UNHIDE_STRUCTURE_MAP_ITEM", itemId, kind });
}
