import type {
  AIInsight,
  CandidateType,
  DomainTypeDefinition,
  EntityInstance,
  EventRecord,
  ExtractionCandidate,
  EvidenceReference,
  MetricChartType,
  MetricDefinition,
  MetricValue,
  Relation,
  SourceFile,
  WorkflowMetricBinding
} from "./types";

export type ResultScenarioId = "customer" | "supplier" | "product" | "fallback";

export type SampleResultScenario = {
  id: ResultScenarioId;
  managedCandidateId: string;
  insightId: string;
  title: string;
  severity: AIInsight["severity"];
  detected: string;
  reason: string;
  likelyCauses: string[];
  recommendedActions: string[];
  supportSummary: string[];
  relatedMetricIds: string[];
  relatedObjectIds: string[];
  relatedEventIds: string[];
  relatedRelationIds: string[];
  evidenceIds: string[];
  proposal: {
    id: string;
    title: string;
    summary: string;
    expectedImpact: string;
    comment: string;
  };
  dashboard: {
    chartType: MetricChartType;
    chartTitle: string;
    chartDescription: string;
  };
};

const now = "2026-05-07T09:00:00.000Z";
export const canonicalSampleAnalysisSourceId = "public-sample-2026-05-11";

export const sampleManagedObjectTypes: DomainTypeDefinition[] = [
  { id: "managed-type-customer", scope: "managed_object", label: "고객군", color: "blue" },
  { id: "managed-type-supplier", scope: "managed_object", label: "공급사", color: "emerald" },
  { id: "managed-type-product", scope: "managed_object", label: "상품군", color: "violet" }
];

export const sampleWorkflowTypes: DomainTypeDefinition[] = [
  { id: "workflow-type-received", scope: "workflow", label: "접수", color: "blue" },
  { id: "workflow-type-delayed", scope: "workflow", label: "지연", color: "orange" },
  { id: "workflow-type-increase", scope: "workflow", label: "증가", color: "pink" },
  { id: "workflow-type-review", scope: "workflow", label: "검토", color: "violet" }
];

export const sampleSourceFiles: SourceFile[] = [
  {
    id: "source-orders",
    name: "주문_배송_클레임.xlsx",
    kind: "표 형식 데이터",
    rowCount: 12,
    status: "ready",
    previewColumns: ["주문ID", "상품군", "고객군", "공급사", "배송상태", "출고대기시간", "클레임유형"],
    previewRows: [
      ["O-1001", "P-42", "고객A", "공급업체 A사", "지연", "42시간", "배송 지연"],
      ["O-1002", "P-42", "고객A", "공급업체 A사", "지연", "38시간", "배송 지연"],
      ["O-1003", "P-08", "고객B", "공급업체 A사", "정상", "24시간", "-"],
      ["O-1004", "P-17", "고객C", "공급업체 B사", "검토", "18시간", "보상 요청"]
    ]
  },
  {
    id: "source-margin",
    name: "상품별_마진_공급사.csv",
    kind: "표 형식 데이터",
    rowCount: 8,
    status: "ready",
    previewColumns: ["상품군", "상품명", "공급사", "매출", "원가", "할인율", "반품비용", "평균마진율", "납품준수율"],
    previewRows: [
      ["P-42", "산업용 센서 패키지", "공급업체 A사", "128000000", "99200000", "6.4%", "4200000", "13.8%", "72%"],
      ["P-17", "표준 제어 모듈", "공급업체 B사", "95000000", "70100000", "2.1%", "1300000", "21.2%", "91%"],
      ["P-08", "정밀 부품 세트", "공급업체 A사", "74000000", "55800000", "4.7%", "2100000", "15.1%", "78%"],
      ["P-42", "산업용 센서 패키지", "공급업체 A사", "132000000", "104500000", "6.8%", "4600000", "13.4%", "70%"]
    ]
  }
];

