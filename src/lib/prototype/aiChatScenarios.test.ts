import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { initialPrototypeState } from "../domain/mock-data";
import {
  findAiCanvasPromptScenario,
  getAiCanvasFallbackGuide,
  getAiCanvasScenario,
  getAiCanvasOverview,
  getFixedAiCanvasScenarios
} from "../../features/ai-chat/aiCanvasScenarios";
import { aiChatScenarios, buildAiChatResponse, findAiChatScenario } from "../../features/ai-chat/aiChatScenarios";
import { createInitialState } from "./store";

test("supplier A impact is the first recommended ai chat question", () => {
  assert.equal(aiChatScenarios[0]?.id, "supplier-a-impact");
  assert.equal(aiChatScenarios[0]?.prompt, "공급업체 A사가 어떤 영향을 줘?");
});

test("ai canvas exposes exactly four fixed badge scenarios", () => {
  const scenarios = getFixedAiCanvasScenarios(initialPrototypeState);

  assert.deepEqual(scenarios.map((scenario) => scenario.id), [
    "supplier-a-impact",
    "highest-risk-signal",
    "p42-margin-cause",
    "customer-a-claims"
  ]);
  assert.deepEqual(scenarios.map((scenario) => scenario.shortLabel), [
    "공급업체 A사",
    "위험 신호",
    "P-42 마진",
    "고객A 클레임"
  ]);
});

test("ai canvas scenarios include dense visual evidence without raw file payloads", () => {
  const scenarios = getFixedAiCanvasScenarios(initialPrototypeState);

  for (const scenario of scenarios) {
    assert.ok(scenario.summary.length >= 3, scenario.id);
    assert.ok(scenario.metricSummaries.length >= 2, scenario.id);
    assert.ok(scenario.visualBlocks.length >= 4, scenario.id);
    assert.ok(scenario.evidence.length >= 2, scenario.id);
    assert.ok(scenario.detailTable.rows.length >= 3, scenario.id);
    assert.equal(scenario.recommendations.length, 3, scenario.id);
    assert.ok(scenario.confidence >= 0.8 && scenario.confidence <= 1, scenario.id);
  }

  const serialized = JSON.stringify(scenarios);
  assert.equal(serialized.includes("dataUrl"), false);
  assert.equal(serialized.includes("textContent"), false);
});

test("ai canvas falls back to canonical sample data when operating data is not loaded", () => {
  const scenarios = getFixedAiCanvasScenarios(createInitialState());
  const supplierScenario = scenarios[0];

  assert.equal(supplierScenario?.shortLabel, "공급업체 A사");
  assert.equal(supplierScenario?.sampleDataLabel, "기본 샘플");
  assert.equal(supplierScenario?.metricSummaries[0]?.label, "주문 처리 시간");
  assert.equal(supplierScenario?.metricSummaries[0]?.value, "36.8시간");
  assert.ok(supplierScenario?.visualBlocks.some((block) => block.id === "visual-canvas-supplier-margin"));
  assert.match(supplierScenario?.detailTable.rows[1]?.cells[1] ?? "", /36\.8시간/);
});

test("ai canvas initial overview is not driven by a selected badge scenario", () => {
  const overview = getAiCanvasOverview(initialPrototypeState);

  assert.equal(overview.title, "현재 데이터 기준 전반 분석 제안");
  assert.equal(overview.detailTable.rows.length, 4);
  assert.ok(overview.summary.some((line) => line.includes("4개 질문")));
  assert.ok(overview.visualBlocks.some((block) => block.id === "visual-canvas-risk-margin"));
  assert.ok(overview.keyFindings.some((finding) => finding.includes("P-42")));
});

test("ai canvas prompt matcher is limited to the four fixed canvas scenarios", () => {
  assert.equal(findAiCanvasPromptScenario("공급업체 A사가 어떤 영향을 줘?", initialPrototypeState)?.id, "supplier-a-impact");
  assert.equal(findAiCanvasPromptScenario("공급업체 A 영향 알려줘", initialPrototypeState)?.id, "supplier-a-impact");
  assert.equal(findAiCanvasPromptScenario("현재 가장 위험한 운영 신호는?", initialPrototypeState)?.id, "highest-risk-signal");
  assert.equal(findAiCanvasPromptScenario("P42 마진 낮아진 이유", initialPrototypeState)?.id, "p42-margin-cause");
  assert.equal(findAiCanvasPromptScenario("고객A 클레임 분석", initialPrototypeState)?.id, "customer-a-claims");

  assert.equal(findAiCanvasPromptScenario("어떤 근거 파일을 봐야 해?", initialPrototypeState), undefined);
  assert.equal(findAiCanvasPromptScenario("다음 액션 알려줘", initialPrototypeState), undefined);
  assert.equal(findAiCanvasPromptScenario("이 맥락으로 더 설명해줘", initialPrototypeState), undefined);
  assert.equal(findAiCanvasPromptScenario("A사 영향 말고 전체 매출 전망을 알려줘", initialPrototypeState), undefined);
});

