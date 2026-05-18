import assert from "node:assert/strict";
import test from "node:test";
import {
  buildManagedObjectGraphLayout,
  classifyEdgePriority,
  type ManagedObjectGraphLayout
} from "./managedObjectGraphLayout";
import { managedObjectGraphLegend, type ManagedObjectGraphEdge, type ManagedObjectGraphNode } from "./managedObjectQueries";

const graphNodes: ManagedObjectGraphNode[] = [
  { id: "entity-customer-core", label: "고객A", caption: "고객군", type: "managed_object", tone: "primary" },
  { id: "entity-supplier-a", label: "공급업체 A사", caption: "공급사", type: "managed_object", tone: "neutral" },
  { id: "entity-low-margin", label: "P-42 산업용 센서 패키지", caption: "상품군", type: "managed_object", tone: "neutral" },
  { id: "event-order", label: "주문 접수", caption: "접수", type: "workflow", tone: "info" },
  { id: "event-delivery", label: "배송 상태 확인", caption: "지연", type: "workflow", tone: "warning" },
  { id: "metric-delay-time", label: "주문 처리 시간", caption: "36.8시간", type: "metric", tone: "warning" },
  { id: "insight-delay-risk", label: "공급 지연 리스크", caption: "고위험 인사이트", type: "insight", tone: "danger" }
];

const graphEdges: ManagedObjectGraphEdge[] = [
  {
    id: "edge-relation-supplier-product",
    fromId: "entity-supplier-a",
    toId: "entity-low-margin",
    label: "공급/납품 구조",
    edgeType: "managed_object_structural",
    kind: "managed_object_structural"
  },
  {
    id: "edge-customer-order",
    fromId: "entity-customer-core",
    toId: "event-order",
    label: "업무 대상",
    edgeType: "managed_object_workflow",
    kind: "managed_object_workflow"
  },
  {
    id: "edge-customer-order-source",
    fromId: "entity-customer-core",
    toId: "event-order",
    label: "업무 연결",
    edgeType: "managed_object_workflow",
    kind: "managed_object_workflow"
  },
  {
    id: "edge-sequence-order-delivery",
    fromId: "event-order",
    toId: "event-delivery",
    label: "다음 흐름",
    edgeType: "workflow_sequence",
    kind: "workflow_sequence"
  },
  {
    id: "edge-delivery-delay",
    fromId: "event-delivery",
    toId: "metric-delay-time",
    label: "측정",
    edgeType: "workflow_metric",
    kind: "workflow_metric"
  },
  {
    id: "edge-delay-insight",
    fromId: "metric-delay-time",
    toId: "insight-delay-risk",
    label: "인사이트 근거",
    edgeType: "metric_insight",
    kind: "metric_insight"
  }
];

function layout(): ManagedObjectGraphLayout {
  return buildManagedObjectGraphLayout({
    graphEdges,
    graphLegend: managedObjectGraphLegend,
    graphNodes,
    rootNodeId: "entity-customer-core"
  });
}

test("managed object graph layout represents all nodes and edges", () => {
  const result = layout();

  assert.deepEqual(Object.keys(result.positionsByNodeId).sort(), graphNodes.map((node) => node.id).sort());
  assert.deepEqual(Object.keys(result.edgePriorityByEdgeId).sort(), graphEdges.map((edge) => edge.id).sort());
  assert.deepEqual(Object.keys(result.edgeRouteByEdgeId).sort(), graphEdges.map((edge) => edge.id).sort());
});

test("managed object graph layout keeps semantic lane ordering compact", () => {
  const result = layout();

  assert.equal(result.laneByNodeId["entity-customer-core"].kind, "managed_object");
  assert.equal(result.laneByNodeId["event-order"].kind, "workflow");
  assert.equal(result.laneByNodeId["metric-delay-time"].kind, "metric");
  assert.equal(result.laneByNodeId["insight-delay-risk"].kind, "insight");
  assert.equal(result.positionsByNodeId["entity-customer-core"].x < result.positionsByNodeId["entity-supplier-a"].x, true);
  assert.equal(
    result.laneByNodeId["entity-customer-core"].order < result.laneByNodeId["event-order"].order &&
      result.laneByNodeId["event-order"].order < result.laneByNodeId["metric-delay-time"].order &&
      result.laneByNodeId["metric-delay-time"].order < result.laneByNodeId["insight-delay-risk"].order,
    true
  );
  assert.equal(result.positionsByNodeId["event-order"].x, result.positionsByNodeId["event-delivery"].x);
});

test("managed object graph layout classifies endpoint-aware influence priority", () => {
  const result = layout();
  const influenceEdge = graphEdges.find((edge) => edge.id === "edge-relation-supplier-product");
  const downstreamEdge = graphEdges.find((edge) => edge.id === "edge-delivery-delay");

  assert.equal(classifyEdgePriority(influenceEdge!, graphNodes[1], graphNodes[2]), "primaryInfluence");
  assert.equal(classifyEdgePriority(downstreamEdge!, graphNodes[4], graphNodes[5]), "downstream");
  assert.equal(result.edgePriorityByEdgeId["edge-relation-supplier-product"].rank > result.edgePriorityByEdgeId["edge-delivery-delay"].rank, true);
});

test("managed object graph layout exposes a readable desktop first-paint budget", () => {
  const result = layout();
  const viewport = result.defaultViewport;
  const graphPanelBudgetWidth = 980;
  const objectX = result.positionsByNodeId["entity-customer-core"].x * viewport.zoom + viewport.x;
  const workflowX = result.positionsByNodeId["event-order"].x * viewport.zoom + viewport.x;

  assert.equal(viewport.zoom >= 0.7, true);
  assert.equal(objectX >= 0, true);
  assert.equal(workflowX > objectX, true);
  assert.equal(workflowX < graphPanelBudgetWidth, true);
});

test("managed object graph layout separates repeated endpoint routes", () => {
  const result = layout();
  const primaryRoute = result.edgeRouteByEdgeId["edge-customer-order"];
  const repeatedRoute = result.edgeRouteByEdgeId["edge-customer-order-source"];
  const singleRoute = result.edgeRouteByEdgeId["edge-delivery-delay"];

  assert.notEqual(primaryRoute.stepPosition, repeatedRoute.stepPosition);
  assert.notEqual(primaryRoute.parallelOffset, repeatedRoute.parallelOffset);
  assert.equal(primaryRoute.offset, repeatedRoute.offset);
  assert.equal(singleRoute.stepPosition, 0.5);
  assert.equal(singleRoute.parallelOffset, 0);
  assert.equal(singleRoute.offset, 20);
});
