import assert from "node:assert/strict";
import test from "node:test";
import { initialPrototypeState } from "../../domain/mock-data";
import { buildStructureMapFlowModel, toStructureMapDomainPosition, toStructureMapFlowPosition } from "./structureMapFlowAdapter";
import { buildStructureMapReagraphModel, structureMapEdgeMeta, structureMapNodeMeta } from "./structureMapReagraphAdapter";
import { buildStructureMapFocusSemantics, getStructureMapPathSummary, getStructureMapPrimaryPath, getStructureMapPrimaryPathIds, getStructureMapRelatedIds } from "./structureMapGraphSemantics";
import { buildStructureMapInspectorContext } from "./structureMapInspectorContext";
import { getStructureMapItemDetail, getStructureMapView } from "./structureMapQueries";

test("structure map builds the full active-company graph with editable and generated edge metadata", () => {
  const view = getStructureMapView(initialPrototypeState);

  assert.equal(view.summary.totalNodes, 22);
  assert.equal(view.summary.visibleNodes, 22);
  assert.equal(view.summary.byNodeType.managed_object, 8);
  assert.equal(view.summary.byNodeType.workflow, 6);
  assert.equal(view.summary.byNodeType.metric, 5);
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
  assert.equal(metric.editorDraft.body, "P-42 주문의 출고대기시간 평균");
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
    searchQuery: "신규 고객군"
  });
  const semantics = buildStructureMapFocusSemantics({
    depth: 1,
    edges: view.edges,
    nodes: view.nodes,
    searchFocus: view.searchFocus
  });
  const graph = buildStructureMapFlowModel(view.nodes, view.edges, semantics);

  assert.equal(view.nodes.length, 22);
  assert.equal(view.nodes.some((node) => node.id === "entity-customer-b"), true);
  assert.deepEqual(view.searchFocus.matchNodeIds, ["entity-customer-b"]);
  assert.equal(view.searchFocus.nodeIds.includes("entity-customer-b"), true);
  assert.equal(view.searchFocus.nodeIds.includes("entity-product-precision"), true);
  assert.equal(view.searchFocus.nodeIds.includes("entity-supplier-b"), false);
  assert.equal(view.searchFocus.edgeIds.length > 0, true);

  const matchedNode = graph.nodes.find((node) => node.id === "entity-customer-b");
  const contextNode = graph.nodes.find((node) => node.id === "entity-product-precision");
  const directSearchEdge = graph.edges.find((edge) => edge.id === "edge-relation-customer-b-precision");

  assert.ok(matchedNode);
  assert.ok(contextNode);
  assert.ok(directSearchEdge);
  assert.equal(matchedNode.data.searchMatch, true);
  assert.equal(matchedNode.data.searchFocused, true);
  assert.equal(matchedNode.data.searchQuery, "신규 고객군");
  assert.equal(matchedNode.data.stroke, "#f59e0b");
  assert.equal(matchedNode.zIndex, 140);
  assert.equal(contextNode.data.searchMatch, false);
  assert.equal(contextNode.data.searchFocused, true);
  assert.equal(directSearchEdge.data.directFocus, true);
  assert.equal(directSearchEdge.data.visualPriority, "direct");
  assert.equal(directSearchEdge.animated, true);
});

