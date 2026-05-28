import assert from "node:assert/strict";
import test from "node:test";
import { initialPrototypeState } from "../domain/mock-data";
import { buildAiChatResponse, findAiChatScenario } from "../../features/ai-chat/aiChatScenarios";

test("ai chat scenario answers include fixture citations and navigation actions", () => {
  const response = buildAiChatResponse({
    attachedSourceFileIds: [],
    question: "현재 가장 위험한 운영 신호는?",
    state: initialPrototypeState
  });

  assert.equal(response.scenarioId, "highest-risk-signal");
  assert.match(response.content, /P-42/);
  assert.ok(response.citationEvidenceIds?.includes("evidence-margin"));
  assert.ok(response.citationEvidenceIds?.includes("evidence-claims"));
  assert.ok(response.actionItems?.some((action) => action.target?.screen === "metrics" && action.target.focusId === "metric-margin"));
});

test("ai chat scenario matching handles typed aliases", () => {
  const scenario = findAiChatScenario("공급업체 A 영향 알려줘");

  assert.equal(scenario?.id, "supplier-a-impact");
});

test("ai chat source scenario exposes source file attachment ids without file payloads", () => {
  const response = buildAiChatResponse({
    attachedSourceFileIds: [],
    question: "어떤 근거 파일을 봐야 해?",
    state: initialPrototypeState
  });

  assert.deepEqual(response.attachmentSourceFileIds, ["source-orders", "source-margin"]);
  assert.ok(response.actionItems?.some((action) => action.screen === "vault"));
  assert.equal(JSON.stringify(response).includes("dataUrl"), false);
  assert.equal(JSON.stringify(response).includes("textContent"), false);
});

test("ai chat fallback preserves only selected source file ids as attachment context", () => {
  const response = buildAiChatResponse({
    attachedSourceFileIds: ["source-orders"],
    question: "이 맥락으로 더 설명해줘",
    state: initialPrototypeState
  });

  assert.deepEqual(response.attachmentSourceFileIds, ["source-orders"]);
  assert.match(response.content, /파일 원문을 새로 분석하지 않고/);
});
