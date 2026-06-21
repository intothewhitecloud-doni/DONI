import assert from "node:assert/strict";
import test from "node:test";
import { initialPrototypeState } from "../../domain/mock-data";
import { buildStructureMapReagraphModel, structureMapEdgeMeta, structureMapNodeMeta } from "./structureMapReagraphAdapter";
import { getStructureMapItemDetail, getStructureMapView } from "./structureMapQueries";

test("structure map builds the full active-company graph with editable and generated edge metadata", () => {
  const view = getStructureMapView(initialPrototypeState);

  assert.equal(view.summary.totalNodes, 20);
  assert.equal(view.summary.visibleNodes, 20);
  assert.equal(view.summary.byNodeType.managed_object, 8);
  assert.equal(view.summary.byNodeType.workflow, 6);
  assert.equal(view.summary.byNodeType.metric, 3);
  assert.equal(view.summary.byNodeType.insight, 3);
  assert.equal(view.summary.relationEdges, 6);
  assert.equal(view.summary.generatedEdges > view.summary.relationEdges, true);

  const relationEdge = view.edges.find((edge) => edge.id === "edge-relation-supplier-product");
  assert.ok(relationEdge);
  assert.equal(relationEdge.readOnly, false);
  assert.equal(relationEdge.source, "relation");
  assert.equal(relationEdge.relationId, "relation-supplier-product");

  const generatedEdge = view.edges.find((edge) => edge.edgeType === "workflow_metric");
  assert.ok(generatedEdge);
  assert.equal(generatedEdge.readOnly, true);
  assert.match(generatedEdge.readOnlyReason ?? "", /읽기 전용/);
});

test("structure map keeps display fields separate from editor domain fields", () => {
  const view = getStructureMapView(initialPrototypeState);
  const supplier = view.nodes.find((node) => node.id === "entity-supplier-a");
  const metric = view.nodes.find((node) => node.id === "metric-delay-time");

  assert.ok(supplier);
  assert.equal(supplier.caption, "공급사");
  assert.equal(supplier.editorDraft.secondary, "점검 필요");

  assert.ok(metric);
  assert.equal(metric.caption, "36.8시간");
  assert.match(metric.body ?? "", /^계산식:/);
  assert.equal(metric.editorDraft.secondary, "시간");
  assert.equal(metric.editorDraft.body, "P-42 주문의 출고 완료 시각 - 주문 접수 시각 평균");
});

test("structure map keeps nodes visible when the company has no edges", () => {
  const view = getStructureMapView({
    ...initialPrototypeState,
    events: [],
    insights: [],
    metricDefinitions: [],
    metricValues: [],
    relations: [],
    workflowMetricBindings: []
  });

  assert.equal(view.summary.totalEdges, 0);
  assert.equal(view.summary.visibleEdges, 0);
  assert.equal(view.nodes.length, initialPrototypeState.entities.length);
  assert.equal(view.summary.visibleNodes, initialPrototypeState.entities.length);
  assert.equal(view.nodes.some((node) => node.id === "entity-supplier-a"), true);
});

test("structure map search highlights matched nodes by selected depth without filtering the graph", () => {
  const view = getStructureMapView(initialPrototypeState, {
    depth: 1,
    searchQuery: "고객B"
  });

  assert.equal(view.nodes.length, 20);
  assert.equal(view.nodes.some((node) => node.id === "entity-customer-b"), true);
  assert.deepEqual(view.searchFocus.matchNodeIds, ["entity-customer-b"]);
  assert.equal(view.searchFocus.nodeIds.includes("entity-customer-b"), true);
  assert.equal(view.searchFocus.nodeIds.includes("entity-product-precision"), true);
  assert.equal(view.searchFocus.nodeIds.includes("entity-supplier-b"), false);
  assert.equal(view.searchFocus.edgeIds.length > 0, true);
});

test("structure map search focus expands when relationship depth increases", () => {
  const shallow = getStructureMapView(initialPrototypeState, {
    depth: 1,
    searchQuery: "P-08"
  });
  const expanded = getStructureMapView(initialPrototypeState, {
    depth: 2,
    searchQuery: "P-08"
  });

  assert.equal(shallow.searchFocus.nodeIds.includes("entity-customer-core"), false);
  assert.equal(expanded.searchFocus.nodeIds.includes("entity-customer-core"), true);
  assert.equal(expanded.searchFocus.nodeIds.length > shallow.searchFocus.nodeIds.length, true);
});

test("structure map relationship depth changes the visible graph when there is no search focus", () => {
  const oneHop = getStructureMapView(initialPrototypeState, { depth: 1 });
  const twoHop = getStructureMapView(initialPrototypeState, { depth: 2 });
  const threeHop = getStructureMapView(initialPrototypeState, { depth: 3 });
  const all = getStructureMapView(initialPrototypeState, { depth: "all" });

  assert.equal(oneHop.nodes.some((node) => node.type === "metric"), false);
  assert.equal(oneHop.nodes.some((node) => node.type === "insight"), false);
  assert.equal(twoHop.nodes.some((node) => node.type === "metric"), true);
  assert.equal(twoHop.nodes.some((node) => node.type === "insight"), false);
  assert.equal(threeHop.nodes.some((node) => node.type === "insight"), true);
  assert.equal(oneHop.summary.visibleNodes < twoHop.summary.visibleNodes, true);
  assert.equal(twoHop.summary.visibleNodes < threeHop.summary.visibleNodes, true);
  assert.equal(threeHop.summary.visibleNodes < all.summary.visibleNodes, true);
});

