import assert from "node:assert/strict";
import test from "node:test";
import type { PrototypeState } from "./types";
import { initialPrototypeState } from "./mock-data";
import { normalizeStructureMapViewState, reducer } from "./state-machine";
import { updateStructureMapNode, updateStructureMapRelation } from "../prototype/commands/structureMapCommands";
import { getStructureMapView } from "../prototype/queries/structureMapQueries";

test("structure map view state normalizes missing persisted values", () => {
  const normalized = normalizeStructureMapViewState(undefined);

  assert.equal(normalized.searchQuery, "");
  assert.equal(normalized.depth, "all");
  assert.equal(normalized.layoutMode, "semantic-lanes");
  assert.deepEqual(normalized.hiddenNodeIds, []);
});

test("structure map view state migrates legacy flat saved positions", () => {
  const legacyView = {
    ...initialPrototypeState,
    structureMapView: {
      ...initialPrototypeState.structureMapView,
      savedPositions: {
        "entity-supplier-a": { x: 12, y: 34 }
      }
    }
  }.structureMapView as never;
  const normalized = normalizeStructureMapViewState(legacyView);

  assert.deepEqual(normalized.savedPositions["semantic-lanes"]["entity-supplier-a"], { x: 12, y: 34 });
  assert.deepEqual(normalized.savedPositions.clustered, {});
});

test("structure map reducer updates view preferences and backed nodes", () => {
  const withView = reducer(initialPrototypeState, {
    type: "SET_STRUCTURE_MAP_VIEW",
    patch: {
      depth: 2,
      hiddenNodeIds: ["entity-customer-core"],
      savedPositions: {
        clustered: {},
        "risk-first": {},
        "semantic-lanes": {
          "entity-supplier-a": { x: 120, y: 240 }
        }
      },
      searchQuery: "공급"
    }
  });

  assert.equal(withView.structureMapView.searchQuery, "공급");
  assert.equal(withView.structureMapView.depth, 2);
  assert.deepEqual(withView.structureMapView.savedPositions["semantic-lanes"]["entity-supplier-a"], { x: 120, y: 240 });

  const updated = reducer(withView, {
    type: "UPDATE_STRUCTURE_MAP_NODE",
    nodeId: "entity-supplier-a",
    patch: {
      owner: "전략구매팀",
      status: "개선 진행",
      summary: "조건 재협의가 진행 중인 핵심 공급사"
    }
  });

  const supplier = updated.entities.find((entity) => entity.id === "entity-supplier-a");
  assert.equal(supplier?.owner, "전략구매팀");
  assert.equal(supplier?.status, "개선 진행");
  assert.match(supplier?.summary ?? "", /재협의/);
});

test("structure map reducer only creates and deletes relation-backed edges", () => {
  const added = reducer(initialPrototypeState, {
    type: "ADD_STRUCTURE_MAP_RELATION",
    now: "2026-06-21T05:00:00.000Z",
    relation: {
      fromId: "entity-supplier-b",
      toId: "entity-product-precision",
      type: "대체 공급 가능성",
      description: "P-08 공급 대안을 비교하기 위한 수동 관계",
      impact: "대체 조달 검토",
      status: "검토"
    }
  });

  const relation = added.relations.find((item) => item.type === "대체 공급 가능성");
  assert.ok(relation);
  assert.equal(relation.evidenceIds.length, 0);

  const selected = reducer(added, {
    type: "SET_STRUCTURE_MAP_VIEW",
    patch: {
      hiddenEdgeIds: [`edge-${relation.id}`],
      selectedItemId: `edge-${relation.id}`
    }
  });
  const deleted = reducer(selected, {
    type: "DELETE_STRUCTURE_MAP_RELATION",
    relationId: relation.id
  });

  assert.equal(deleted.relations.some((item) => item.id === relation.id), false);
  assert.equal(deleted.structureMapView.hiddenEdgeIds.includes(`edge-${relation.id}`), false);
  assert.equal(deleted.structureMapView.selectedItemId, undefined);
});