export const sampleEvidence: EvidenceReference[] = [
  {
    id: "evidence-orders-delay",
    sourceFileId: "source-orders",
    sourceKind: "canonical_sample",
    analysisSourceId: canonicalSampleAnalysisSourceId,
    sourceName: "주문_배송_클레임.xlsx",
    sheetName: "주문_배송_클레임",
    rowNumbers: [2, 3, 5, 7, 9],
    columns: ["상품군", "공급사", "배송상태", "출고대기시간"],
    confidence: 0.91,
    label: "P-42 배송 지연 근거",
    location: "주문_배송_클레임.xlsx / 주문_배송_클레임 시트 2,3,5,7,9행",
    excerpt: "P-42와 공급업체 A사가 연결된 주문에서 지연 상태가 반복되고 평균 출고 대기 시간이 36.8시간으로 상승했습니다."
  },
  {
    id: "evidence-claims",
    sourceFileId: "source-orders",
    sourceKind: "canonical_sample",
    analysisSourceId: canonicalSampleAnalysisSourceId,
    sourceName: "주문_배송_클레임.xlsx",
    sheetName: "클레임",
    rowNumbers: [4, 6, 8, 10],
    columns: ["고객군", "상품군", "클레임유형", "보상요청"],
    confidence: 0.88,
    label: "고객A 클레임 근거",
    location: "주문_배송_클레임.xlsx / 클레임 시트 4,6,8,10행",
    excerpt: "고객A의 P-42 주문에서 배송 지연 이후 클레임과 보상 요청이 함께 발생했습니다."
  },
  {
    id: "evidence-margin",
    sourceFileId: "source-margin",
    sourceKind: "canonical_sample",
    analysisSourceId: canonicalSampleAnalysisSourceId,
    sourceName: "상품별_마진_공급사.csv",
    rowNumbers: [2, 6],
    columns: ["상품군", "상품명", "매출", "원가", "할인율", "반품비용", "평균마진율"],
    confidence: 0.94,
    label: "P-42 마진 하락 근거",
    location: "상품별_마진_공급사.csv / 2,6행",
    excerpt: "P-42 산업용 센서 패키지는 평균마진율 13.8%와 13.4%로 표본 내 최저권이며 할인율과 반품비용도 높습니다."
  },
  {
    id: "evidence-supplier",
    sourceFileId: "source-margin",
    sourceKind: "canonical_sample",
    analysisSourceId: canonicalSampleAnalysisSourceId,
    sourceName: "상품별_마진_공급사.csv",
    rowNumbers: [2, 4, 6, 8],
    columns: ["상품군", "공급사", "평균마진율", "납품준수율"],
    confidence: 0.9,
    label: "공급업체 A사 공급 관계 근거",
    location: "상품별_마진_공급사.csv / 공급업체 A사 행",
    excerpt: "공급업체 A사는 P-42와 P-08을 공급하며 P-42의 납품준수율은 70~72%로 다른 공급사보다 낮습니다."
  },
  {
    id: "evidence-customer-b-p08",
    sourceFileId: "source-orders",
    sourceKind: "canonical_sample",
    analysisSourceId: canonicalSampleAnalysisSourceId,
    sourceName: "주문_배송_클레임.xlsx",
    sheetName: "주문_배송_클레임",
    rowNumbers: [4],
    columns: ["고객군", "상품군", "공급사", "배송상태", "출고대기시간", "클레임유형"],
    confidence: 0.86,
    label: "고객B P-08 주문 근거",
    location: "주문_배송_클레임.xlsx / 주문_배송_클레임 시트 4행",
    excerpt: "고객B는 P-08 정밀 부품 세트를 공급업체 A사로부터 정상 배송 상태로 구매했으며 클레임은 기록되지 않았습니다."
  }
];

