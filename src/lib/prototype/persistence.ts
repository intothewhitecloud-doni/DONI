import { initialPrototypeState } from "../domain/mock-data";
import { companyDataFromState, normalizeCompanyData } from "../domain/state-machine";
import type { AuthAccount, Company, CompanyOperationalState, CompanyUser, OrganizationCategory, PrototypeState, Screen, StructureMapViewState, User } from "../domain/types";
import { normalizeCompanyUserStatus, normalizeLegacyRole, normalizeProposalVoters } from "../domain/policy";

const STORAGE_VERSION = 3;
const USER_SESSION_PREFIX = "doni:company-console:user-session";
const COMPANY_DIRECTORY_KEY = `doni:company-console:directory:v${STORAGE_VERSION}`;
const COMPANY_DATA_PREFIX = "doni:company-console:data";
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
  structureMapView?: StructureMapViewState;
  userId: string;
  version: typeof STORAGE_VERSION;
};

type PersistedCompanyDirectory = {
  authAccounts?: AuthAccount[];
  company: Company;
  companyUsers: CompanyUser[];
  organizationCategories: OrganizationCategory[];
  savedAt: string;
  users?: User[];
  version: typeof STORAGE_VERSION;
};

type PersistedCompanyData = {
  data: CompanyOperationalState;
  savedAt: string;
  version: typeof STORAGE_VERSION;
};

export function storageKeyForUser(userId: string): string {
  return `${USER_SESSION_PREFIX}:v${STORAGE_VERSION}:${userId}`;
}

