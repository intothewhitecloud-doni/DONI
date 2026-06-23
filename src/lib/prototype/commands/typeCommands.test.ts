import assert from "node:assert/strict";
import test from "node:test";
import { reducer, type PrototypeAction } from "../../domain/state-machine";
import type { DomainTypeDefinition } from "../../domain/types";
import { createInitialState } from "../store";
import { loginWithCredentials } from "./authCommands";
import { addDomainType, deleteDomainType, updateDomainType } from "./typeCommands";

const systemWorkflowType: DomainTypeDefinition = {
  id: "workflow-type-source",
  scope: "workflow",
  label: "원천 기록",
  color: "slate"
};

function loggedInOwnerState(): ReturnType<typeof createInitialState> {
  let state = createInitialState();
  const dispatch = (action: PrototypeAction) => {
    state = reducer(state, action);
  };
  loginWithCredentials(state, dispatch, "owner01", "owner01!");
  return state;
}

function statefulDispatch(initialState = loggedInOwnerState()) {
  let state = initialState;
  const dispatch = (action: PrototypeAction) => {
    state = reducer(state, action);
  };

  return {
    dispatch,
    get state() {
      return state;
    }
  };
}

test("type commands protect system workflow types from user mutation", () => {
  const harness = statefulDispatch({
    ...loggedInOwnerState(),
    workflowTypes: [systemWorkflowType]
  });

  assert.equal(updateDomainType(harness.state, harness.dispatch, "workflow", systemWorkflowType.id, "원천 기록 수정", "blue"), false);
  assert.equal(harness.state.workflowTypes[0].label, "원천 기록");
  assert.match(harness.state.permissionDenied ?? "", /시스템 업무흐름 유형/);

  assert.equal(deleteDomainType(harness.state, harness.dispatch, "workflow", systemWorkflowType.id), false);
  assert.equal(harness.state.workflowTypes.length, 1);
  assert.equal(harness.state.workflowTypes[0].label, "원천 기록");

  assert.equal(addDomainType(harness.state, harness.dispatch, "workflow", "현재 기준 반영", "emerald"), false);
  assert.equal(harness.state.workflowTypes.some((type) => type.label === "현재 기준 반영"), false);
});

test("domain type reducer protects system workflow types even when actions are dispatched directly", () => {
  const harness = statefulDispatch({
    ...loggedInOwnerState(),
    workflowTypes: [systemWorkflowType]
  });

  harness.dispatch({ type: "UPDATE_DOMAIN_TYPE", scope: "workflow", typeId: systemWorkflowType.id, label: "원천 기록 수정", color: "blue" });
  assert.equal(harness.state.workflowTypes[0].label, "원천 기록");
  assert.match(harness.state.permissionDenied ?? "", /시스템 업무흐름 유형/);

  harness.dispatch({ type: "DELETE_DOMAIN_TYPE", scope: "workflow", typeId: systemWorkflowType.id });
  assert.equal(harness.state.workflowTypes.length, 1);
  assert.equal(harness.state.workflowTypes[0].label, "원천 기록");

  harness.dispatch({ type: "ADD_DOMAIN_TYPE", scope: "workflow", label: "정보 보정", color: "orange" });
  assert.equal(harness.state.workflowTypes.some((type) => type.label === "정보 보정"), false);
});