export const sampleCandidates: ExtractionCandidate[] = [
  {
    id: "candidate-customer",
    type: "managed_object",
    title: "고객군",
    description: "선택하면 고객A, 고객B, 고객C처럼 배송 지연과 클레임 영향을 받는 고객 인스턴스가 함께 운영 구조에 반영됩니다.",
    confidence: 0.92,
    status: "needs_review",
    evidenceIds: ["evidence-claims", "evidence-orders-delay"]
  },
  {
    id: "candidate-supplier",
    type: "managed_object",
    title: "공급사",
    description: "선택하면 공급업체 A사, 공급업체 B사처럼 납품준수율과 출고 대기 시간이 관찰되는 공급사 인스턴스가 함께 반영됩니다.",
    confidence: 0.95,
    status: "needs_review",
    evidenceIds: ["evidence-supplier", "evidence-orders-delay"]
  },
  {
    id: "candidate-product-group",
    type: "managed_object",
    title: "상품군",
    description: "선택하면 P-42 산업용 센서 패키지와 기타 상품군 인스턴스가 마진, 납품, 클레임 지표와 함께 반영됩니다.",
    confidence: 0.93,
    status: "needs_review",
    evidenceIds: ["evidence-margin", "evidence-supplier", "evidence-claims"]
  },
  {
    id: "candidate-flow",
    type: "workflow_event",
    title: "주문 접수-출고 처리",
    description: "주문 접수, 출고 처리, 배송 상태 확인으로 이어지는 주문 처리 흐름입니다.",
    confidence: 0.9,
    status: "needs_review",
    evidenceIds: ["evidence-orders-delay"]
  },
  {
    id: "candidate-claim-flow",
    type: "workflow_event",
    title: "클레임 접수-보상 처리",
    description: "클레임 접수 이후 보상 처리로 이어지는 고객 지원 흐름입니다.",
    confidence: 0.84,
    status: "needs_review",
    evidenceIds: ["evidence-claims", "evidence-orders-delay"]
  },
  {
    id: "candidate-relation",
    type: "relation",
    title: "공급업체 A사 → P-42 공급 연결",
    description: "공급업체 A사가 P-42 상품군을 공급하는 구조 관계이며 납품준수율과 마진 지표의 해석 기준입니다.",
    confidence: 0.9,
    status: "needs_review",
    evidenceIds: ["evidence-supplier", "evidence-margin", "evidence-orders-delay"],
    edgePreview: {
      fromLabel: "공급업체 A사",
      toLabel: "P-42 산업용 센서 패키지",
      relationType: "공급/납품 구조",
      metricLabels: ["주문 처리 시간", "평균 마진율"]
    }
  },
  {
    id: "candidate-relation-customer-claim",
    type: "relation",
    title: "클레임 접수 → 고객A 연결",
    description: "클레임 접수 업무흐름이 고객A의 클레임률과 보상 요청 증가로 연결됩니다.",
    confidence: 0.86,
    status: "needs_review",
    evidenceIds: ["evidence-claims", "evidence-orders-delay"],
    edgePreview: {
      fromLabel: "클레임 접수",
      toLabel: "고객A",
      relationType: "클레임 접수 대상",
      metricLabels: ["클레임률", "주문 처리 시간"]
    }
  },
  {
    id: "candidate-relation-customer-b-p08",
    type: "relation",
    title: "고객B → P-08 구매 연결",
    description: "고객B의 P-08 정상 주문을 비교 관계로 연결해 고객군 그래프가 실제 구매 대상과 업무흐름으로 이어지도록 합니다.",
    confidence: 0.8,
    status: "needs_review",
    evidenceIds: ["evidence-customer-b-p08", "evidence-orders-delay"],
    edgePreview: {
      fromLabel: "고객B",
      toLabel: "P-08 정밀 부품 세트",
      relationType: "구매/비교 연결",
      metricLabels: ["클레임률", "주문 처리 시간"]
    }
  },
  {
    id: "candidate-metric-margin",
    type: "metric",
    title: "P-42 평균마진율",
    description: "P-42의 매출, 원가, 할인율, 반품비용으로 계산한 평균 마진율입니다.",
    confidence: 0.94,
    status: "needs_review",
    evidenceIds: ["evidence-margin"]
  },
  {
    id: "candidate-metric-delay",
    type: "metric",
    title: "P-42 주문 처리 시간",
    description: "P-42 주문 접수부터 출고 완료까지 걸린 평균 대기 시간입니다.",
    confidence: 0.91,
    status: "needs_review",
    evidenceIds: ["evidence-orders-delay"]
  },
  {
    id: "candidate-metric-claim",
    type: "metric",
    title: "P-42 클레임률",
    description: "P-42 주문 중 클레임으로 접수된 비율과 고객A의 반복 발생률입니다.",
    confidence: 0.88,
    status: "needs_review",
    evidenceIds: ["evidence-claims"]
  }
];

