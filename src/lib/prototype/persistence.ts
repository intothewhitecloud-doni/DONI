import { createEmptyWorkspaceData, projectWorkspaceData } from "../domain/state-machine";
import type { PrototypeState, Screen, Workspace, WorkspaceMember, WorkspaceOperationalState } from "../domain/types";

const STORAGE_VERSION = 2;
const USER_SESSION_PREFIX = "doni:user-session";
const WORKSPACE_DIRECTORY_KEY = `doni:workspace-directory:v${STORAGE_VERSION}`;
const WORKSPACE_DATA_PREFIX = "doni:workspace-data";
const DEFAULT_PERSISTED_WRITE_BUDGET_BYTES = 4_500_000;

export type PersistedWritePayload = {
  key: string;
  value: string;
};

export type PersistedWriteBudgetResult =
  | { byteSize: number; ok: true; thresholdBytes: number }
  | { byteSize: number; message: string; ok: false; thresholdBytes: number };

export type SaveUserStateResult =
  | { byteSize: number; ok: true; signature: string; skipped?: undefined }
  | { byteSize: 0; ok: true; signature: ""; skipped: "not_logged_in" | "storage_unavailable" }
  | { byteSize: number; message: string; ok: false; rollbackCompleted: boolean; signature: string };

type PersistedUserSession = {
  savedAt: string;
  screen: Screen;
  userId: string;
  version: typeof STORAGE_VERSION;
  workspaceId: string;
};

type PersistedWorkspaceDirectory = {
  members: WorkspaceMember[];
  savedAt: string;
  version: typeof STORAGE_VERSION;
  workspaces: Workspace[];
};

type PersistedWorkspaceData = {
  data: WorkspaceOperationalState;
  savedAt: string;
  version: typeof STORAGE_VERSION;
  workspaceId: string;
};

export function storageKeyForUser(userId: string): string {
  return `${USER_SESSION_PREFIX}:v${STORAGE_VERSION}:${userId}`;
}

export function storageKeyForWorkspaceData(workspaceId: string): string {
  return `${WORKSPACE_DATA_PREFIX}:v${STORAGE_VERSION}:${workspaceId}`;
}

function browserStorage(): Storage | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  return window.localStorage;
}

