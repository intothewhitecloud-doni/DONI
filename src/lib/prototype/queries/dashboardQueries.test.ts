import assert from "node:assert/strict";
import test from "node:test";
import { initialPrototypeState } from "../../domain/mock-data";
import { getDashboardView } from "./dashboardQueries";

test("dashboard phase-one summary stays aligned with shared projection signals", () => {
  const view = getDashboardView(initialPrototypeState);
  const summaryByLabel = new Map(view.summaryCards.map((card) => [card.label, card.value]));
  const signalById = new Map(view.phaseOne.primarySignals.map((signal) => [signal.id, signal.value]));

  assert.equal(summaryByLabel.get("P-42 지연률"), signalById.get("p42-delay-rate"));
  assert.equal(summaryByLabel.get("P-42 클레임률"), signalById.get("p42-claim-rate"));
  assert.equal(summaryByLabel.get("평균 마진율"), signalById.get("p42-margin"));
  assert.equal(summaryByLabel.get("A사 납품준수"), signalById.get("supplier-a-compliance"));
});