export const sampleEntities: EntityInstance[] = [
  {
    id: "entity-customer-core",
    kind: "고객군",
    name: "고객A",
    owner: "영업 운영팀",
    status: "주의",
    summary: "P-42 배송 지연 이후 클레임률 100% 표본 신호가 감지된 반복 구매 고객",
    metricIds: ["metric-claim-rate", "metric-delay-time"],
    relationIds: ["relation-customer-claim"],
    eventIds: ["event-claim", "event-compensation"],
    insightIds: ["insight-customer-claims", "insight-product-margin"],
    decisionIds: []
  },
  {
    id: "entity-customer-b",
    kind: "고객군",
    name: "고객B",
    owner: "영업 운영팀",
    status: "정상",
    summary: "P-08 정밀 부품 세트를 반복 구매하지만 최근 클레임은 없는 비교 고객",
    metricIds: ["metric-claim-rate", "metric-delay-time"],
    relationIds: ["relation-customer-b-precision"],
    eventIds: ["event-order-p08"],
    insightIds: [],
    decisionIds: []
  },
  {
    id: "entity-customer-c",
    kind: "고객군",
    name: "고객C",
    owner: "고객지원팀",
    status: "검토 필요",
    summary: "P-17 표준 제어 모듈 보상 요청이 발생한 고객",
    metricIds: ["metric-claim-rate"],
    relationIds: ["relation-customer-c-product"],
    eventIds: ["event-compensation"],
    insightIds: ["insight-customer-claims"],
    decisionIds: []
  },
  {
    id: "entity-supplier-a",
    kind: "공급사",
    name: "공급업체 A사",
    owner: "구매팀",
    status: "점검 필요",
    summary: "P-42 납품준수율 70~72%와 출고 지연에 동시에 연결된 공급사",
    metricIds: ["metric-delay-time", "metric-margin"],
    relationIds: ["relation-supplier-product"],
    eventIds: ["event-outbound"],
    insightIds: ["insight-supplier-delay", "insight-product-margin"],
    decisionIds: []
  },
  {
    id: "entity-supplier-b",
    kind: "공급사",
    name: "공급업체 B사",
    owner: "구매팀",
    status: "정상",
    summary: "P-17 표준 제어 모듈을 공급하며 납품준수율이 안정적인 비교 공급사",
    metricIds: ["metric-delay-time", "metric-margin"],
    relationIds: ["relation-supplier-b-product"],
    eventIds: [],
    insightIds: [],
    decisionIds: []
  },
  {
    id: "entity-low-margin",
    kind: "상품군",
    name: "P-42 산업용 센서 패키지",
    owner: "상품 운영팀",
    status: "개선 필요",
    summary: "평균마진율 13.6%, 납품준수율 71%, 배송 지연과 클레임이 겹친 상품군",
    metricIds: ["metric-margin", "metric-delay-time", "metric-claim-rate"],
    relationIds: ["relation-supplier-product"],
    eventIds: ["event-order", "event-outbound", "event-delivery"],
    insightIds: ["insight-product-margin"],
    decisionIds: []
  },
  {
    id: "entity-product-control",
    kind: "상품군",
    name: "P-17 표준 제어 모듈",
    owner: "상품 운영팀",
    status: "정상",
    summary: "마진율과 납품준수율이 안정적이어서 P-42와 비교 기준이 되는 상품군",
    metricIds: ["metric-margin", "metric-delay-time"],
    relationIds: ["relation-supplier-b-product", "relation-customer-c-product"],
    eventIds: [],
    insightIds: [],
    decisionIds: []
  },
  {
    id: "entity-product-precision",
    kind: "상품군",
    name: "P-08 정밀 부품 세트",
    owner: "상품 운영팀",
    status: "관찰",
    summary: "공급업체 A사가 함께 공급하지만 지연 영향은 낮은 보조 상품군",
    metricIds: ["metric-margin", "metric-delay-time", "metric-claim-rate"],
    relationIds: ["relation-supplier-a-precision", "relation-customer-b-precision"],
    eventIds: ["event-order-p08"],
    insightIds: [],
    decisionIds: []
  }
];

export const sampleEvents: EventRecord[] = [
  {
    id: "event-order",
    objectId: "entity-low-margin",
    workflowType: "접수",
    name: "주문 접수",
    occurredAt: "2026-05-05T23:40:00.000Z",
    durationHours: 0.6,
    evidenceIds: ["evidence-orders-delay"]
  },
  {
    id: "event-order-p08",
    objectId: "entity-product-precision",
    workflowType: "접수",
    name: "P-08 주문 접수",
    occurredAt: "2026-05-05T21:30:00.000Z",
    durationHours: 0.4,
    evidenceIds: ["evidence-customer-b-p08"]
  },
  {
    id: "event-outbound",
    objectId: "entity-low-margin",
    workflowType: "지연",
    name: "출고 처리",
    occurredAt: "2026-05-06T02:30:00.000Z",
    durationHours: 36.8,
    evidenceIds: ["evidence-orders-delay", "evidence-supplier"]
  },
  {
    id: "event-delivery",
    objectId: "entity-low-margin",
    workflowType: "지연",
    name: "배송 상태 확인",
    occurredAt: "2026-05-06T05:10:00.000Z",
    durationHours: 18.4,
    evidenceIds: ["evidence-orders-delay"]
  },
  {
    id: "event-claim",
    objectId: "entity-customer-core",
    workflowType: "증가",
    name: "클레임 접수",
    occurredAt: "2026-05-06T07:15:00.000Z",
    durationHours: 18,
    evidenceIds: ["evidence-claims", "evidence-orders-delay"]
  },
  {
    id: "event-compensation",
    objectId: "entity-customer-core",
    workflowType: "검토",
    name: "보상 처리",
    occurredAt: "2026-05-06T09:00:00.000Z",
    durationHours: 6,
    evidenceIds: ["evidence-claims"]
  }
];

