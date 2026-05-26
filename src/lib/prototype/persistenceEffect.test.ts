import assert from "node:assert/strict";
import test from "node:test";
import { reducer, type PrototypeAction } from "../domain/state-machine";
import type { PrototypeState } from "../domain/types";
import { persistedStateSignature, type SaveUserStateResult } from "./persistence";
import { createPersistenceEffectController } from "./persistenceEffect";
import { createInitialState } from "./store";

function loggedInState(): PrototypeState {
  const initialState = createInitialState();
  return {
    ...initialState,
    session: { ...initialState.session, currentUserId: "user-admin", loggedIn: true, role: "owner" }
  };
}

function failedSave(state: PrototypeState): SaveUserStateResult {
  return {
    byteSize: 100,
    message: "저장 실패",
    ok: false,
    rollbackCompleted: true,
    signature: persistedStateSignature(state)
  };
}

test("persistence effect suppresses repeated failures for the same persisted payload", () => {
  const controller = createPersistenceEffectController();
  const state = loggedInState();
  const dispatched: PrototypeAction[] = [];
  const deps = {
    dispatch: (action: PrototypeAction) => dispatched.push(action),
    save: failedSave,
    signatureForState: persistedStateSignature
  };

  assert.equal(controller.persist(state, deps), "failed");
  assert.equal(controller.persist({ ...state, simulatedError: "저장 실패" }, deps), "suppressed");
  assert.equal(dispatched.filter((action) => action.type === "SET_SIMULATED_ERROR").length, 1);
});

test("persistence effect retries when the persisted payload changes after a failure", () => {
  const controller = createPersistenceEffectController();
  const state = loggedInState();
  const dispatched: PrototypeAction[] = [];
  const deps = {
    dispatch: (action: PrototypeAction) => dispatched.push(action),
    save: failedSave,
    signatureForState: persistedStateSignature
  };
  const changedState = reducer(state, {
    type: "ADD_SOURCE_FILES",
    files: [
      {
        id: "source-new-failure-signature",
        kind: "업무 문서",
        name: "new-failure.pdf",
        rowCount: 0,
        status: "ready"
      }
    ]
  });

  assert.equal(controller.persist(state, deps), "failed");
  assert.equal(controller.persist(changedState, deps), "failed");
  assert.equal(dispatched.filter((action) => action.type === "SET_SIMULATED_ERROR").length, 2);
});

