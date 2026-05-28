import assert from "node:assert/strict";
import test from "node:test";
import { initialPrototypeState } from "../domain/mock-data";
import { buildAiChatResponse, findAiChatScenario } from "../../features/ai-chat/aiChatScenarios";

test("ai chat scenario answers include fixture citations and navigation actions", () => {
  const response = buildAiChatResponse({
    attachments: [],
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
    attachments: [],
    question: "어떤 근거 파일을 봐야 해?",
    state: initialPrototypeState
  });

  assert.ok(response.actionItems?.some((action) => action.screen === "vault"));
  assert.equal(JSON.stringify(response).includes("dataUrl"), false);
  assert.equal(JSON.stringify(response).includes("textContent"), false);
});

test("ai chat fallback reflects local file attachments without file payloads or sizes", () => {
  const response = buildAiChatResponse({
    attachments: [{ id: "file-1", name: "운영질문.pdf", type: "application/pdf" }],
    question: "이 맥락으로 더 설명해줘",
    state: initialPrototypeState
  });

  assert.match(response.content, /운영질문\.pdf/);
  assert.match(response.content, /파일 원문을 새로 분석하지 않고/);
  assert.equal(JSON.stringify(response).includes("size"), false);
});