test("ai canvas direct scenario lookup rejects unsupported ids", () => {
  assert.equal(getAiCanvasScenario(initialPrototypeState, "supplier-a-impact")?.id, "supplier-a-impact");
  assert.equal(getAiCanvasScenario(initialPrototypeState, "source-files"), undefined);
  assert.equal(getAiCanvasScenario(initialPrototypeState, "next-actions"), undefined);
});

test("ai canvas fallback guide points users back to the four supported prompts", () => {
  const guide = getAiCanvasFallbackGuide(initialPrototypeState);

  assert.match(guide.content, /4개 질문/);
  assert.equal(guide.prompts.length, 4);
  assert.deepEqual(guide.prompts.map((prompt) => prompt.id), [
    "supplier-a-impact",
    "highest-risk-signal",
    "p42-margin-cause",
    "customer-a-claims"
  ]);
});

test("ai canvas recommendation cards do not trigger prototype navigation", () => {
  const source = readFileSync("src/features/ai-chat/AiCanvasScreen.tsx", "utf8");

  assert.equal(source.includes("commands.navigate"), false);
  assert.equal(source.includes("navigateToTarget"), false);
  assert.equal(source.includes("onClick={() => onAction"), false);
});

test("ai canvas screen keeps the shared breadcrumb and page title header", () => {
  const source = readFileSync("src/features/ai-chat/AiCanvasScreen.tsx", "utf8");

  assert.match(source, /AI_CANVAS_BREADCRUMB = "AI 대화 > 분석 캔버스"/);
  assert.match(source, /AI_CANVAS_PAGE_TITLE = "샘플 데이터 기반 AI 분석"/);
  assert.match(source, /function AiCanvasPageHeader/);
  assert.match(source, /<header className="space-y-3">/);
  assert.match(source, /eyebrow=\{AI_CANVAS_BREADCRUMB\}/);
  assert.match(source, /title=\{AI_CANVAS_PAGE_TITLE\}/);
});

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
  assert.ok(response.visualBlocks?.some((block) => block.type === "comparison" && block.id === "visual-highest-risk-priority"));
});

test("ai chat scenario matching handles typed aliases", () => {
  const scenario = findAiChatScenario("공급업체 A 영향 알려줘");

  assert.equal(scenario?.id, "supplier-a-impact");
});

test("supplier A impact answer follows the requested operator-facing copy", () => {
  const response = buildAiChatResponse({
    attachments: [],
    question: "공급업체 A사가 어떤 영향을 줘?",
    state: initialPrototypeState
  });

  assert.equal(response.scenarioId, "supplier-a-impact");
  assert.match(response.content, /핵심 공급 리스크/);
  assert.match(response.content, /납품 준수율은 70~72%/);
  assert.match(response.content, /추천 다음 액션/);
  assert.match(response.content, /4\. 개선이 없을 경우 공급 조건 재협의 또는 대체 공급사 병행 검토/);
  assert.ok(response.visualBlocks?.some((block) => block.type === "metric_chart" && block.id === "visual-supplier-a-compliance" && block.chartType === "pie"));
  assert.ok(response.visualBlocks?.some((block) => block.type === "metric_chart" && block.id === "visual-supplier-a-delay-time" && block.chartType === "bar"));
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

test("ai chat fixture scenarios expose visual explanation payloads", () => {
  const supplierResponse = buildAiChatResponse({
    attachments: [],
    question: "공급업체 A사가 어떤 영향을 줘?",
    state: initialPrototypeState
  });
  const marginResponse = buildAiChatResponse({
    attachments: [],
    question: "P-42 마진이 왜 낮아졌어?",
    state: initialPrototypeState
  });
  const claimsResponse = buildAiChatResponse({
    attachments: [],
    question: "고객A 클레임 원인은?",
    state: initialPrototypeState
  });

  assert.ok(supplierResponse.visualBlocks?.some((block) => block.type === "metric_chart" && block.chartType === "pie"));
  assert.ok(supplierResponse.visualBlocks?.some((block) => block.type === "metric_chart" && block.chartType === "bar" && block.points.some((point) => point.label === "현재" && point.value === 36.8)));
  assert.ok(marginResponse.visualBlocks?.some((block) => block.type === "metric_chart" && block.chartType === "bar"));
  assert.ok(marginResponse.visualBlocks?.some((block) => block.type === "comparison" && block.rows.some((row) => row.label === "반품비용")));
  assert.ok(claimsResponse.visualBlocks?.some((block) => block.type === "metric_chart" && block.chartType === "time_series"));
  assert.ok(claimsResponse.visualBlocks?.some((block) => block.type === "comparison" && block.rows.some((row) => row.label === "주문 처리 시간")));
});
