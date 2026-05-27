import assert from "node:assert/strict";
import test from "node:test";
import { reducer, type PrototypeAction } from "../../domain/state-machine";
import { createInitialState } from "../store";
import { loginWithCredentials } from "./authCommands";
import { addSourceFiles, updateSourceFile } from "./fileCommands";

function loggedInState(): ReturnType<typeof createInitialState> {
  let state = createInitialState();
  const dispatch = (action: PrototypeAction) => {
    state = reducer(state, action);
  };
  loginWithCredentials(state, dispatch, "test", "test");
  return state;
}

function statefulDispatch(initialState = loggedInState()) {
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

test("addSourceFiles classifies image and document files without fake row counts", () => {
  const harness = statefulDispatch();

  const added = addSourceFiles(harness.state, harness.dispatch, [
    { name: "photo.png", size: 128, mimeType: "image/png", dataUrl: "data:image/png;base64,AA==" },
    { name: "manual.pdf", size: 256, mimeType: "application/pdf", dataUrl: "data:application/pdf;base64,AA==" },
    { name: "legacy.xls", size: 512, mimeType: "application/vnd.ms-excel", dataUrl: "data:application/vnd.ms-excel;base64,AA==" }
  ]);

  assert.equal(added, true);
  assert.deepEqual(
    harness.state.sourceFiles.map((file) => ({ kind: file.kind, name: file.name, rowCount: file.rowCount })),
    [
      { kind: "업무 파일", name: "photo.png", rowCount: 0 },
      { kind: "업무 문서", name: "manual.pdf", rowCount: 0 },
      { kind: "표 형식 데이터", name: "legacy.xls", rowCount: 0 }
    ]
  );
});

test("addSourceFiles rejects batches over the projected persisted write budget", () => {
  const harness = statefulDispatch();
  (globalThis as { PERSISTED_WRITE_BUDGET_BYTES?: number }).PERSISTED_WRITE_BUDGET_BYTES = 1;

  try {
    const added = addSourceFiles(harness.state, harness.dispatch, [
      { name: "photo.png", size: 128, mimeType: "image/png", dataUrl: "data:image/png;base64,AA==" }
    ]);

    assert.equal(added, false);
    assert.equal(harness.state.sourceFiles.length, 0);
    assert.match(harness.state.permissionDenied ?? "", /저장 가능한 데이터 보관함 용량을 초과/);
  } finally {
    delete (globalThis as { PERSISTED_WRITE_BUDGET_BYTES?: number }).PERSISTED_WRITE_BUDGET_BYTES;
  }
});

test("addSourceFiles keeps same-basename files when extensions differ", () => {
  const harness = statefulDispatch();

  assert.equal(
    addSourceFiles(harness.state, harness.dispatch, [
      { name: "vault-sample.png", size: 128, mimeType: "image/png", dataUrl: "data:image/png;base64,AA==" }
    ]),
    true
  );
  assert.equal(
    addSourceFiles(harness.state, harness.dispatch, [
      { name: "vault-sample.pdf", size: 256, mimeType: "application/pdf", dataUrl: "data:application/pdf;base64,AA==" }
    ]),
    true
  );

  assert.deepEqual(
    harness.state.sourceFiles.map((file) => file.name),
    ["vault-sample.pdf", "vault-sample.png"]
  );
  assert.notEqual(harness.state.sourceFiles[0].id, harness.state.sourceFiles[1].id);
});

test("addSourceFiles replaces legacy same-name IDs without removing sibling extensions", () => {
  const harness = statefulDispatch({
    ...loggedInState(),
    sourceFiles: [
      {
        id: "source-vault-sample-1",
        name: "vault-sample.png",
        kind: "업무 파일",
        rowCount: 0,
        status: "ready",
        size: 128,
        mimeType: "image/png"
      }
    ]
  });

  assert.equal(
    addSourceFiles(harness.state, harness.dispatch, [
      { name: "vault-sample.png", size: 256, mimeType: "image/png", dataUrl: "data:image/png;base64,AA==" }
    ]),
    true
  );
  assert.equal(
    addSourceFiles(harness.state, harness.dispatch, [
      { name: "vault-sample.pdf", size: 512, mimeType: "application/pdf", dataUrl: "data:application/pdf;base64,AA==" }
    ]),
    true
  );

  assert.deepEqual(
    harness.state.sourceFiles.map((file) => ({ id: file.id, name: file.name, size: file.size })),
    [
      { id: "source-vault-sample-pdf-1", name: "vault-sample.pdf", size: 512 },
      { id: "source-vault-sample-png-1", name: "vault-sample.png", size: 256 }
    ]
  );
});

test("updateSourceFile allows same-extension rename and blocks extension changes", () => {
  const harness = statefulDispatch();
  assert.equal(addSourceFiles(harness.state, harness.dispatch, [{ name: "sample.png", size: 128, mimeType: "image/png" }]), true);
  const fileId = harness.state.sourceFiles[0].id;

  assert.equal(updateSourceFile(harness.state, harness.dispatch, fileId, { kind: "업무 문서", name: "hero.png" }), true);
  assert.equal(harness.state.sourceFiles[0].name, "hero.png");
  assert.equal(harness.state.sourceFiles[0].kind, "업무 문서");

  assert.equal(updateSourceFile(harness.state, harness.dispatch, fileId, { kind: "업무 문서", name: "hero.pdf" }), false);
  assert.equal(harness.state.sourceFiles[0].name, "hero.png");
  assert.equal(harness.state.permissionDenied, "파일 확장자는 변경할 수 없습니다.");
});
