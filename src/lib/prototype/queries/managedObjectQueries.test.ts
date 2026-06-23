import assert from "node:assert/strict";
import test from "node:test";
import { initialPrototypeState } from "../../domain/mock-data";
import { getManagedObjectGraphItemDetail, getManagedObjectView } from "./managedObjectQueries";

test("KnowledgeGraph preserves managed-object detail selection after renderer extraction", () => {
  const view = getManagedObjectView(initialPrototypeState, "entity-customer-core", {
    visibleEntityIds: ["entity-low-margin"]
  });
  const detail = view.detail;

  assert.equal(detail.rootNodeId, "entity-customer-core");
  assert.equal(detail.graphNodes.some((node) => node.id === "entity-customer-core"), true);
  assert.equal(detail.graphEdges.some((edge) => edge.id === "edge-relation-customer-claim"), true);

  const rootNode = getManagedObjectGraphItemDetail(detail, "entity-customer-core");
  assert.ok(rootNode);
  assert.equal(rootNode.kind, "node");
  assert.equal(rootNode.title, "핵심 고객군");
  assert.match(rootNode.body ?? "", /클레임률/);

  const relationEdge = getManagedObjectGraphItemDetail(detail, "edge-relation-customer-claim");
  assert.ok(relationEdge);
  assert.equal(relationEdge.kind, "edge");
  assert.match(relationEdge.title, /클레임 접수/);
  assert.match(relationEdge.title, /핵심 고객군/);
  assert.equal(relationEdge.metricIds.includes("metric-claim-rate"), true);
});
