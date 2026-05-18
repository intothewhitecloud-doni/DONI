import assert from "node:assert/strict";
import test from "node:test";
import { sampleCandidates } from "../domain/sample-analysis";
import { buildCandidateSelectionDefaults, emptyCandidateSelection, rowsForReviewStep } from "./candidateReviewSelection";

test("candidate review defaults select every managed object only on initial setup", () => {
  const initial = buildCandidateSelectionDefaults(sampleCandidates);

  assert.deepEqual(initial.managed_object, ["candidate-customer", "candidate-supplier", "candidate-product-group"]);
  assert.equal(initial.workflow_event.length > 0, true);
  assert.equal(initial.relation.length > 0, true);
  assert.equal(initial.metric.length > 0, true);
});

test("candidate review keeps an explicit empty managed object selection", () => {
  const explicitEmpty = buildCandidateSelectionDefaults(sampleCandidates, emptyCandidateSelection);

  assert.deepEqual(explicitEmpty.managed_object, []);
  assert.deepEqual(explicitEmpty.workflow_event, []);
  assert.deepEqual(explicitEmpty.relation, []);
  assert.deepEqual(explicitEmpty.metric, []);
  assert.deepEqual(rowsForReviewStep(sampleCandidates, "workflow_event", explicitEmpty.managed_object), []);
});

test("candidate review derives downstream candidates from the selected managed object", () => {
  const selectedSupplier = buildCandidateSelectionDefaults(sampleCandidates, {
    ...emptyCandidateSelection,
    managed_object: ["candidate-supplier"]
  });

  assert.deepEqual(selectedSupplier.managed_object, ["candidate-supplier"]);
  assert.deepEqual(selectedSupplier.workflow_event, ["candidate-flow"]);
  assert.deepEqual(selectedSupplier.relation, ["candidate-relation"]);
  assert.deepEqual(selectedSupplier.metric, ["candidate-metric-margin", "candidate-metric-delay"]);
});
