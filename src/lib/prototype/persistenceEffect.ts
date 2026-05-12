import type { PrototypeState } from "../domain/types";
import type { PrototypeAction } from "./store";
import { persistedStateSignature, saveUserState, type SaveUserStateResult } from "./persistence";

type PersistenceEffectDeps = {
  dispatch: (action: PrototypeAction) => void;
  save: (state: PrototypeState) => SaveUserStateResult;
  signatureForState: (state: PrototypeState) => string;
};

export type PersistenceEffectResult = "failed" | "saved" | "skipped" | "suppressed";

export function createPersistenceEffectController() {
  let failedPersistenceSignature = "";

  return {
    persist(
      state: PrototypeState,
      {
        dispatch,
        save,
        signatureForState
      }: PersistenceEffectDeps = {
        dispatch: () => undefined,
        save: saveUserState,
        signatureForState: persistedStateSignature
      }
    ): PersistenceEffectResult {
      const signature = signatureForState(state);
      if (failedPersistenceSignature && failedPersistenceSignature === signature) {
        return "suppressed";
      }

      const result = save(state);
      if (result.ok) {
        failedPersistenceSignature = "";
        return result.skipped ? "skipped" : "saved";
      }

      failedPersistenceSignature = result.signature;
      dispatch({ type: "SET_SIMULATED_ERROR", message: result.message });
      return "failed";
    }
  };
}

