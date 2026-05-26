import assert from "node:assert/strict";
import test from "node:test";
import { commandMeta } from "./events";
import {
  buildPersistedWritePayloads,
  checkPersistedWriteBudget,
  persistedStateSignature,
  persistedWritePayloadByteSize,
  saveUserState,
  loadUserState,
  screenAfterUserRestore,
  serializedStorageEntryByteSize,
  storageKeyForUser,
  storageKeyForWorkspaceData
} from "./persistence";
import { sampleMetricValues } from "../domain/sample-analysis";
import { createInitialState } from "./store";
import { reducer, type PrototypeAction } from "../domain/state-machine";

class MemoryStorage implements Storage {
  protected readonly store = new Map<string, string>();

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

class FailingStorage extends MemoryStorage {
  private writeCount = 0;

  constructor(private readonly failOnWrite: number) {
    super();
  }

  seed(key: string, value: string): void {
    this.store.set(key, value);
  }

  override setItem(key: string, value: string): void {
    this.writeCount += 1;
    if (this.writeCount === this.failOnWrite) {
      throw new Error("quota exceeded");
    }

    super.setItem(key, value);
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

function loggedInState(): ReturnType<typeof createInitialState> {
  const initialState = createInitialState();
  return {
    ...initialState,
    session: { ...initialState.session, currentUserId: "user-admin", loggedIn: true, role: "owner" as const }
  };
}

test("workspace data persists by group and is shared across login users", () => {
  const storage = new MemoryStorage();
  installStorage(storage);
  const initialState = createInitialState();

  const initial = {
    ...initialState,
    session: { ...initialState.session, currentUserId: "user-admin", loggedIn: true, role: "owner" as const }
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

test("workspace directory restore strips legacy workspace fields and global user title", () => {
  const storage = new MemoryStorage();
  installStorage(storage);
  const state = loggedInState();
  saveUserState(state);
  const directoryKey = buildPersistedWritePayloads(state).find((payload) => payload.key.includes("workspace-directory"))?.key;
  assert.ok(directoryKey);
  const directory = JSON.parse(storage.getItem(directoryKey) ?? "{}");
  directory.users = directory.users.map((user: Record<string, unknown>) => ({ ...user, title: "legacy user title" }));
  directory.workspaces = directory.workspaces.map((workspace: Record<string, unknown>) => ({
    ...workspace,
    decisionGoal: "legacy decision goal",
    industry: "legacy industry"
  }));
  storage.setItem(directoryKey, JSON.stringify(directory));

  const loaded = loadUserState("user-admin", createInitialState());

  assert.ok(loaded);
  assert.equal("title" in loaded.users[0], false);
  assert.equal("industry" in loaded.workspaces[0], false);
  assert.equal("decisionGoal" in loaded.workspaces[0], false);
  assert.equal(loaded.members[0].title.length > 0, true);
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

test("restored legacy claim-rate time series is migrated to dated weekly points", () => {
  const storage = new MemoryStorage();
  installStorage(storage);
  const state = loggedInState();
  const workspaceId = "workspace-next-manufacturing";
  const currentClaimRate = sampleMetricValues.find((metricValue) => metricValue.id === "metric-value-claim");
  if (!currentClaimRate) {
    assert.fail("클레임률 샘플 지표가 필요합니다.");
  }
  const legacyClaimRate = {
    ...structuredClone(currentClaimRate),
    basis: {
      claimRows: 4,
      customerSegment: "고객A",
      p42ClaimRows: 4,
      p42OrderRows: 4
    },
    series: [
      { label: "일반 고객군", value: 0 },
      { label: "핵심 고객군", value: 100 },
      { label: "P-08", value: 0 },
      { label: "P-42", value: 100 }
    ]
  };

  saveUserState({
    ...state,
    workspaceDataById: {
      ...state.workspaceDataById,
      [workspaceId]: {
        ...state.workspaceDataById[workspaceId],
        metricValues: [legacyClaimRate]
      }
    }
  });

  const loaded = loadUserState("user-admin", createInitialState());
  const restoredClaimRate = loaded?.metricValues.find((metricValue) => metricValue.id === "metric-value-claim");

  assert.ok(restoredClaimRate);
  assert.deepEqual(restoredClaimRate.series.map((point) => point.label), ["4/24", "5/1", "5/8", "5/15"]);
  assert.equal(restoredClaimRate.series.every((point) => Boolean(point.observedAt)), true);
  assert.equal(restoredClaimRate.basis?.timeWindow, "2026-04-24~2026-05-15");
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

test("persisted write byte size uses the serialized key and value payloads", () => {
  const state = loggedInState();
  const payloads = buildPersistedWritePayloads(state);
  const expectedSize = payloads.reduce((total, payload) => total + serializedStorageEntryByteSize(payload), 0);
  const exactBudget = checkPersistedWriteBudget(state, expectedSize);

  assert.equal(persistedWritePayloadByteSize(payloads), expectedSize);
  assert.equal(exactBudget.ok, true);
  assert.equal(exactBudget.byteSize, expectedSize);
  assert.equal(checkPersistedWriteBudget(state, expectedSize - 1).ok, false);
});

test("persisted state signature ignores transient UI errors but changes for persisted payload changes", () => {
  const state = loggedInState();
  const erroredState = { ...state, simulatedError: "저장 실패" };
  const added = reducer(
    state,
    audited(
      state,
      {
        type: "ADD_SOURCE_FILES",
        files: [
          {
            id: "source-persisted-signature",
            kind: "업무 파일",
            name: "signature.pdf",
            rowCount: 0,
            status: "ready"
          }
        ]
      },
      "파일 추가",
      "source_file",
      "source-persisted-signature"
    )
  );

  assert.equal(persistedStateSignature(state), persistedStateSignature(erroredState));
  assert.notEqual(persistedStateSignature(state), persistedStateSignature(added));
});

test("save failure restores previous storage values and returns failure result", () => {
  const previousState = loggedInState();
  const nextState = reducer(
    previousState,
    audited(
      previousState,
      {
        type: "ADD_SOURCE_FILES",
        files: [
          {
            id: "source-rollback",
            kind: "업무 파일",
            name: "rollback.pdf",
            rowCount: 0,
            status: "ready"
          }
        ]
      },
      "파일 추가",
      "source_file",
      "source-rollback"
    )
  );
  const storage = new FailingStorage(2);
  installStorage(storage);
  const previousPayloads = buildPersistedWritePayloads(previousState, "2026-05-09T00:00:00.000Z");
  previousPayloads.forEach((payload) => storage.seed(payload.key, payload.value));

  const result = saveUserState(nextState);

  assert.equal(result.ok, false);
  if (result.ok) {
    assert.fail("저장 실패 결과가 필요합니다.");
  }
  assert.equal(result.rollbackCompleted, true);
  previousPayloads.forEach((payload) => {
    assert.equal(storage.getItem(payload.key), payload.value);
  });
});