test("structure map search focus expands when relationship depth increases", () => {
  const shallow = getStructureMapView(initialPrototypeState, {
    depth: 1,
    searchQuery: "클레임률"
  });
  const expanded = getStructureMapView(initialPrototypeState, {
    depth: 2,
    searchQuery: "클레임률"
  });

  assert.equal(shallow.searchFocus.matchNodeIds.includes("metric-claim-rate"), true);
  assert.equal(shallow.searchFocus.nodeIds.includes("entity-customer-b"), false);
  assert.equal(expanded.searchFocus.nodeIds.includes("entity-customer-b"), true);
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

  assert.equal(view.nodes.length, 22);
  assert.equal(view.edges.length, 57);
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

test("structure map semantics expands selected nodes and edges without renderer dependencies", () => {
  const view = getStructureMapView(initialPrototypeState, {
    selectedItemId: "insight-product-margin"
  });
  const relatedIds = getStructureMapRelatedIds(view.nodes, view.edges, "insight-product-margin", 2);

  assert.equal(relatedIds.has("insight-product-margin"), true);
  assert.equal(relatedIds.has("metric-margin"), true);
  assert.equal(relatedIds.has("metric-claim-rate"), true);
  assert.equal(relatedIds.has("event-outbound"), true);

  const relationRelatedIds = getStructureMapRelatedIds(view.nodes, view.edges, "edge-relation-supplier-product", 1);
  assert.equal(relationRelatedIds.has("edge-relation-supplier-product"), true);
  assert.equal(relationRelatedIds.has("entity-supplier-a"), true);
  assert.equal(relationRelatedIds.has("entity-low-margin"), true);
});

test("structure map semantics identifies the default P-42 entity to decision path", () => {
  const view = getStructureMapView(initialPrototypeState, { depth: "all" });
  const primaryPath = getStructureMapPrimaryPath(view.nodes, view.edges);
  const primaryPathIds = getStructureMapPrimaryPathIds(view.nodes, view.edges);
  const summary = getStructureMapPathSummary(view.nodes, view.edges, primaryPath.allIds);

  assert.equal(primaryPath.targetInsightId, "insight-product-margin");
  assert.match(primaryPath.reason, /P-42/);
  assert.equal(primaryPath.nodeIds.has("entity-supplier-a"), true);
  assert.equal(primaryPath.edgeIds.has("edge-metric-insight-metric-margin-insight-product-margin"), true);
  assert.deepEqual([...primaryPath.allIds].sort(), [...primaryPathIds].sort());
  assert.equal(primaryPathIds.has("entity-supplier-a"), true);
  assert.equal(primaryPathIds.has("entity-low-margin"), true);
  assert.equal(primaryPathIds.has("event-outbound"), true);
  assert.equal(primaryPathIds.has("metric-margin"), true);
  assert.equal(primaryPathIds.has("insight-product-margin"), true);
  assert.equal(summary.countsByType.managed_object > 0, true);
  assert.equal(summary.countsByType.workflow > 0, true);
  assert.equal(summary.countsByType.metric > 0, true);
  assert.equal(summary.countsByType.insight > 0, true);
  assert.equal(summary.evidenceIds.includes("evidence-margin"), true);
  assert.equal(summary.metricIds.includes("metric-margin"), true);
});

test("structure map flow adapter projects semantics without owning graph traversal", () => {
  const overview = getStructureMapView(initialPrototypeState, {
    depth: "all"
  });
  const overviewSemantics = buildStructureMapFocusSemantics({
    depth: "all",
    edges: overview.edges,
    nodes: overview.nodes,
    searchFocus: overview.searchFocus
  });
  const overviewGraph = buildStructureMapFlowModel(overview.nodes, overview.edges, overviewSemantics);

  assert.equal(overviewSemantics.dimmedIds.size, 0);
  assert.equal(overviewGraph.nodes.some((node) => node.data.dimmed), false);
  assert.equal(overviewGraph.edges.some((edge) => edge.data.dimmed), false);
  assert.equal(overviewGraph.edges.some((edge) => edge.animated), false);
  assert.equal(
    overviewGraph.nodes.every((node) => (node.zIndex ?? 0) > Math.max(...overviewGraph.edges.map((edge) => edge.zIndex ?? 0))),
    true
  );

  const view = getStructureMapView(initialPrototypeState, {
    depth: "all",
    selectedItemId: "insight-product-margin"
  });
  const semantics = buildStructureMapFocusSemantics({
    depth: "all",
    edges: view.edges,
    nodes: view.nodes,
    searchFocus: view.searchFocus,
    selectedItemId: "insight-product-margin"
  });
  const graph = buildStructureMapFlowModel(view.nodes, view.edges, semantics);
  const nodeIds = new Set(graph.nodes.map((node) => node.id));

  assert.equal(graph.nodes.length, view.nodes.length);
  assert.equal(graph.edges.length, view.edges.length);

  for (const edge of graph.edges) {
    assert.equal(nodeIds.has(edge.source), true, `${edge.id} source ${edge.source} should be rendered`);
    assert.equal(nodeIds.has(edge.target), true, `${edge.id} target ${edge.target} should be rendered`);
  }

  const primaryInsight = graph.nodes.find((node) => node.id === "insight-product-margin");
  assert.ok(primaryInsight);
  assert.equal(primaryInsight.data.primaryPath, true);
  assert.equal(primaryInsight.data.labelVisible, true);

  const primaryEdge = graph.edges.find((edge) => edge.id === "edge-metric-insight-metric-margin-insight-product-margin");
  assert.ok(primaryEdge);
  assert.equal(primaryEdge.data.primaryPath, true);
  assert.equal(primaryEdge.data.directFocus, true);
  assert.equal(primaryEdge.data.visualPriority, "direct");
  assert.equal(primaryEdge.animated, true);

  const nodeSelectedView = getStructureMapView(initialPrototypeState, {
    depth: "all",
    selectedItemId: "entity-supplier-a"
  });
  const nodeSelectedSemantics = buildStructureMapFocusSemantics({
    depth: "all",
    edges: nodeSelectedView.edges,
    nodes: nodeSelectedView.nodes,
    searchFocus: nodeSelectedView.searchFocus,
    selectedItemId: "entity-supplier-a"
  });
  const nodeSelectedGraph = buildStructureMapFlowModel(nodeSelectedView.nodes, nodeSelectedView.edges, nodeSelectedSemantics);
  const selectedNode = nodeSelectedGraph.nodes.find((node) => node.id === "entity-supplier-a");
  const directNodeEdge = nodeSelectedGraph.edges.find((edge) => edge.id === "edge-relation-supplier-product");

  assert.ok(selectedNode);
  assert.ok(directNodeEdge);
  assert.equal(selectedNode.data.selected, true);
  assert.equal(selectedNode.selected, true);
  assert.equal(selectedNode.zIndex, 150);
  assert.equal(directNodeEdge.data.directFocus, true);
  assert.equal(directNodeEdge.data.visualPriority, "direct");
  assert.equal(directNodeEdge.style?.stroke, "#2563eb");
  assert.equal(directNodeEdge.zIndex, 40);

  const edgeSelectedView = getStructureMapView(initialPrototypeState, {
    depth: "all",
    selectedItemId: "edge-relation-supplier-product"
  });
  const edgeSelectedSemantics = buildStructureMapFocusSemantics({
    depth: "all",
    edges: edgeSelectedView.edges,
    nodes: edgeSelectedView.nodes,
    searchFocus: edgeSelectedView.searchFocus,
    selectedItemId: "edge-relation-supplier-product"
  });
  const edgeSelectedGraph = buildStructureMapFlowModel(edgeSelectedView.nodes, edgeSelectedView.edges, edgeSelectedSemantics);
  const selectedEdge = edgeSelectedGraph.edges.find((edge) => edge.id === "edge-relation-supplier-product");

  assert.ok(selectedEdge);
  assert.equal(selectedEdge.data.selected, true);
  assert.equal(selectedEdge.selected, true);
  assert.equal(selectedEdge.data.visualPriority, "selected");
  assert.equal(selectedEdge.style?.stroke, "#db2777");
  assert.equal(selectedEdge.zIndex, 50);

  const syntheticNodeId = "entity-customer-b";
  const syntheticEdgeId = "edge-relation-customer-b-precision";
  const customGraph = buildStructureMapFlowModel(view.nodes, view.edges, {
    activeIds: new Set([syntheticNodeId, syntheticEdgeId]),
    dimmedIds: new Set(),
    primaryEdgeIds: new Set([syntheticEdgeId]),
    primaryNodeIds: new Set([syntheticNodeId]),
    primaryPathIds: new Set([syntheticNodeId, syntheticEdgeId]),
    primaryPathReason: "테스트에서 주입한 경로",
    relatedIds: new Set(),
    searchFocusEdgeIds: new Set(),
    searchFocusNodeIds: new Set(),
    searchMatchNodeIds: new Set()
  });
  const syntheticNode = customGraph.nodes.find((node) => node.id === syntheticNodeId);
  const syntheticEdge = customGraph.edges.find((edge) => edge.id === syntheticEdgeId);
  const defaultPrimaryEdge = customGraph.edges.find((edge) => edge.id === "edge-metric-insight-metric-margin-insight-product-margin");

  assert.ok(syntheticNode);
  assert.ok(syntheticEdge);
  assert.equal(syntheticNode.data.primaryPath, true);
  assert.equal(syntheticEdge.data.primaryPath, true);
  assert.equal(syntheticEdge.data.visualPriority, "primary");
  assert.equal(defaultPrimaryEdge?.data.primaryPath, false);
});

test("structure map inspector context explains selected path with evidence metrics and decisions", () => {
  const view = getStructureMapView(initialPrototypeState, {
    depth: 2,
    selectedItemId: "entity-supplier-a"
  });
  const semantics = buildStructureMapFocusSemantics({
    depth: 2,
    edges: view.edges,
    nodes: view.nodes,
    searchFocus: view.searchFocus,
    selectedItemId: "entity-supplier-a"
  });
  const detail = getStructureMapItemDetail(view, "entity-supplier-a");
  const evidenceLabelById = new Map(initialPrototypeState.evidence.map((evidence) => [evidence.id, evidence.label]));
  const metricLabelById = new Map(initialPrototypeState.metricDefinitions.map((metric) => [metric.id, metric.name]));
  const context = buildStructureMapInspectorContext({
    depth: 2,
    detail,
    edges: view.edges,
    evidenceLabelById,
    metricLabelById,
    nodes: view.nodes,
    primaryPathIds: semantics.primaryPathIds
  });

  assert.ok(detail);
  assert.equal(context.primaryPath, true);
  assert.equal(context.directEdgeCount > 0, true);
  assert.equal(context.outgoingCount > 0, true);
  assert.equal(context.pathSummary.evidenceIds.includes("evidence-supplier"), true);
  assert.equal(context.pathSummary.metricIds.includes("metric-margin"), true);
  assert.equal(context.evidenceLabels.includes("공급업체 A사 공급 관계 근거"), true);
  assert.equal(context.metricLabels.includes("평균 마진율"), true);
  assert.equal(context.connectedDecisionLabels.includes("P-42 마진 하락과 클레임 비용 증가"), true);
  assert.equal(context.sourceLabels.includes("수동 Relation"), true);
});

test("structure map flow adapter centralizes persisted-position scaling", () => {
  const domainPosition = { x: 240, y: 180 };
  const flowPosition = toStructureMapFlowPosition(domainPosition);
  const restoredPosition = toStructureMapDomainPosition(flowPosition);

  assert.deepEqual(flowPosition, { x: 456, y: 256 });
  assert.deepEqual(restoredPosition, domainPosition);
});

test("structure map reagraph adapter preserves graph ids and adds icon-first metadata", () => {
  const view = getStructureMapView(initialPrototypeState, {
    depth: 1,
    searchQuery: "신규 고객군",
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

test("structure map reagraph adapter keeps every visible edge attached to rendered nodes", () => {
  const view = getStructureMapView(initialPrototypeState, { depth: "all" });
  const graph = buildStructureMapReagraphModel(view.nodes, view.edges, {
    depth: "all",
    searchFocus: view.searchFocus
  });
  const nodeIds = new Set(graph.nodes.map((node) => node.id));

  for (const edge of graph.edges) {
    assert.equal(nodeIds.has(edge.source), true, `${edge.id} source ${edge.source} should be rendered`);
    assert.equal(nodeIds.has(edge.target), true, `${edge.id} target ${edge.target} should be rendered`);
  }
});
