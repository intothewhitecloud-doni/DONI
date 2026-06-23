import assert from "node:assert/strict";
import test from "node:test";
import { sampleSourceFiles } from "../../domain/sample-analysis";
import { reducer, type PrototypeAction } from "../../domain/state-machine";
import { createInitialState } from "../store";
import { loginWithCredentials } from "./authCommands";
import { addSourceFiles, applySourceFileToCurrentStandard, removeSourceFile, updateSourceFile } from "./fileCommands";

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

  assert.equal(updateSourceFile(harness.state, harness.dispatch, fileId, { description: "화면 캡처", kind: "업무 문서", name: "hero.png" }), true);
  assert.equal(harness.state.sourceFiles[0].name, "hero.png");
  assert.equal(harness.state.sourceFiles[0].kind, "업무 문서");
  assert.equal(harness.state.sourceFiles[0].description, "화면 캡처");

  assert.equal(updateSourceFile(harness.state, harness.dispatch, fileId, { kind: "업무 문서", name: "hero.pdf" }), false);
  assert.equal(harness.state.sourceFiles[0].name, "hero.png");
  assert.equal(harness.state.permissionDenied, "파일 확장자는 변경할 수 없습니다.");
});

test("applySourceFileToCurrentStandard creates linked operational records for uploaded file", () => {
  const harness = statefulDispatch();

  assert.equal(
    addSourceFiles(
      harness.state,
      harness.dispatch,
      [
        {
          description: "고객 마스터 원천",
          name: "CRM_Master.csv",
          previewColumns: ["고객ID", "고객명", "업종", "담당부서"],
          previewRows: [["C-1", "고객A", "IT 서비스", "영업 1팀"]],
          rowCount: 1,
          size: 128
        }
      ],
      "org-operations"
    ),
    true
  );

  const fileId = harness.state.sourceFiles[0].id;
  assert.equal(applySourceFileToCurrentStandard(harness.state, harness.dispatch, fileId), true);

  assert.equal(harness.state.sourceFiles[0].status, "parsed");
  assert.ok(harness.state.entities.some((entity) => entity.id === `entity-${fileId}` && entity.owner === "운영"));
  assert.ok(harness.state.relations.some((relation) => relation.id === `relation-${fileId}-current-standard`));
  assert.ok(harness.state.events.some((event) => event.id === `event-${fileId}-apply`));
  assert.deepEqual(
    harness.state.workflowTypes
      .filter((type) => ["원천 기록", "정보 보정", "현재 기준 반영"].includes(type.label))
      .map((type) => ({ label: type.label, color: type.color })),
    [
      { label: "원천 기록", color: "slate" },
      { label: "정보 보정", color: "orange" },
      { label: "현재 기준 반영", color: "emerald" }
    ]
  );
  assert.ok(harness.state.metricDefinitions.some((metric) => metric.id === `metric-${fileId}-readiness`));
  assert.ok(harness.state.insights.some((insight) => insight.id === `insight-${fileId}-lineage`));
  assert.equal(harness.state.structureMapView.selectedItemId, `entity-${fileId}`);
});

test("applySourceFileToCurrentStandard maps canonical sample files to decision metrics", () => {
  const harness = statefulDispatch();
  const marginSource = sampleSourceFiles.find((file) => file.id === "source-margin");
  assert.ok(marginSource);

  assert.equal(
    addSourceFiles(
      harness.state,
      harness.dispatch,
      [
        {
          name: marginSource.name,
          previewColumns: marginSource.previewColumns,
          previewRows: marginSource.previewRows,
          rowCount: marginSource.rowCount,
          size: 256
        }
      ],
      "org-operations"
    ),
    true
  );

  const uploadedFile = harness.state.sourceFiles.find((file) => file.name === marginSource.name);
  assert.ok(uploadedFile);
  assert.equal(applySourceFileToCurrentStandard(harness.state, harness.dispatch, uploadedFile.id), true);

  assert.deepEqual(
    harness.state.sourceFiles.map((file) => file.id).sort(),
    ["source-margin", "source-orders"]
  );
  assert.deepEqual(
    harness.state.metricDefinitions.map((metric) => metric.name),
    ["평균 마진율", "납품준수율", "P-42 지연률", "평균 출고 대기시간", "클레임률"]
  );
  assert.equal(harness.state.metricDefinitions.some((metric) => metric.name.includes("보정 완료율")), false);
  assert.equal(harness.state.metricValues.some((value) => value.metricId === "metric-delivery-compliance"), true);
  assert.equal(harness.state.workflowMetricBindings.some((binding) => binding.metricId === "metric-delay-rate"), true);
  assert.equal(harness.state.insights.some((insight) => insight.id === "insight-product-margin"), true);
  assert.equal(harness.state.structureMapView.selectedItemId, "entity-low-margin");
});

