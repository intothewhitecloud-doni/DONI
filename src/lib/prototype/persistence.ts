import { createEmptyWorkspaceData, projectWorkspaceData } from "../domain/state-machine";
import type { PrototypeState, Screen, Workspace, WorkspaceMember, WorkspaceOperationalState } from "../domain/types";

const STORAGE_VERSION = 2;
const USER_SESSION_PREFIX = "doni:user-session";
const WORKSPACE_DIRECTORY_KEY = `doni:workspace-directory:v${STORAGE_VERSION}`;
const WORKSPACE_DATA_PREFIX = "doni:workspace-data";

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

export function saveUserState(state: PrototypeState): void {
  if (!state.session.loggedIn || !state.session.currentUserId) {
    return;
  }

  const storage = browserStorage();
  if (!storage) {
    return;
  }

  const savedAt = new Date().toISOString();
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

  try {
    storage.setItem(WORKSPACE_DIRECTORY_KEY, JSON.stringify(directory));
    storage.setItem(storageKeyForUser(state.session.currentUserId), JSON.stringify(session));

    for (const [workspaceId, data] of Object.entries(state.workspaceDataById)) {
      const workspaceData: PersistedWorkspaceData = {
        data,
        savedAt,
        version: STORAGE_VERSION,
        workspaceId
      };
      storage.setItem(storageKeyForWorkspaceData(workspaceId), JSON.stringify(workspaceData));
    }
  } catch {
    console.warn("상태를 브라우저 저장소에 저장하지 못했습니다.");
  }
}

export function screenAfterUserRestore(_screen: Screen, _workspaceId?: string): Screen {
  return "workspace";
}