export const sampleRelations: Relation[] = [
  {
    id: "relation-supplier-product",
    fromId: "entity-supplier-a",
    toId: "entity-low-margin",
    type: "공급/납품 구조",
    relationKind: "structural",
    confidence: 0.9,
    strength: "strong",
    description: "공급업체 A사의 낮은 납품준수율이 P-42 출고 지연과 비용 압박으로 연결됩니다.",
    impact: "출고 지연이 할인 확대, 긴급 대응, 반품 비용 증가로 이어질 가능성",
    status: "강한 연결",
    evidenceIds: ["evidence-supplier", "evidence-margin", "evidence-orders-delay"],
    metricIds: ["metric-delay-time", "metric-margin"]
  },
  {
    id: "relation-customer-claim",
    fromId: "event-claim",
    toId: "entity-customer-core",
    type: "클레임 접수 대상",
    relationKind: "impact",
    confidence: 0.86,
    strength: "strong",
    description: "클레임 접수 흐름이 고객A의 보상 요청과 반복 문의로 연결됩니다.",
    impact: "클레임률 상승과 핵심 고객 이탈 위험 증가",
    status: "관찰 필요",
    evidenceIds: ["evidence-claims", "evidence-orders-delay"],
    metricIds: ["metric-claim-rate", "metric-delay-time"]
  },
  {
    id: "relation-supplier-b-product",
    fromId: "entity-supplier-b",
    toId: "entity-product-control",
    type: "공급/납품 구조",
    relationKind: "structural",
    confidence: 0.82,
    strength: "medium",
    description: "공급업체 B사는 P-17 표준 제어 모듈 공급을 담당하며 안정적인 비교 기준을 제공합니다.",
    impact: "P-42 공급 리스크를 비교하고 대체 조달 가능성을 판단하는 기준",
    status: "비교 기준",
    evidenceIds: ["evidence-supplier", "evidence-margin"],
    metricIds: ["metric-delay-time", "metric-margin"]
  },
  {
    id: "relation-supplier-a-precision",
    fromId: "entity-supplier-a",
    toId: "entity-product-precision",
    type: "공급/납품 구조",
    relationKind: "structural",
    confidence: 0.78,
    strength: "medium",
    description: "공급업체 A사는 P-08 정밀 부품 세트도 공급하지만 지연 영향은 P-42보다 낮습니다.",
    impact: "공급사 리스크가 특정 상품군에 집중되는지 비교 가능",
    status: "관찰",
    evidenceIds: ["evidence-supplier"],
    metricIds: ["metric-margin"]
  },
  {
    id: "relation-customer-b-precision",
    fromId: "entity-customer-b",
    toId: "entity-product-precision",
    type: "구매/비교 연결",
    relationKind: "structural",
    confidence: 0.8,
    strength: "medium",
    description: "고객B는 P-08 정밀 부품 세트를 정상 배송 상태로 구매해 고객A/P-42 지연 사례와 비교되는 기준을 제공합니다.",
    impact: "클레임이 없는 고객군과 보조 상품군의 정상 흐름을 함께 비교 가능",
    status: "비교 기준",
    evidenceIds: ["evidence-customer-b-p08"],
    metricIds: ["metric-claim-rate", "metric-delay-time"]
  },
  {
    id: "relation-customer-c-product",
    fromId: "entity-customer-c",
    toId: "entity-product-control",
    type: "구매/보상 연결",
    relationKind: "impact",
    confidence: 0.74,
    strength: "weak",
    description: "고객C의 보상 검토 요청이 P-17 표준 제어 모듈 주문과 연결됩니다.",
    impact: "주요 지연 이슈와 구분되는 고객 응대 기준 확인",
    status: "관찰",
    evidenceIds: ["evidence-claims"],
    metricIds: ["metric-claim-rate"]
  }
];