test("structure map relation update rejects blank types and invalid endpoints", () => {
  let state: PrototypeState = {
    ...initialPrototypeState,
    session: {
      ...initialPrototypeState.session,
      currentUserId: "user-manager",
      loggedIn: true,
      role: "manager" as const
    }
  };
  const dispatch = (action: Parameters<typeof reducer>[1]) => {
    state = reducer(state, action);
  };
  const originalType = state.relations.find((relation) => relation.id === "relation-supplier-product")?.type;

  assert.equal(updateStructureMapRelation(state, dispatch, "relation-supplier-product", { type: "   " }), false);
  assert.equal(state.relations.find((relation) => relation.id === "relation-supplier-product")?.type, originalType);
  assert.match(state.permissionDenied ?? "", /관계 유형/);

  assert.equal(updateStructureMapRelation(state, dispatch, "relation-supplier-product", { fromId: "missing-node" }), false);
  assert.equal(state.relations.find((relation) => relation.id === "relation-supplier-product")?.fromId, "entity-supplier-a");
  assert.match(state.permissionDenied ?? "", /시작 또는 끝 노드/);

  assert.equal(updateStructureMapRelation(state, dispatch, "relation-supplier-product", { type: "  공급 구조 개선  " }), true);
  assert.equal(state.relations.find((relation) => relation.id === "relation-supplier-product")?.type, "공급 구조 개선");
});

test("structure map node save uses raw editor fields, not rendered captions", () => {
  let state: PrototypeState = {
    ...initialPrototypeState,
    session: {
      ...initialPrototypeState.session,
      currentUserId: "user-manager",
      loggedIn: true,
      role: "manager"
    }
  };
  const dispatch = (action: Parameters<typeof reducer>[1]) => {
    state = reducer(state, action);
  };
  const view = getStructureMapView(state);
  const supplier = view.nodes.find((node) => node.id === "entity-supplier-a");
  const metric = view.nodes.find((node) => node.id === "metric-delay-time");
  const workflow = view.nodes.find((node) => node.id === "event-order");

  assert.ok(supplier);
  assert.equal(updateStructureMapNode(state, dispatch, supplier.id, {
    name: supplier.editorDraft.primary,
    status: supplier.editorDraft.secondary,
    summary: supplier.editorDraft.body
  }), true);
  const savedSupplier = state.entities.find((entity) => entity.id === supplier.id);
  assert.equal(savedSupplier?.kind, "공급사");
  assert.equal(savedSupplier?.status, "점검 필요");

  assert.ok(metric);
  assert.equal(updateStructureMapNode(state, dispatch, metric.id, {
    formula: metric.editorDraft.body,
    name: metric.editorDraft.primary,
    unit: metric.editorDraft.secondary
  }), true);
  const savedMetric = state.metricDefinitions.find((definition) => definition.id === metric.id);
  assert.equal(savedMetric?.unit, "시간");
  assert.equal(savedMetric?.formula, "P-42 주문의 출고 완료 시각 - 주문 접수 시각 평균");

  assert.ok(workflow);
  assert.equal(updateStructureMapNode(state, dispatch, workflow.id, {
    name: workflow.editorDraft.primary,
    occurredAt: "2026-06-21T08:30:00.000Z",
    workflowType: workflow.editorDraft.secondary
  }), true);
  const savedWorkflow = state.events.find((event) => event.id === workflow.id);
  assert.equal(savedWorkflow?.workflowType, workflow.editorDraft.secondary);
  assert.equal(savedWorkflow?.occurredAt, "2026-06-21T08:30:00.000Z");
});

test("structure map hide and unhide are view preferences, not domain deletion", () => {
  const hidden = reducer(initialPrototypeState, {
    type: "HIDE_STRUCTURE_MAP_ITEM",
    itemId: "entity-customer-core",
    kind: "node"
  });

  assert.equal(hidden.structureMapView.hiddenNodeIds.includes("entity-customer-core"), true);
  assert.equal(hidden.entities.some((entity) => entity.id === "entity-customer-core"), true);

  const visible = reducer(hidden, {
    type: "UNHIDE_STRUCTURE_MAP_ITEM",
    itemId: "entity-customer-core",
    kind: "node"
  });

  assert.equal(visible.structureMapView.hiddenNodeIds.includes("entity-customer-core"), false);
  assert.equal(visible.entities.some((entity) => entity.id === "entity-customer-core"), true);
});