test("structure map search with no matches keeps the graph visible with an empty focus", () => {
  const view = getStructureMapView(initialPrototypeState, {
    searchQuery: "zzzzzz"
  });

  assert.equal(view.nodes.length, 20);
  assert.equal(view.edges.length, 39);
  assert.equal(view.searchFocus.matchNodeIds.length, 0);
  assert.equal(view.searchFocus.nodeIds.length, 0);
  assert.equal(view.searchFocus.edgeIds.length, 0);
});

test("structure map applies node, edge, hidden item, and saved position filters", () => {
  const view = getStructureMapView(initialPrototypeState, {
    edgeTypes: ["managed_object_structural"],
    hiddenEdgeIds: ["edge-relation-customer-b-precision"],
    hiddenNodeIds: ["entity-supplier-b"],
    nodeTypes: ["managed_object"],
    savedPositions: {
      clustered: {},
      "risk-first": {},
      "semantic-lanes": {
        "entity-supplier-a": { x: 999, y: 111 }
      }
    }
  });

  assert.equal(view.nodes.every((node) => node.type === "managed_object"), true);
  assert.equal(view.edges.every((edge) => edge.edgeType === "managed_object_structural"), true);
  assert.equal(view.edges.some((edge) => edge.id === "edge-relation-customer-b-precision"), false);
  assert.equal(view.nodes.some((node) => node.id === "entity-supplier-b"), false);
  assert.deepEqual(view.nodes.find((node) => node.id === "entity-supplier-a")?.position, { x: 999, y: 111 });
});

test("structure map saved positions are scoped by layout mode", () => {
  const semantic = getStructureMapView(initialPrototypeState, {
    layoutMode: "semantic-lanes",
    savedPositions: {
      clustered: {
        "entity-supplier-a": { x: 444, y: 555 }
      },
      "risk-first": {},
      "semantic-lanes": {
        "entity-supplier-a": { x: 999, y: 111 }
      }
    }
  });
  const clustered = getStructureMapView(initialPrototypeState, {
    layoutMode: "clustered",
    savedPositions: {
      clustered: {
        "entity-supplier-a": { x: 444, y: 555 }
      },
      "risk-first": {},
      "semantic-lanes": {
        "entity-supplier-a": { x: 999, y: 111 }
      }
    }
  });

  assert.deepEqual(semantic.nodes.find((node) => node.id === "entity-supplier-a")?.position, { x: 999, y: 111 });
  assert.deepEqual(clustered.nodes.find((node) => node.id === "entity-supplier-a")?.position, { x: 444, y: 555 });
});

test("structure map selected detail distinguishes editable relation edges from generated edges", () => {
  const editable = getStructureMapView(initialPrototypeState, {
    selectedItemId: "edge-relation-supplier-product"
  }).selectedDetail;
  assert.ok(editable);
  assert.equal(editable.editable, true);
  assert.equal(editable.kind, "edge");

  const readOnlyView = getStructureMapView(initialPrototypeState, {
    selectedItemId: "edge-binding-order-delay"
  });
  const readOnly = getStructureMapItemDetail(readOnlyView, "edge-binding-order-delay");
  assert.ok(readOnly);
  assert.equal(readOnly.editable, false);
  assert.match(readOnly.readOnlyReason ?? "", /읽기 전용/);
});

test("structure map reagraph adapter preserves graph ids and adds icon-first metadata", () => {
  const view = getStructureMapView(initialPrototypeState, {
    depth: 1,
    searchQuery: "고객B",
    selectedItemId: "entity-customer-b"
  });
  const graph = buildStructureMapReagraphModel(view.nodes, view.edges, {
    depth: 1,
    searchFocus: view.searchFocus,
    selectedItemId: "entity-customer-b"
  });

  assert.equal(graph.nodes.length, view.nodes.length);
  assert.equal(graph.edges.length, view.edges.length);
  assert.equal(graph.selectedIds.includes("entity-customer-b"), true);

  const selected = graph.nodes.find((node) => node.id === "entity-customer-b");
  assert.ok(selected);
  assert.equal(selected.data?.selected, true);
  assert.equal(selected.data?.iconLabel, structureMapNodeMeta.managed_object.icon);
  assert.match(selected.icon ?? "", /^data:image\/svg\+xml/);
  assert.equal(selected.labelVisible, false);

  const generatedEdge = graph.edges.find((edge) => edge.data?.readOnly);
  assert.ok(generatedEdge);
  assert.equal(generatedEdge.dashed, true);
  const generatedEdgeType = generatedEdge.data.original.edgeType;
  assert.equal([structureMapEdgeMeta[generatedEdgeType].color, "#14b8a6"].includes(String(generatedEdge.fill)), true);
});
