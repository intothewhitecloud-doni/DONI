import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { initialPrototypeState } from "../../domain/mock-data";
import { getPhaseOneAnalysisProjection } from "./phaseOneAnalysisProjection";

test("phase one projection exposes shared E/E/R/M/D groups and P-42 signals", () => {
  const projection = getPhaseOneAnalysisProjection(initialPrototypeState);
  const groupKinds = projection.structureGroups.map((group) => group.kind);

  assert.deepEqual(groupKinds, ["entity", "event", "relation", "metric", "decision"]);
  assert.equal(projection.summary.find((item) => item.label === "Decision 후보")?.value, "3개");
  assert.equal(projection.primarySignals.find((signal) => signal.id === "p42-revenue")?.value, "2.6억");
  assert.equal(projection.primarySignals.find((signal) => signal.id === "supplier-a-compliance")?.value, "71%");
  assert.equal(projection.primarySignals.find((signal) => signal.id === "p42-delay-rate")?.value, "80%");
  assert.equal(projection.primarySignals.find((signal) => signal.id === "p42-claim-rate")?.value, "100%");
});

test("phase one projection connects source files to generated structure and decisions", () => {
  const projection = getPhaseOneAnalysisProjection(initialPrototypeState);
  const marginFile = projection.files.find((file) => file.sourceFileId === "source-margin");
  const ordersFile = projection.files.find((file) => file.sourceFileId === "source-orders");

  assert.ok(marginFile);
  assert.ok(ordersFile);
  assert.equal(marginFile.structureGroups.some((group) => group.kind === "entity" && group.items.some((item) => item.title.includes("P-42"))), true);
  assert.equal(marginFile.structureGroups.some((group) => group.kind === "relation" && group.items.some((item) => item.title.includes("공급업체 A사"))), true);
  assert.equal(marginFile.decisionCandidateIds.includes("insight-product-margin"), true);
  assert.equal(ordersFile.structureGroups.some((group) => group.kind === "event" && group.items.some((item) => item.title === "클레임 접수")), true);
  assert.equal(ordersFile.decisionCandidateIds.includes("insight-customer-claims"), true);
});

test("phase one decision candidates use manager-facing copy", () => {
  const projection = getPhaseOneAnalysisProjection(initialPrototypeState);
  const customerDecision = projection.decisionCandidates.find((candidate) => candidate.id === "insight-customer-claims");

  assert.ok(customerDecision);
  assert.match(customerDecision.title, /핵심 고객군/);
  assert.doesNotMatch(customerDecision.title, /고객A/);
  assert.equal(customerDecision.preDecisionChecks.some((check) => check.includes("승인 권한")), true);
  assert.match(customerDecision.evidenceStrengthLabel, /근거 신뢰도/);
});

test("data vault phase one mock apply stays local-only", () => {
  const source = readFileSync("src/features/data-review/DataVaultRevisionWorkbench.tsx", "utf8");

  assert.equal(source.includes("applySourceFileToCurrentStandard"), false);
  assert.equal(source.includes("APPLY_SOURCE_FILE_TO_CURRENT_STANDARD"), false);
});
