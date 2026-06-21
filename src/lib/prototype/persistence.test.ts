import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPersistedWritePayloads,
  checkPersistedWriteBudget,
  loadCompanyDirectoryState,
  loadUserState,
  persistedStateSignature,
  persistedWritePayloadByteSize,
  saveUserState,
  screenAfterUserRestore,
  serializedStorageEntryByteSize,
  storageKeyForCompanyData,
  storageKeyForUser
} from "./persistence";
import { loginWithCredentials, signup } from "./commands/authCommands";
import { addSourceFiles } from "./commands/fileCommands";
import { createInitialState } from "./store";
import { reducer, type PrototypeAction } from "../domain/state-machine";
import { UNASSIGNED_ORGANIZATION_CATEGORY_ID } from "../domain/types";

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

function loginState() {
  let state = createInitialState();
  const dispatch = (action: PrototypeAction) => {
    state = reducer(state, action);
  };
  loginWithCredentials(state, dispatch, "test", "test");
  return { dispatch, get state() { return state; }, set state(next) { state = next; } };
}

test("not logged-in state skips persisted payloads", () => {
  const state = createInitialState();

  assert.deepEqual(buildPersistedWritePayloads(state), []);
  assert.equal(persistedStateSignature(state), "");
});

test("pending signup persists company directory without a user session payload", () => {
  const storage = new MemoryStorage();
  installStorage(storage);
  let state = createInitialState();
  const dispatch = (action: PrototypeAction) => {
    state = reducer(state, action);
  };

  assert.equal(signup(state, dispatch, { code: "DONI-NEXT-4821", email: "pending.persist@example.com", name: "승인 대기", password: "pending-pass!" }), true);
  const payloads = buildPersistedWritePayloads(state, "2026-05-07T09:00:00.000Z");
  assert.equal(payloads.length, 1);
  assert.equal(payloads.some((payload) => payload.key === storageKeyForUser(state.session.currentUserId)), false);
  assert.equal(payloads.some((payload) => payload.key === storageKeyForCompanyData(state.company.id)), false);

  const saved = saveUserState(state);
  assert.equal(saved.ok, true);

  const bootstrapped = loadCompanyDirectoryState(createInitialState());
  assert.ok(bootstrapped.authAccounts.some((account) => account.email === "pending.persist@example.com"));
  assert.ok(bootstrapped.companyUsers.some((companyUser) => companyUser.email === "pending.persist@example.com" && companyUser.status === "pending"));

  const restoredRef = { state: bootstrapped };
  const restoredDispatch = (action: PrototypeAction) => {
    restoredRef.state = reducer(restoredRef.state, action);
  };
  assert.equal(loginWithCredentials(restoredRef.state, restoredDispatch, "pending.persist@example.com", "pending-pass!"), true);
  assert.equal(restoredRef.state.session.loggedIn, false);
  assert.equal(restoredRef.state.screen, "login");
  assert.match(restoredRef.state.permissionDenied ?? "", /승인/);
});

test("company console payloads include directory, session, and company data", () => {
  const ctx = loginState();
  const payloads = buildPersistedWritePayloads(ctx.state, "2026-05-07T09:00:00.000Z");
  const sessionPayload = payloads.find((payload) => payload.key === storageKeyForUser("user-manager"));
  const companyPayload = payloads.find((payload) => payload.key === storageKeyForCompanyData(ctx.state.company.id));

  assert.equal(payloads.length, 3);
  assert.ok(sessionPayload);
  assert.ok(companyPayload);
  assert.equal(JSON.parse(sessionPayload.value).structureMapView.searchQuery, "");
  assert.equal("structureMapView" in JSON.parse(companyPayload.value).data, false);
  assert.equal(persistedWritePayloadByteSize(payloads) > 0, true);
  assert.equal(serializedStorageEntryByteSize(payloads[0]) > payloads[0].key.length, true);
});

