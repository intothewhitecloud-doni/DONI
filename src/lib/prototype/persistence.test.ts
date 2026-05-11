import assert from "node:assert/strict";
import test from "node:test";
import { commandMeta } from "./events";
import { loadUserState, saveUserState, screenAfterUserRestore, storageKeyForUser, storageKeyForWorkspaceData } from "./persistence";
import { createInitialState } from "./store";
import { reducer, type PrototypeAction } from "../domain/state-machine";

class MemoryStorage implements Storage {
  private readonly store = new Map<string, string>();

  get length() {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
}

function installStorage(storage: Storage): void {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { localStorage: storage },
    writable: true
  });
}

function audited(state: ReturnType<typeof createInitialState>, action: PrototypeAction, label: string, targetType: string, targetId: string): PrototypeAction {
  return { ...action, ...commandMeta(state, label, targetType, targetId, `${label} 테스트`) };
}

test("workspace data persists by group and is shared across login users", () => {
  const storage = new MemoryStorage();
  installStorage(storage);
  const initialState = createInitialState();

  const initial = {
    ...initialState,
    session: { ...initialState.session, currentUserId: "user-admin", loggedIn: true, role: "admin" as const }
  };
  const added = reducer(
    initial,
    audited(
      initial,
      {
        type: "ADD_SOURCE_FILES",
        files: [
          {
            id: "source-shared-workspace",
            kind: "표 형식 데이터",
            name: "공유_그룹_파일.csv",
            rowCount: 7,
            status: "ready"
          }
        ]
      },
      "파일 추가",
      "source_file",
      "source-shared-workspace"
    )
  );

  saveUserState(added);
  const loadedForManager = loadUserState("user-manager", createInitialState());

  assert.ok(loadedForManager);
  assert.equal(loadedForManager.session.currentUserId, "user-manager");
  assert.equal(loadedForManager.session.workspaceId, "workspace-next-manufacturing");
  assert.equal(loadedForManager.sourceFiles[0].name, "공유_그룹_파일.csv");
});

test("legacy v1 user state is ignored by v2 workspace persistence", () => {
  const storage = new MemoryStorage();
  installStorage(storage);
  storage.setItem(
    "doni:user-state:v1:user-manager",
    JSON.stringify({
      state: { sourceFiles: [{ id: "legacy", name: "이전_사용자_파일.csv" }] },
      userId: "user-manager",
      version: 1
    })
  );

  const loaded = loadUserState("user-manager", createInitialState());

  assert.equal(loaded, undefined);
});

test("preferred workspace restore requires active membership", () => {
  const storage = new MemoryStorage();
  installStorage(storage);
  const initial = {
    ...createInitialState(),
    session: { ...createInitialState().session, currentUserId: "user-manager", loggedIn: true, role: "manager" as const }
  };
  saveUserState(initial);
  storage.setItem(
    storageKeyForUser("user-manager"),
    JSON.stringify({
      savedAt: "2026-05-09T00:00:00.000Z",
      screen: "dashboard",
      userId: "user-manager",
      version: 2,
      workspaceId: "workspace-health-supply"
    })
  );

  const loaded = loadUserState("user-manager", createInitialState());

  assert.ok(loaded);
  assert.equal(loaded.session.workspaceId, "workspace-next-manufacturing");
});

test("restored login always starts at workspace selection", () => {
  assert.equal(screenAfterUserRestore("organization", "workspace-next-manufacturing"), "workspace");
  assert.equal(screenAfterUserRestore("proposalVote", "workspace-next-manufacturing"), "workspace");
  assert.equal(screenAfterUserRestore("workspace", "workspace-next-manufacturing"), "workspace");
  assert.equal(screenAfterUserRestore("dashboard", ""), "workspace");
});

test("missing workspace payload restores empty data instead of caller fallback data", () => {
  const storage = new MemoryStorage();
  installStorage(storage);
  const initial = {
    ...createInitialState(),
    session: { ...createInitialState().session, currentUserId: "user-manager", loggedIn: true, role: "manager" as const }
  };
  saveUserState(initial);
  storage.removeItem(storageKeyForWorkspaceData("workspace-next-manufacturing"));

  const contaminatedFallback = {
    ...createInitialState(),
    workspaceDataById: {
      ...createInitialState().workspaceDataById,
      "workspace-next-manufacturing": {
        ...createInitialState().workspaceDataById["workspace-next-manufacturing"],
        sourceFiles: [
          {
            id: "source-contaminated",
            kind: "표 형식 데이터",
            name: "다른_사용자_메모리.csv",
            rowCount: 1,
            status: "ready" as const
          }
        ]
      }
    }
  };
  const loaded = loadUserState("user-manager", contaminatedFallback);

  assert.ok(loaded);
  assert.equal(loaded.sourceFiles.length, 0);
});