export const sampleMetricDefinitions: MetricDefinition[] = [
  {
    id: "metric-margin",
    name: "평균 마진율",
    unit: "%",
    formula: "평균((매출 - 원가 - 반품비용 - 매출*할인율) / 매출)",
    relatedObjectIds: ["entity-low-margin", "entity-product-control", "entity-product-precision", "entity-supplier-a", "entity-supplier-b"]
  },
  {
    id: "metric-delay-time",
    name: "주문 처리 시간",
    unit: "시간",
    formula: "P-42 주문의 출고 완료 시각 - 주문 접수 시각 평균",
    relatedObjectIds: [
      "entity-supplier-a",
      "entity-supplier-b",
      "entity-low-margin",
      "entity-product-control",
      "entity-product-precision",
      "entity-customer-core",
      "entity-customer-b"
    ]
  },
  {
    id: "metric-claim-rate",
    name: "클레임률",
    unit: "%",
    formula: "P-42 클레임 건수 / P-42 주문 건수",
    relatedObjectIds: ["entity-customer-core", "entity-customer-b", "entity-customer-c", "entity-low-margin", "entity-product-control"]
  }
];

export const sampleMetricValues: MetricValue[] = [
  {
    id: "metric-value-margin",
    metricId: "metric-margin",
    value: 13.6,
    previousValue: 18.6,
    trend: "down",
    status: "critical",
    chartType: "bar",
    series: [
      { label: "P-17", value: 21.2 },
      { label: "P-08", value: 14.9 },
      { label: "P-42", value: 13.6 },
      { label: "전체", value: 19.2 }
    ],
    calculatedAt: now,
    evidenceIds: ["evidence-margin"],
    basis: {
      rows: 2,
      averageMarginPercent: 13.6,
      returnCost: 8800000,
      discountRange: "6.4~6.8%"
    }
  },
  {
    id: "metric-value-delay",
    metricId: "metric-delay-time",
    value: 36.8,
    previousValue: 26,
    trend: "up",
    status: "warning",
    chartType: "line",
    series: [
      { label: "일반 주문", value: 22 },
      { label: "공급업체 B사", value: 24 },
      { label: "P-42", value: 36.8 },
      { label: "지연 주문", value: 41 }
    ],
    calculatedAt: now,
    evidenceIds: ["evidence-orders-delay"],
    basis: {
      delayedRows: 4,
      delayRatePercent: 80,
      averageWaitHours: 36.8,
      source: "주문_배송_클레임.xlsx"
    }
  },
  {
    id: "metric-value-claim",
    metricId: "metric-claim-rate",
    value: 100,
    previousValue: 25,
    trend: "up",
    status: "critical",
    chartType: "time_series",
    series: [
      { label: "4/24", value: 25, observedAt: "2026-04-24T09:00:00.000Z" },
      { label: "5/1", value: 50, observedAt: "2026-05-01T09:00:00.000Z" },
      { label: "5/8", value: 75, observedAt: "2026-05-08T09:00:00.000Z" },
      { label: "5/15", value: 100, observedAt: "2026-05-15T09:00:00.000Z" }
    ],
    calculatedAt: now,
    evidenceIds: ["evidence-claims"],
    basis: {
      claimRows: 4,
      p42ClaimRows: 4,
      p42OrderRows: 4,
      customerSegment: "고객A",
      timeWindow: "2026-04-24~2026-05-15"
    }
  }
];

export const sampleWorkflowMetricBindings: WorkflowMetricBinding[] = [
  {
    id: "binding-order-delay",
    eventId: "event-order",
    metricId: "metric-delay-time",
    sourceManagedObjectIds: ["entity-low-margin"]
  },
  {
    id: "binding-customer-b-p08-order",
    eventId: "event-order-p08",
    metricId: "metric-delay-time",
    sourceManagedObjectIds: ["entity-customer-b", "entity-product-precision"]
  },
  {
    id: "binding-outbound-delay",
    eventId: "event-outbound",
    metricId: "metric-delay-time",
    sourceManagedObjectIds: ["entity-supplier-a", "entity-low-margin"]
  },
  {
    id: "binding-outbound-margin",
    eventId: "event-outbound",
    metricId: "metric-margin",
    sourceManagedObjectIds: ["entity-supplier-a", "entity-low-margin"]
  },
  {
    id: "binding-claim-rate",
    eventId: "event-claim",
    metricId: "metric-claim-rate",
    sourceManagedObjectIds: ["entity-customer-core", "entity-low-margin"]
  },
  {
    id: "binding-delivery-delay",
    eventId: "event-delivery",
    metricId: "metric-delay-time",
    sourceManagedObjectIds: ["entity-low-margin"]
  }
];