test("applySourceFileToCurrentStandard requires sample columns before using canonical metrics", () => {
  const harness = statefulDispatch();

  assert.equal(
    addSourceFiles(harness.state, harness.dispatch, [{ name: "상품별_마진_공급사.csv", rowCount: 1, size: 128 }], "org-operations"),
    true
  );

  const uploadedFile = harness.state.sourceFiles.find((file) => file.name === "상품별_마진_공급사.csv");
  assert.ok(uploadedFile);
  assert.equal(applySourceFileToCurrentStandard(harness.state, harness.dispatch, uploadedFile.id), true);

  assert.equal(harness.state.sourceFiles.some((file) => file.id === "source-orders"), false);
  assert.deepEqual(harness.state.metricDefinitions.map((metric) => metric.name), ["상품별_마진_공급사 보정 완료율"]);
  assert.equal(harness.state.metricValues.some((value) => value.metricId === "metric-delivery-compliance"), false);
});

test("applySourceFileToCurrentStandard requires the margin compliance column for canonical metrics", () => {
  const harness = statefulDispatch();
  const marginSource = sampleSourceFiles.find((file) => file.id === "source-margin");
  assert.ok(marginSource);
  const previewColumns = marginSource.previewColumns?.filter((column) => column !== "납품준수율");

  assert.equal(
    addSourceFiles(
      harness.state,
      harness.dispatch,
      [
        {
          name: marginSource.name,
          previewColumns,
          rowCount: marginSource.rowCount,
          size: 128
        }
      ],
      "org-operations"
    ),
    true
  );

  const uploadedFile = harness.state.sourceFiles.find((file) => file.name === marginSource.name);
  assert.ok(uploadedFile);
  assert.equal(applySourceFileToCurrentStandard(harness.state, harness.dispatch, uploadedFile.id), true);

  assert.equal(harness.state.sourceFiles.some((file) => file.id === "source-orders"), false);
  assert.deepEqual(harness.state.metricDefinitions.map((metric) => metric.name), ["상품별_마진_공급사 보정 완료율"]);
  assert.equal(harness.state.metricDefinitions.some((metric) => metric.id === "metric-delivery-compliance"), false);
});

test("removeSourceFile clears canonical sample metrics when one sample file is removed", () => {
  const harness = statefulDispatch();
  const marginSource = sampleSourceFiles.find((file) => file.id === "source-margin");
  assert.ok(marginSource);

  assert.equal(
    addSourceFiles(
      harness.state,
      harness.dispatch,
      [
        {
          name: marginSource.name,
          previewColumns: marginSource.previewColumns,
          previewRows: marginSource.previewRows,
          rowCount: marginSource.rowCount,
          size: 256
        }
      ],
      "org-operations"
    ),
    true
  );
  const uploadedFile = harness.state.sourceFiles.find((file) => file.name === marginSource.name);
  assert.ok(uploadedFile);
  assert.equal(applySourceFileToCurrentStandard(harness.state, harness.dispatch, uploadedFile.id), true);
  assert.equal(harness.state.metricDefinitions.some((metric) => metric.id === "metric-delay-rate"), true);

  assert.equal(removeSourceFile(harness.state, harness.dispatch, "source-orders"), true);

  assert.deepEqual(harness.state.sourceFiles.map((file) => file.id), ["source-margin"]);
  assert.equal(harness.state.sourceFiles[0].status, "ready");
  assert.equal(harness.state.sourceFiles[0].appliedAt, undefined);
  assert.equal(harness.state.metricDefinitions.some((metric) => metric.id === "metric-delay-rate"), false);
  assert.equal(harness.state.insights.some((insight) => insight.id === "insight-product-margin"), false);
  assert.equal(harness.state.entities.some((entity) => entity.id === "entity-low-margin"), false);
});

test("updateSourceFile clears generated operational records until the file is applied again", () => {
  const harness = statefulDispatch();

  assert.equal(addSourceFiles(harness.state, harness.dispatch, [{ name: "CRM_Master.csv", previewColumns: ["고객ID"], rowCount: 1, size: 128 }], "org-operations"), true);
  const fileId = harness.state.sourceFiles[0].id;
  assert.equal(applySourceFileToCurrentStandard(harness.state, harness.dispatch, fileId), true);
  assert.ok(harness.state.entities.some((entity) => entity.id === `entity-${fileId}`));

  assert.equal(updateSourceFile(harness.state, harness.dispatch, fileId, { description: "수정된 고객 원천", kind: "표 형식 데이터", name: "CRM_Customers.csv" }), true);

  assert.equal(harness.state.sourceFiles[0].status, "ready");
  assert.equal(harness.state.sourceFiles[0].appliedAt, undefined);
  assert.equal(harness.state.entities.some((entity) => entity.id === `entity-${fileId}`), false);
  assert.equal(harness.state.relations.some((relation) => relation.id === `relation-${fileId}-current-standard`), false);
});