export function storageKeyForCompanyData(companyId: string): string {
  return `${COMPANY_DATA_PREFIX}:v${STORAGE_VERSION}:${companyId}`;
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

function directorySnapshot(state: Pick<PrototypeState, "authAccounts" | "company" | "companyUsers" | "organizationCategories" | "users">) {
  return {
    authAccounts: state.authAccounts,
    company: state.company,
    companyUsers: state.companyUsers,
    organizationCategories: state.organizationCategories,
    users: state.users
  };
}

function hasDirectoryChanges(state: PrototypeState): boolean {
  return JSON.stringify(directorySnapshot(state)) !== JSON.stringify(directorySnapshot(initialPrototypeState));
}

function buildCompanyDirectory(state: PrototypeState, savedAt: string): PersistedCompanyDirectory {
  return {
    ...directorySnapshot(state),
    savedAt,
    version: STORAGE_VERSION
  };
}

export function buildPersistedWritePayloads(state: PrototypeState, savedAt = new Date().toISOString()): PersistedWritePayload[] {
  const shouldPersistSession = state.session.loggedIn && Boolean(state.session.currentUserId);
  const shouldPersistDirectory = shouldPersistSession || hasDirectoryChanges(state);
  if (!shouldPersistDirectory) {
    return [];
  }

  const directory = buildCompanyDirectory(state, savedAt);
  if (!shouldPersistSession || !state.session.currentUserId) {
    return [{ key: COMPANY_DIRECTORY_KEY, value: JSON.stringify(directory) }];
  }

  const session: PersistedUserSession = {
    savedAt,
    screen: state.screen,
    structureMapView: state.structureMapView,
    userId: state.session.currentUserId,
    version: STORAGE_VERSION
  };
  const companyData: PersistedCompanyData = {
    data: companyDataFromState(state),
    savedAt,
    version: STORAGE_VERSION
  };

  return [
    { key: COMPANY_DIRECTORY_KEY, value: JSON.stringify(directory) },
    { key: storageKeyForUser(state.session.currentUserId), value: JSON.stringify(session) },
    { key: storageKeyForCompanyData(state.company.id), value: JSON.stringify(companyData) }
  ];
}

export function persistedStateSignature(state: PrototypeState): string {
  const payloads = buildPersistedWritePayloads(state, "");
  return payloads.length === 0 ? "" : persistedWritePayloadSignature(payloads);
}

export function checkPersistedWriteBudget(state: PrototypeState, budgetBytes?: number): PersistedWriteBudgetResult {
  const payloads = buildPersistedWritePayloads(state);
  const entryByteSize = persistedWritePayloadByteSize(payloads);
  const thresholdBytes = configuredPersistedWriteBudgetBytes(budgetBytes);
  if (entryByteSize > thresholdBytes) {
    return {
      byteSize: entryByteSize,
      message: `저장 가능한 데이터 보관함 용량을 초과했습니다. 현재 예상 ${entryByteSize.toLocaleString("ko-KR")} bytes / 한도 ${thresholdBytes.toLocaleString("ko-KR")} bytes`,
      ok: false,
      thresholdBytes
    };
  }

  return { byteSize: entryByteSize, ok: true, thresholdBytes };
}

function parseUserSession(raw: string | null, userId: string): PersistedUserSession | undefined {
  const parsed = parseJson<Partial<PersistedUserSession>>(raw);
  if (!parsed || parsed.version !== STORAGE_VERSION || parsed.userId !== userId || !parsed.screen) {
    return undefined;
  }

  return parsed as PersistedUserSession;
}

function normalizeUser(user: User & { title?: string }): User {
  const { title: _legacyTitle, ...rest } = user;
  return {
    ...rest,
    email: user.email?.trim().toLowerCase(),
    role: normalizeLegacyRole(user.role)
  };
}

function normalizeAuthAccount(account: AuthAccount): AuthAccount {
  return {
    ...account,
    email: account.email?.trim().toLowerCase(),
    role: normalizeLegacyRole(account.role)
  };
}

function normalizeCompanyUser(companyUser: CompanyUser & { status?: string; role?: string }): CompanyUser {
  return {
    ...companyUser,
    title: companyUser.title ?? "",
    role: normalizeLegacyRole(companyUser.role),
    status: normalizeCompanyUserStatus(companyUser.status)
  };
}

function normalizePersistedCompanyData(data: PrototypeState): PrototypeState {
  const normalized = normalizeCompanyData({
    ...data,
    proposals: data.proposals.map((proposal) => {
      const normalizedProposal = normalizeProposalVoters(proposal as Partial<typeof proposal> & Record<string, unknown>);
      return {
        ...proposal,
        votingRule: {
          ...proposal.votingRule,
          tieBreakerRole: normalizeLegacyRole(proposal.votingRule.tieBreakerRole)
        },
        voterUserIds: normalizedProposal.voterUserIds
      };
    })
  });
  return {
    ...data,
    ...normalized,
    authAccounts: data.authAccounts.map(normalizeAuthAccount),
    users: data.users.map(normalizeUser),
    companyUsers: data.companyUsers.map(normalizeCompanyUser)
  };
}

function parseCompanyDirectory(raw: string | null): PersistedCompanyDirectory | undefined {
  const parsed = parseJson<Partial<PersistedCompanyDirectory>>(raw);
  if (!parsed || parsed.version !== STORAGE_VERSION || !parsed.company || !parsed.companyUsers) {
    return undefined;
  }

  return {
    ...parsed,
    authAccounts: parsed.authAccounts?.map(normalizeAuthAccount),
    companyUsers: parsed.companyUsers.map(normalizeCompanyUser),
    users: parsed.users?.map(normalizeUser),
    version: STORAGE_VERSION
  } as PersistedCompanyDirectory;
}

function parseCompanyData(raw: string | null): CompanyOperationalState | undefined {
  const parsed = parseJson<Partial<PersistedCompanyData>>(raw);
  if (!parsed || parsed.version !== STORAGE_VERSION || !parsed.data) {
    return undefined;
  }

  const { structureMapView: _legacyStructureMapView, ...companyData } = parsed.data as CompanyOperationalState & {
    structureMapView?: StructureMapViewState;
  };
  return normalizeCompanyData(companyData);
}

export function loadUserState(userId: string, fallbackState: PrototypeState): PrototypeState | undefined {
  const storage = browserStorage();
  if (!storage) {
    return undefined;
  }

  const directory = parseCompanyDirectory(storage.getItem(COMPANY_DIRECTORY_KEY));
  const session = parseUserSession(storage.getItem(storageKeyForUser(userId)), userId);
  const companyId = directory?.company.id ?? fallbackState.company.id;
  const persistedData = parseCompanyData(storage.getItem(storageKeyForCompanyData(companyId)));
  const hasSharedState = Boolean(directory || session || persistedData);
  if (!hasSharedState) {
    return undefined;
  }

  const base = persistedData ? { ...fallbackState, ...persistedData } : fallbackState;
  const companyUsers = directory?.companyUsers ?? base.companyUsers;
  const activeCompanyUser = companyUsers.find((companyUser) => companyUser.userId === userId && companyUser.status === "active");
  const screen = activeCompanyUser ? screenAfterUserRestore(session?.screen ?? base.screen) : "login";

  return normalizePersistedCompanyData({
    ...base,
    authAccounts: directory?.authAccounts ?? base.authAccounts,
    company: directory?.company ?? base.company,
    companyUsers,
    organizationCategories: directory?.organizationCategories ?? base.organizationCategories,
    screen,
    session: {
      ...base.session,
      currentUserId: userId,
      loggedIn: Boolean(activeCompanyUser),
      role: activeCompanyUser?.role ?? base.session.role
    },
    structureMapView: session?.structureMapView ?? base.structureMapView,
    users: directory?.users ?? base.users
  });
}

export function loadCompanyDirectoryState(fallbackState: PrototypeState): PrototypeState {
  const storage = browserStorage();
  if (!storage) {
    return fallbackState;
  }

  const directory = parseCompanyDirectory(storage.getItem(COMPANY_DIRECTORY_KEY));
  if (!directory) {
    return fallbackState;
  }

  return normalizePersistedCompanyData({
    ...fallbackState,
    authAccounts: directory.authAccounts ?? fallbackState.authAccounts,
    company: directory.company,
    companyUsers: directory.companyUsers,
    organizationCategories: directory.organizationCategories,
    users: directory.users ?? fallbackState.users
  });
}

export function saveUserState(state: PrototypeState): SaveUserStateResult {
  const payloads = buildPersistedWritePayloads(state);
  const signature = payloads.length === 0 ? "" : persistedWritePayloadSignature(payloads);
  if (payloads.length === 0) {
    return { byteSize: 0, ok: true, signature: "", skipped: "not_logged_in" };
  }

  const storage = browserStorage();
  if (!storage) {
    return { byteSize: 0, ok: true, signature: "", skipped: "storage_unavailable" };
  }

  const entryByteSize = persistedWritePayloadByteSize(payloads);
  const previousValues = payloads.map((payload) => ({ key: payload.key, value: storage.getItem(payload.key) }));

  try {
    for (const payload of payloads) {
      storage.setItem(payload.key, payload.value);
    }

    return { byteSize: entryByteSize, ok: true, signature };
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
      byteSize: entryByteSize,
      message: rollbackCompleted
        ? "브라우저 저장소에 상태를 저장하지 못했습니다. 이전 저장 상태로 복구했습니다."
        : "브라우저 저장소에 상태를 저장하지 못했고 일부 이전 저장 상태를 복구하지 못했습니다.",
      ok: false,
      rollbackCompleted,
      signature
    };
  }
}

export function screenAfterUserRestore(_screen: Screen): Screen {
  return "dashboard";
}