export const sampleCandidateOperationalMap = {
  entityIds: {
    "candidate-customer": ["entity-customer-core", "entity-customer-b", "entity-customer-c"],
    "candidate-supplier": ["entity-supplier-a", "entity-supplier-b"],
    "candidate-product-group": ["entity-low-margin", "entity-product-control", "entity-product-precision"]
  },
  eventIds: {
    "candidate-flow": ["event-order", "event-order-p08", "event-outbound", "event-delivery"],
    "candidate-claim-flow": ["event-claim", "event-compensation"]
  },
  relationIds: {
    "candidate-relation": ["relation-supplier-product"],
    "candidate-relation-customer-claim": ["relation-customer-claim"],
    "candidate-relation-customer-b-p08": ["relation-customer-b-precision"]
  },
  metricIds: {
    "candidate-metric-margin": ["metric-margin"],
    "candidate-metric-delay": ["metric-delay-time"],
    "candidate-metric-claim": ["metric-claim-rate"]
  }
} as const;

export const sampleRelatedCandidateIdsByManagedObject: Record<string, Partial<Record<CandidateType, string[]>>> = {
  "candidate-customer": {
    workflow_event: ["candidate-claim-flow", "candidate-flow"],
    relation: ["candidate-relation-customer-claim", "candidate-relation-customer-b-p08"],
    metric: ["candidate-metric-claim", "candidate-metric-delay"]
  },
  "candidate-supplier": {
    workflow_event: ["candidate-flow"],
    relation: ["candidate-relation"],
    metric: ["candidate-metric-delay", "candidate-metric-margin"]
  },
  "candidate-product-group": {
    workflow_event: ["candidate-flow", "candidate-claim-flow"],
    relation: ["candidate-relation", "candidate-relation-customer-claim", "candidate-relation-customer-b-p08"],
    metric: ["candidate-metric-margin", "candidate-metric-claim"]
  }
};

export const sampleMetricCandidateIdsByWorkflowCandidate: Record<string, string[]> = {
  "candidate-flow": ["candidate-metric-delay", "candidate-metric-margin"],
  "candidate-claim-flow": ["candidate-metric-claim"]
};