test("structure map view preferences persist with user session data", () => {
  const storage = new MemoryStorage();
  installStorage(storage);
  const ctx = loginState();
  ctx.dispatch({
    type: "SET_STRUCTURE_MAP_VIEW",
    patch: {
      depth: 2,
      hiddenNodeIds: ["entity-customer-core"],
      savedPositions: {
        clustered: {},
        "risk-first": {},
        "semantic-lanes": {
          "entity-supplier-a": { x: 320, y: 180 }
        }
      },
      searchQuery: "공급"
    }
  });

  const saved = saveUserState(ctx.state);
  assert.equal(saved.ok, true);
  const sessionPayload = JSON.parse(storage.getItem(storageKeyForUser("user-manager")) ?? "{}");
  const companyPayload = JSON.parse(storage.getItem(storageKeyForCompanyData(ctx.state.company.id)) ?? "{}");
  assert.equal(sessionPayload.structureMapView.searchQuery, "공급");
  assert.equal("structureMapView" in companyPayload.data, false);

  const loaded = loadUserState("user-manager", createInitialState());
  assert.ok(loaded);
  assert.equal(loaded.structureMapView.searchQuery, "공급");
  assert.equal(loaded.structureMapView.depth, 2);
  assert.deepEqual(loaded.structureMapView.hiddenNodeIds, ["entity-customer-core"]);
  assert.deepEqual(loaded.structureMapView.savedPositions["semantic-lanes"]["entity-supplier-a"], { x: 320, y: 180 });
});

test("legacy company data structure map view is ignored without user session data", () => {
  const storage = new MemoryStorage();
  installStorage(storage);
  const ctx = loginState();

  const saved = saveUserState(ctx.state);
  assert.equal(saved.ok, true);

  const companyKey = storageKeyForCompanyData(ctx.state.company.id);
  const companyPayload = JSON.parse(storage.getItem(companyKey) ?? "{}");
  companyPayload.data.structureMapView = {
    depth: 2,
    hiddenNodeIds: ["entity-customer-core"],
    searchQuery: "legacy-view"
  };
  storage.setItem(companyKey, JSON.stringify(companyPayload));
  storage.removeItem(storageKeyForUser("user-manager"));

  const loaded = loadUserState("user-manager", createInitialState());

  assert.ok(loaded);
  assert.equal(loaded.structureMapView.searchQuery, "");
  assert.equal(loaded.structureMapView.depth, "all");
  assert.deepEqual(loaded.structureMapView.hiddenNodeIds, []);
});

test("save and load user state restores active company user to dashboard", () => {
  const storage = new MemoryStorage();
  installStorage(storage);
  const ctx = loginState();
  addSourceFiles(ctx.state, ctx.dispatch, [{ name: "운영.csv", size: 100, rowCount: 3 }], UNASSIGNED_ORGANIZATION_CATEGORY_ID);

  const saved = saveUserState(ctx.state);
  assert.equal(saved.ok, true);

  const loaded = loadUserState("user-manager", createInitialState());
  assert.ok(loaded);
  assert.equal(loaded.session.loggedIn, true);
  assert.equal(loaded.session.currentUserId, "user-manager");
  assert.equal(loaded.screen, "dashboard");
  assert.equal(loaded.sourceFiles[0].name, "운영.csv");
});

test("save rolls back when storage write fails", () => {
  const storage = new FailingStorage(2);
  storage.seed(storageKeyForUser("user-manager"), "previous");
  installStorage(storage);
  const ctx = loginState();

  const saved = saveUserState(ctx.state);

  assert.equal(saved.ok, false);
  assert.equal(saved.rollbackCompleted, true);
  assert.equal(storage.getItem(storageKeyForUser("user-manager")), "previous");
});

test("write budget reports oversized company data", () => {
  const ctx = loginState();
  const result = checkPersistedWriteBudget(ctx.state, 1);

  assert.equal(result.ok, false);
});

test("restore target never returns public setup pages", () => {
  assert.equal(screenAfterUserRestore("login"), "dashboard");
  assert.equal(screenAfterUserRestore("signup"), "dashboard");
  assert.equal(screenAfterUserRestore("dashboard"), "dashboard");
  assert.equal(screenAfterUserRestore("company"), "dashboard");
});