function parseJson<T>(raw: string | null): T | undefined {
  if (!raw) {
    return undefined;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}

function byteSize(text: string): number {
  if (typeof Blob !== "undefined") {
    return new Blob([text]).size;
  }

  return new TextEncoder().encode(text).byteLength;
}

export function serializedStorageEntryByteSize({ key, value }: PersistedWritePayload): number {
  return byteSize(key) + byteSize(value);
}

export function persistedWritePayloadByteSize(payloads: PersistedWritePayload[]): number {
  return payloads.reduce((total, payload) => total + serializedStorageEntryByteSize(payload), 0);
}

function configuredPersistedWriteBudgetBytes(override?: number): number {
  if (typeof override === "number" && Number.isFinite(override)) {
    return override;
  }

  const globalBudget = (globalThis as { PERSISTED_WRITE_BUDGET_BYTES?: number | string }).PERSISTED_WRITE_BUDGET_BYTES;
  const parsedGlobalBudget = typeof globalBudget === "string" ? Number(globalBudget) : globalBudget;
  if (typeof parsedGlobalBudget === "number" && Number.isFinite(parsedGlobalBudget)) {
    return parsedGlobalBudget;
  }

  if (typeof process !== "undefined") {
    const parsedProcessBudget = Number(process.env.PERSISTED_WRITE_BUDGET_BYTES);
    if (Number.isFinite(parsedProcessBudget) && parsedProcessBudget > 0) {
      return parsedProcessBudget;
    }
  }

  return DEFAULT_PERSISTED_WRITE_BUDGET_BYTES;
}

export function persistedWritePayloadSignature(payloads: PersistedWritePayload[]): string {
  let hash = 0x811c9dc5;
  for (const payload of payloads) {
    const encoded = `${payload.key.length}:${payload.key}${payload.value.length}:${payload.value}`;
    for (let index = 0; index < encoded.length; index += 1) {
      hash ^= encoded.charCodeAt(index);
      hash = Math.imul(hash, 0x01000193);
    }
  }

  return hash.toString(16);
}

export function buildPersistedWritePayloads(state: PrototypeState, savedAt = new Date().toISOString()): PersistedWritePayload[] {
  if (!state.session.loggedIn || !state.session.currentUserId) {
    return [];
  }

  const directory: PersistedWorkspaceDirectory = {
    members: state.members,
    savedAt,
    version: STORAGE_VERSION,
    workspaces: state.workspaces
  };
  const session: PersistedUserSession = {
    savedAt,
    screen: state.screen,
    userId: state.session.currentUserId,
    version: STORAGE_VERSION,
    workspaceId: state.session.workspaceId
  };

  return [
    { key: WORKSPACE_DIRECTORY_KEY, value: JSON.stringify(directory) },
    { key: storageKeyForUser(state.session.currentUserId), value: JSON.stringify(session) },
    ...Object.entries(state.workspaceDataById).map(([workspaceId, data]) => {
      const workspaceData: PersistedWorkspaceData = {
        data,
        savedAt,
        version: STORAGE_VERSION,
        workspaceId
      };

      return { key: storageKeyForWorkspaceData(workspaceId), value: JSON.stringify(workspaceData) };
    })
  ];
}

export function persistedStateSignature(state: PrototypeState): string {
  return persistedWritePayloadSignature(buildPersistedWritePayloads(state, ""));
}

export function checkPersistedWriteBudget(state: PrototypeState, budgetBytes?: number): PersistedWriteBudgetResult {
  const payloads = buildPersistedWritePayloads(state, "");
  const byteSize = persistedWritePayloadByteSize(payloads);
  const thresholdBytes = configuredPersistedWriteBudgetBytes(budgetBytes);
  if (byteSize > thresholdBytes) {
    return {
      byteSize,
      message: `저장 가능한 데이터 보관함 용량을 초과했습니다. 현재 예상 ${byteSize.toLocaleString("ko-KR")} bytes / 한도 ${thresholdBytes.toLocaleString("ko-KR")} bytes`,
      ok: false,
      thresholdBytes
    };
  }

  return { byteSize, ok: true, thresholdBytes };
}

function parseUserSession(raw: string | null, userId: string): PersistedUserSession | undefined {
  const parsed = parseJson<Partial<PersistedUserSession>>(raw);
  if (!parsed || parsed.version !== STORAGE_VERSION || parsed.userId !== userId || !parsed.workspaceId || !parsed.screen) {
    return undefined;
  }

  return parsed as PersistedUserSession;
}

function parseWorkspaceDirectory(raw: string | null): PersistedWorkspaceDirectory | undefined {
  const parsed = parseJson<Partial<PersistedWorkspaceDirectory>>(raw);
  if (!parsed || parsed.version !== STORAGE_VERSION || !parsed.workspaces || !parsed.members) {
    return undefined;
  }

  return parsed as PersistedWorkspaceDirectory;
}

function parseWorkspaceData(raw: string | null, workspaceId: string): WorkspaceOperationalState | undefined {
  const parsed = parseJson<Partial<PersistedWorkspaceData>>(raw);
  if (!parsed || parsed.version !== STORAGE_VERSION || parsed.workspaceId !== workspaceId || !parsed.data) {
    return undefined;
  }

  return parsed.data;
}

function workspaceForUser(
  userId: string,
  workspaces: Workspace[],
  members: WorkspaceMember[],
  preferredWorkspaceId?: string
): string {
  const activeWorkspaceIds = new Set(
    members
      .filter((member) => member.userId === userId && member.status === "active")
      .map((member) => member.workspaceId)
  );

  if (preferredWorkspaceId && activeWorkspaceIds.has(preferredWorkspaceId)) {
    return preferredWorkspaceId;
  }

  return workspaces.find((workspace) => activeWorkspaceIds.has(workspace.id))?.id ?? "";
}

export function loadUserState(userId: string, fallbackState: PrototypeState): PrototypeState | undefined {
  const storage = browserStorage();
  if (!storage) {
    return undefined;
  }

  const directory = parseWorkspaceDirectory(storage.getItem(WORKSPACE_DIRECTORY_KEY));
  const session = parseUserSession(storage.getItem(storageKeyForUser(userId)), userId);
  const workspaces = directory?.workspaces ?? fallbackState.workspaces;
  const members = directory?.members ?? fallbackState.members;
  const activeWorkspaceIds = new Set(
    members
      .filter((member) => member.userId === userId && member.status === "active")
      .map((member) => member.workspaceId)
  );
  let hasPersistedWorkspaceData = false;
  const workspaceDataById = workspaces.reduce<Record<string, WorkspaceOperationalState>>((dataById, workspace) => {
    if (!activeWorkspaceIds.has(workspace.id)) {
      return dataById;
    }
    const persistedWorkspaceData = parseWorkspaceData(storage.getItem(storageKeyForWorkspaceData(workspace.id)), workspace.id);
    if (persistedWorkspaceData) {
      hasPersistedWorkspaceData = true;
    }
    dataById[workspace.id] = persistedWorkspaceData ?? createEmptyWorkspaceData(workspace);
    return dataById;
  }, {});

  const hasSharedState = Boolean(directory || session || hasPersistedWorkspaceData);
  if (!hasSharedState) {
    return undefined;
  }

  const workspaceId = workspaceForUser(userId, workspaces, members, session?.workspaceId);
  const screen = "workspace";

  return projectWorkspaceData(
    {
      ...fallbackState,
      members,
      screen,
      session: { ...fallbackState.session, currentUserId: userId, loggedIn: true, workspaceId },
      workspaces,
      workspaceDataById
    },
    workspaceId
  );
}

export function saveUserState(state: PrototypeState): SaveUserStateResult {
  const signature = persistedStateSignature(state);
  if (!state.session.loggedIn || !state.session.currentUserId) {
    return { byteSize: 0, ok: true, signature: "", skipped: "not_logged_in" };
  }

  const storage = browserStorage();
  if (!storage) {
    return { byteSize: 0, ok: true, signature: "", skipped: "storage_unavailable" };
  }

  const payloads = buildPersistedWritePayloads(state);
  const byteSize = persistedWritePayloadByteSize(payloads);
  const previousValues = payloads.map((payload) => ({ key: payload.key, value: storage.getItem(payload.key) }));

  try {
    for (const payload of payloads) {
      storage.setItem(payload.key, payload.value);
    }

    return { byteSize, ok: true, signature };
  } catch {
    let rollbackCompleted = true;
    for (const previousValue of previousValues) {
      try {
        if (previousValue.value === null) {
          storage.removeItem(previousValue.key);
        } else {
          storage.setItem(previousValue.key, previousValue.value);
        }
      } catch {
        rollbackCompleted = false;
      }
    }

    console.warn("상태를 브라우저 저장소에 저장하지 못했습니다.");
    return {
      byteSize,
      message: rollbackCompleted
        ? "브라우저 저장소에 상태를 저장하지 못했습니다. 이전 저장 상태로 복구했습니다."
        : "브라우저 저장소에 상태를 저장하지 못했고 일부 이전 저장 상태를 복구하지 못했습니다.",
      ok: false,
      rollbackCompleted,
      signature
    };
  }
}

export function screenAfterUserRestore(_screen: Screen, _workspaceId?: string): Screen {
  return "workspace";
}