export const sampleResultScenarios: SampleResultScenario[] = [
  {
    id: "customer",
    managedCandidateId: "candidate-customer",
    insightId: "insight-customer-claims",
    title: "고객A 클레임 반복과 보상 비용 증가",
    severity: "high",
    detected: "고객A의 P-42 주문에서 배송 지연 이후 클레임률 100% 표본 신호가 감지되었습니다.",
    reason: "반복 구매 고객군에서 배송 지연과 보상 요청이 함께 나타나 이탈 위험과 대응 비용이 동시에 커집니다.",
    likelyCauses: ["P-42 배송 지연", "보상 요청이 고객A에 집중", "고객 안내 기준의 일관성 부족"],
    recommendedActions: ["고객A에 선제 안내를 발송합니다.", "보상 기준을 고객군 영향도에 맞춰 조정합니다.", "클레임 처리 흐름의 병목 시간을 주 단위로 추적합니다."],
    supportSummary: ["클레임률 100%는 P-42 주문과 고객A 근거 행에서 계산되었습니다.", "클레임 접수 연결 신뢰도 86%가 고객군 영향과 보상 요청을 연결합니다."],
    relatedMetricIds: ["metric-claim-rate", "metric-delay-time"],
    relatedObjectIds: ["entity-customer-core"],
    relatedEventIds: ["event-claim", "event-compensation"],
    relatedRelationIds: ["relation-customer-claim"],
    evidenceIds: ["evidence-claims", "evidence-orders-delay"],
    proposal: {
      id: "proposal-customer-care",
      title: "고객A 선제 안내 및 보상 기준 조정안",
      summary: "P-42 지연 영향을 받은 고객A에 선제 안내와 보상 기준을 먼저 적용합니다.",
      expectedImpact: "클레임률 상승 폭을 낮추고 반복 구매 고객군의 이탈 위험을 줄이는 것이 목표입니다.",
      comment: "고객군 영향도가 높으므로 안내와 보상 기준을 함께 조정하는 편이 적절합니다."
    },
    dashboard: {
      chartType: "time_series",
      chartTitle: "고객A 클레임률",
      chartDescription: "고객A의 P-42 클레임률을 주간 흐름으로 확인합니다."
    }
  },
  {
    id: "supplier",
    managedCandidateId: "candidate-supplier",
    insightId: "insight-supplier-delay",
    title: "공급업체 A사 출고 지연으로 납품 리스크 상승",
    severity: "high",
    detected: "공급업체 A사의 P-42 납품준수율이 70~72%로 낮고 주문 처리 시간이 36.8시간으로 상승했습니다.",
    reason: "공급 지연은 상품군 비용과 고객 응대 부담을 동시에 밀어 올릴 수 있습니다.",
    likelyCauses: ["공급업체 A사의 평균 출고 대기 시간 증가", "P-42 공급 의존도 집중", "긴급 출고 대응 기준 부족"],
    recommendedActions: ["공급업체 A사의 납품 조건을 재협의합니다.", "대체 공급 가능 상품군을 우선 확인합니다.", "출고 지연 기준을 초과한 주문을 별도 추적합니다."],
    supportSummary: ["공급/납품 구조 연결 신뢰도 90%가 공급사와 P-42를 연결합니다.", "주문 처리 시간과 납품준수율이 같은 공급사 행에서 함께 악화되었습니다."],
    relatedMetricIds: ["metric-delay-time", "metric-margin"],
    relatedObjectIds: ["entity-supplier-a"],
    relatedEventIds: ["event-order", "event-outbound", "event-delivery"],
    relatedRelationIds: ["relation-supplier-product"],
    evidenceIds: ["evidence-orders-delay", "evidence-supplier"],
    proposal: {
      id: "proposal-supplier-terms",
      title: "공급업체 A사 납품 조건 재협의안",
      summary: "공급업체 A사의 납품 조건과 지연 대응 기준을 재협의하고 대체 공급 검토 기준을 수립합니다.",
      expectedImpact: "주문 처리 시간을 낮추고 공급 집중 리스크를 줄이는 것이 목표입니다.",
      comment: "지연 지표가 공급사와 직접 연결되어 있어 조건 재협의가 우선 검토 대상입니다."
    },
    dashboard: {
      chartType: "line",
      chartTitle: "P-42 주문 처리 시간",
      chartDescription: "공급업체 A사와 P-42의 출고 대기 시간 변화를 선형 흐름으로 비교합니다."
    }
  },
  {
    id: "product",
    managedCandidateId: "candidate-product-group",
    insightId: "insight-product-margin",
    title: "P-42 마진 하락과 클레임 비용 증가",
    severity: "high",
    detected: "P-42 평균마진율은 13.6%로 낮고 주문 지연률 80%, 클레임률 100%가 함께 나타났습니다.",
    reason: "상품군 수익성이 낮아지는 동시에 보상 비용과 고객 응대 부담이 커져 운영 조정이 필요합니다.",
    likelyCauses: ["P-42 할인율 6%대와 반품비용 증가", "공급업체 A사 납품준수율 저하", "고객A의 반복 클레임"],
    recommendedActions: ["P-42 할인 정책을 조정합니다.", "반품 비용이 높은 주문을 별도 점검합니다.", "공급사 의존도가 높은 품목의 대체 조달 가능성을 확인합니다."],
    supportSummary: ["평균마진율, 주문 처리 시간, 클레임률 3개 지표가 모두 P-42에 연결됩니다.", "공급 연결과 서비스 연결이 각각 비용 압박과 고객 영향 경로를 설명합니다."],
    relatedMetricIds: ["metric-margin", "metric-claim-rate"],
    relatedObjectIds: ["entity-low-margin"],
    relatedEventIds: ["event-order", "event-outbound", "event-delivery", "event-claim", "event-compensation"],
    relatedRelationIds: ["relation-supplier-product", "relation-customer-claim"],
    evidenceIds: ["evidence-margin", "evidence-claims", "evidence-supplier"],
    proposal: {
      id: "proposal-product-margin",
      title: "P-42 마진 구조 조정안",
      summary: "P-42 할인 정책과 반품 비용 기준을 조정하고 공급 의존도가 높은 주문을 우선 점검합니다.",
      expectedImpact: "평균 마진율을 회복하고 클레임 비용 증가 폭을 줄이는 것이 목표입니다.",
      comment: "마진과 클레임 지표가 같은 상품군에 집중되어 있어 상품군 단위 조정이 필요합니다."
    },
    dashboard: {
      chartType: "bar",
      chartTitle: "P-42 마진율 비교",
      chartDescription: "P-42 평균 마진율을 상품군 기준으로 비교합니다."
    }
  }
];

export const sampleInsights: AIInsight[] = sampleResultScenarios.map((scenario) => ({
  id: scenario.insightId,
  title: scenario.title,
  status: "new",
  severity: scenario.severity,
  detected: scenario.detected,
  reason: scenario.reason,
  likelyCauses: scenario.likelyCauses,
  recommendedActions: scenario.recommendedActions,
  supportSummary: scenario.supportSummary,
  relatedMetricIds: scenario.relatedMetricIds,
  relatedObjectIds: scenario.relatedObjectIds,
  relatedEventIds: scenario.relatedEventIds,
  relatedRelationIds: scenario.relatedRelationIds,
  evidenceIds: scenario.evidenceIds
}));
