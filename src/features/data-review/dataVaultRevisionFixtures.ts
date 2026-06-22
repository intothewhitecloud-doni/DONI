import type { BadgeTone } from "../../components/ui/Badge";
import { sampleEvidence, sampleResultScenarios } from "../../lib/domain/sample-analysis";
import type { SourceFile } from "../../lib/domain/types";

export type VaultTabId = "source" | "draft" | "correction" | "current";

export type VaultRevisionRow = {
  field: string;
  source: string;
  draft: string;
  correction: string;
  current: string;
  note: string;
};

export type VaultImpactItem = {
  label: string;
  value: string;
  detail: string;
  tone: BadgeTone;
};

export type VaultFlowEvent = {
  id: string;
  label: string;
  owner: string;
  detail: string;
  time: string;
  tone: BadgeTone;
};

export type VaultCorrectionEvent = {
  id: string;
  title: string;
  actor: string;
  time: string;
  detail: string;
  tone: BadgeTone;
};

export type VaultRevisionFixture = {
  sourceFileId: string;
  statusLabel: string;
  owner: string;
  updatedAt: string;
  sampleNotice: string;
  impactSummary: string;
  affected: VaultImpactItem[];
  metrics: VaultImpactItem[];
  insights: VaultImpactItem[];
  fields: string[];
  revisionRows: VaultRevisionRow[];
  correctionEvents: VaultCorrectionEvent[];
  flowEvents: VaultFlowEvent[];
  evidenceIds: string[];
};

export type VaultStructureRow = {
  kind: string;
  name: string;
  source: string;
  status: string;
};

export type VaultFieldRecord = {
  field: string;
  note: string;
  status: string;
  value: string;
};

export type VaultDraftItem = {
  id: string;
  title: string;
  subtitle: string;
  statusLabel: string;
  statusTone: BadgeTone;
  owner: string;
  updatedAt: string;
  summary: string;
  sourceFiles: string[];
  fields: string[];
  entityCount: number;
  eventCount: number;
  relationCount: number;
  structureRows: VaultStructureRow[];
  impactItems: VaultImpactItem[];
  reviewEvents: VaultFlowEvent[];
  flowEvents: VaultFlowEvent[];
  evidenceIds: string[];
};

export type VaultCorrectionItem = {
  id: string;
  title: string;
  subtitle: string;
  statusLabel: string;
  statusTone: BadgeTone;
  actor: string;
  updatedAt: string;
  summary: string;
  sourceName: string;
  revisionRows: VaultRevisionRow[];
  impactItems: VaultImpactItem[];
  correctionEvents: VaultCorrectionEvent[];
  flowEvents: VaultFlowEvent[];
  evidenceIds: string[];
};

export type VaultCurrentDataItem = {
  id: string;
  title: string;
  subtitle: string;
  statusLabel: string;
  statusTone: BadgeTone;
  owner: string;
  updatedAt: string;
  summary: string;
  domain: string;
  records: VaultFieldRecord[];
  impactItems: VaultImpactItem[];
  flowEvents: VaultFlowEvent[];
  evidenceIds: string[];
};

export const vaultStageTabs: Array<{ id: VaultTabId; label: string; helper: string }> = [
  { id: "source", label: "원천 기록", helper: "업로드된 파일 값" },
  { id: "draft", label: "AI 구조 초안", helper: "샘플 추정 구조" },
  { id: "correction", label: "보정 기록", helper: "사용자 수정 흐름" },
  { id: "current", label: "현재 기준 데이터", helper: "반영 예정 기준" }
];

const customerScenario = sampleResultScenarios.find((scenario) => scenario.id === "customer");
const supplierScenario = sampleResultScenarios.find((scenario) => scenario.id === "supplier");
const productScenario = sampleResultScenarios.find((scenario) => scenario.id === "product");

const orderEvidenceIds = sampleEvidence
  .filter((evidence) => evidence.sourceFileId === "source-orders")
  .map((evidence) => evidence.id);

const marginEvidenceIds = sampleEvidence
  .filter((evidence) => evidence.sourceFileId === "source-margin")
  .map((evidence) => evidence.id);

export const dataVaultRevisionFixtures: Record<string, VaultRevisionFixture> = {
  "source-orders": {
    sourceFileId: "source-orders",
    statusLabel: "원천",
    owner: "영업 1팀",
    updatedAt: "2026-05-12 14:30",
    sampleNotice: "샘플 기준으로 고객, 상품, 공급사, 클레임 흐름의 영향만 보여줍니다.",
    impactSummary: "주문/배송 원천값이 고객A 클레임률과 P-42 주문 처리 시간 흐름에 연결됩니다.",
    affected: [
      { label: "관리 대상", value: "고객A", detail: "반복 클레임 고객군", tone: "info" },
      { label: "관리 대상", value: "P-42", detail: "지연 주문 상품군", tone: "violet" },
      { label: "관계", value: "공급업체 A사", detail: "P-42 공급 연결", tone: "emerald" }
    ],
    metrics: [
      { label: "지표", value: "클레임률", detail: "고객A/P-42 표본 100%", tone: "danger" },
      { label: "지표", value: "주문 처리 시간", detail: "평균 36.8시간 신호", tone: "warning" }
    ],
    insights: [
      {
        label: "인사이트",
        value: customerScenario?.title ?? "고객A 클레임 반복과 보상 비용 증가",
        detail: customerScenario?.detected ?? "고객A 클레임 반복 신호",
        tone: "danger"
      }
    ],
    fields: ["고객군", "상품군", "공급사", "배송상태", "출고대기시간", "클레임유형"],
    revisionRows: [
      { field: "고객군", source: "고객A", draft: "고객 A", correction: "고객A", current: "고객A", note: "표기 통일" },
      { field: "상품군", source: "P-42", draft: "P-42 상품군", correction: "P-42", current: "P-42", note: "상품군 코드 유지" },
      { field: "배송상태", source: "지연", draft: "배송 지연", correction: "지연", current: "지연", note: "원천 상태값 보존" },
      { field: "출고대기시간", source: "42시간", draft: "36.8시간 평균", correction: "36.8시간", current: "36.8시간", note: "샘플 평균 예정" },
      { field: "클레임유형", source: "배송 지연", draft: "지연 클레임", correction: "배송 지연", current: "배송 지연", note: "클레임 분류 보정" }
    ],
    correctionEvents: [
      { id: "orders-correction-1", title: "고객명 표기 보정", actor: "박민재", time: "2026-05-12 14:36", detail: "고객 A를 고객A로 통일", tone: "warning" },
      { id: "orders-correction-2", title: "배송상태 원천값 유지", actor: "시스템", time: "2026-05-12 14:41", detail: "배송 지연 초안을 원천 상태값 지연으로 되돌림", tone: "info" },
      { id: "orders-correction-3", title: "현재 기준 반영 예정", actor: "박민재", time: "2026-05-12 14:50", detail: "클레임률과 주문 처리 시간 재계산 대기", tone: "success" }
    ],
    flowEvents: [
      { id: "orders-flow-1", label: "원천 기록 생성", owner: "시스템", time: "2026-05-12 14:30", detail: "주문_배송_클레임.xlsx 샘플 파일 등록", tone: "neutral" },
      { id: "orders-flow-2", label: "AI 구조 초안 생성", owner: "AI 초안", time: "2026-05-12 14:33", detail: "고객A/P-42/공급업체 A사 연결 후보 생성", tone: "info" },
      { id: "orders-flow-3", label: "사용자 보정", owner: "박민재", time: "2026-05-12 14:36", detail: "고객군 표기와 배송상태 분류 보정", tone: "warning" },
      { id: "orders-flow-4", label: "현재 기준 반영", owner: "샘플", time: "2026-05-12 14:50", detail: "실제 반영 없이 화면 샘플 상태만 표시", tone: "success" },
      { id: "orders-flow-5", label: "Metric 재계산 예정", owner: "추후 구현", time: "대기", detail: "클레임률, 주문 처리 시간 재계산은 실제 로직에서 구현", tone: "neutral" }
    ],
    evidenceIds: orderEvidenceIds
  },
  "source-margin": {
    sourceFileId: "source-margin",
    statusLabel: "원천",
    owner: "재무/구매",
    updatedAt: "2026-05-12 14:30",
    sampleNotice: "샘플 기준으로 상품, 공급사, 마진, 납품 리스크의 영향만 보여줍니다.",
    impactSummary: "상품/마진 원천값이 P-42 평균 마진율과 공급업체 A사 납품 리스크에 연결됩니다.",
    affected: [
      { label: "관리 대상", value: "P-42", detail: "저마진 상품군", tone: "violet" },
      { label: "관리 대상", value: "공급업체 A사", detail: "납품준수율 70~72%", tone: "emerald" },
      { label: "업무 흐름", value: "납품 리스크", detail: "공급 조건 재협의 후보", tone: "orange" }
    ],
    metrics: [
      { label: "지표", value: "평균 마진율", detail: "P-42 13.6% 샘플", tone: "danger" },
      { label: "지표", value: "납품준수율", detail: "70~72% 구간", tone: "warning" }
    ],
    insights: [
      {
        label: "인사이트",
        value: productScenario?.title ?? "P-42 마진 하락과 클레임 비용 증가",
        detail: productScenario?.detected ?? "P-42 마진 하락 신호",
        tone: "danger"
      },
      {
        label: "인사이트",
        value: supplierScenario?.title ?? "공급업체 A사 출고 지연으로 납품 리스크 상승",
        detail: supplierScenario?.detected ?? "공급사 납품 리스크 신호",
        tone: "warning"
      }
    ],
    fields: ["상품군", "상품명", "공급사", "할인율", "반품비용", "평균마진율", "납품준수율"],
    revisionRows: [
      { field: "상품군", source: "P-42", draft: "P-42 상품군", correction: "P-42", current: "P-42", note: "코드 유지" },
      { field: "공급사", source: "공급업체 A사", draft: "공급업체 A", correction: "공급업체 A사", current: "공급업체 A사", note: "명칭 보정" },
      { field: "평균마진율", source: "13.8%, 13.4%", draft: "13.6% 평균", correction: "13.6%", current: "13.6%", note: "샘플 평균 예정" },
      { field: "납품준수율", source: "72%, 70%", draft: "저준수 구간", correction: "70~72%", current: "70~72%", note: "범위 표기" },
      { field: "반품비용", source: "4200000, 4600000", draft: "반품 비용 높음", correction: "4.2M~4.6M", current: "4.2M~4.6M", note: "표시 단위 보정" }
    ],
    correctionEvents: [
      { id: "margin-correction-1", title: "공급사 명칭 보정", actor: "박민재", time: "2026-05-12 14:35", detail: "공급업체 A를 공급업체 A사로 통일", tone: "warning" },
      { id: "margin-correction-2", title: "마진율 평균 표시", actor: "시스템", time: "2026-05-12 14:40", detail: "P-42 두 행을 13.6% 샘플 평균으로 표시", tone: "info" },
      { id: "margin-correction-3", title: "납품 리스크 연결", actor: "박민재", time: "2026-05-12 14:48", detail: "공급 조건 재협의 흐름에 연결 예정", tone: "success" }
    ],
    flowEvents: [
      { id: "margin-flow-1", label: "원천 기록 생성", owner: "시스템", time: "2026-05-12 14:30", detail: "상품별_마진_공급사.csv 샘플 파일 등록", tone: "neutral" },
      { id: "margin-flow-2", label: "AI 구조 초안 생성", owner: "AI 초안", time: "2026-05-12 14:34", detail: "P-42/공급업체 A사/마진율 후보 생성", tone: "info" },
      { id: "margin-flow-3", label: "사용자 보정", owner: "박민재", time: "2026-05-12 14:35", detail: "공급사 명칭과 마진 표시 단위 보정", tone: "warning" },
      { id: "margin-flow-4", label: "현재 기준 반영", owner: "샘플", time: "2026-05-12 14:48", detail: "실제 반영 없이 화면 샘플 상태만 표시", tone: "success" },
      { id: "margin-flow-5", label: "Metric 재계산 예정", owner: "추후 구현", time: "대기", detail: "평균 마진율, 납품 리스크 재계산은 실제 로직에서 구현", tone: "neutral" }
    ],
    evidenceIds: marginEvidenceIds
  }
};

export function getDataVaultRevisionFixture(sourceFileId?: string): VaultRevisionFixture | undefined {
  return sourceFileId ? dataVaultRevisionFixtures[sourceFileId] : undefined;
}

export function createUploadedFileRevisionFixture(file: SourceFile): VaultRevisionFixture {
  const uploadedAt = file.uploadedAt ? new Date(file.uploadedAt).toLocaleString("ko-KR") : "업로드 전";
  const previewFields = file.previewColumns?.filter(Boolean).slice(0, 6) ?? [];
  const fields = previewFields.length > 0 ? previewFields : ["파일명", "파일 종류", "파일 크기", "반영 상태"];
  const hasPreviewRows = Boolean(file.previewRows?.length);
  const rowCountLabel = typeof file.rowCount === "number" && (file.rowCount > 0 || hasPreviewRows)
    ? `${file.rowCount.toLocaleString("ko-KR")}행`
    : uploadedSourceFileSummary(file);

  return {
    sourceFileId: file.id,
    statusLabel: "원천",
    owner: "데이터 보관함",
    updatedAt: uploadedAt,
    sampleNotice: "직접 추가한 파일의 메타데이터와 미리보기 필드 기준으로 영향 범위를 표시합니다.",
    impactSummary: file.description || "업로드된 원천 파일이 관리 대상 후보, 구조 초안, 보정 기록, 현재 기준 반영 상태로 이어집니다.",
    affected: [
      { label: "관리 대상 후보", value: fields[0] ?? "파일 필드", detail: "업로드 파일의 첫 번째 필드를 후보로 표시", tone: "info" },
      { label: "업무 흐름", value: "정보 보정", detail: "데이터명, 설명, 유형, 담당 부서를 수정 가능", tone: "orange" },
      { label: "반영 경로", value: file.appliedAt ? "현재 기준 반영됨" : "현재 기준 대기", detail: "구조맵과 지표/인사이트 컬렉션에 연결", tone: "emerald" }
    ],
    metrics: [
      { label: "행 수", value: rowCountLabel, detail: "업로드 미리보기 기준", tone: "neutral" },
      { label: "Metric", value: "보정 완료율", detail: "필수 메타데이터 기준으로 계산", tone: file.appliedAt ? "success" : "warning" }
    ],
    insights: [
      { label: "인사이트", value: file.appliedAt ? "기준 반영 관계 생성" : "영향 감지 준비", detail: "원천값 변경이 어느 화면에 영향을 줄지 사전 확인", tone: "info" }
    ],
    fields,
    revisionRows: [
      { field: "데이터명", source: file.name, draft: file.name, correction: file.name, current: file.name, note: "정보 보정 가능" },
      { field: "설명", source: file.description || "-", draft: file.description || "설명 후보", correction: file.description || "-", current: file.description || "-", note: "사용자 입력값 유지" },
      { field: "데이터 유형", source: file.kind, draft: "표 형식 데이터", correction: file.kind, current: file.kind, note: "사용자 선택값 유지" },
      { field: "데이터 규모", source: rowCountLabel, draft: rowCountLabel, correction: rowCountLabel, current: rowCountLabel, note: "미리보기 기준" },
      { field: "구조 상태", source: "원천 기록", draft: "AI 구조 초안", correction: "사용자 보정", current: file.appliedAt ? "반영됨" : "반영 대기", note: "실제 상태" }
    ],
    correctionEvents: [
      { id: `${file.id}-correction-1`, title: "원천 파일 등록", actor: "시스템", time: uploadedAt, detail: `${file.name} 파일을 데이터 보관함에 추가`, tone: "neutral" },
      { id: `${file.id}-correction-2`, title: "정보 보정 가능", actor: "사용자", time: "대기", detail: "데이터명, 설명, 데이터 유형, 담당 부서를 저장", tone: "warning" },
      { id: `${file.id}-correction-3`, title: file.appliedAt ? "현재 기준 반영 완료" : "현재 기준 반영 대기", actor: "시스템", time: file.appliedAt ? new Date(file.appliedAt).toLocaleString("ko-KR") : "대기", detail: "엔터티, 연결관계, 업무흐름, 지표, 인사이트 관계를 생성", tone: "success" }
    ],
    flowEvents: [
      { id: `${file.id}-flow-1`, label: "원천 기록 생성", owner: "시스템", time: uploadedAt, detail: `${file.name} 업로드 완료`, tone: "neutral" },
      { id: `${file.id}-flow-2`, label: "AI 구조 초안", owner: "시스템", time: "대기", detail: "구조 보기에서 미리보기 필드 기반 구조 후보 표시", tone: "info" },
      { id: `${file.id}-flow-3`, label: "사용자 보정", owner: "사용자", time: "대기", detail: "필수 메타데이터를 보정하고 저장", tone: "warning" },
      { id: `${file.id}-flow-4`, label: "현재 기준 반영", owner: "시스템", time: file.appliedAt ? new Date(file.appliedAt).toLocaleString("ko-KR") : "대기", detail: "현재 기준에 반영 버튼으로 운영 구조 컬렉션 생성", tone: "success" },
      { id: `${file.id}-flow-5`, label: "Metric 재계산", owner: "시스템", time: file.appliedAt ? new Date(file.appliedAt).toLocaleString("ko-KR") : "대기", detail: "보정 완료율 지표와 인사이트를 같은 원천 근거에 연결", tone: file.appliedAt ? "success" : "neutral" }
    ],
    evidenceIds: []
  };
}

function uploadedSourceFileSummary(file: SourceFile): string {
  if (typeof file.size !== "number") {
    return file.kind;
  }

  if (file.size < 1024) {
    return `${file.kind} · ${file.size.toLocaleString("ko-KR")} bytes`;
  }

  if (file.size < 1024 * 1024) {
    return `${file.kind} · ${(file.size / 1024).toLocaleString("ko-KR", { maximumFractionDigits: 1 })} KB`;
  }

  return `${file.kind} · ${(file.size / 1024 / 1024).toLocaleString("ko-KR", { maximumFractionDigits: 1 })} MB`;
}

export const vaultDraftItems: VaultDraftItem[] = [
  {
    id: "draft-customer-claim-flow",
    title: "고객 클레임 구조 초안",
    subtitle: "주문_배송_클레임.xlsx 기반",
    statusLabel: "검토 필요",
    statusTone: "warning",
    owner: "AI 초안",
    updatedAt: "2026-05-12 14:33",
    summary: "주문/배송 원천값에서 고객A, P-42, 배송 지연 클레임 흐름을 추정한 샘플 구조입니다.",
    sourceFiles: ["주문_배송_클레임.xlsx"],
    fields: ["고객군", "상품군", "배송상태", "출고대기시간", "클레임유형"],
    entityCount: 7,
    eventCount: 4,
    relationCount: 6,
    structureRows: [
      { kind: "Entity", name: "고객A", source: "고객군", status: "표기 검토" },
      { kind: "Entity", name: "P-42", source: "상품군", status: "후보 확정" },
      { kind: "Event", name: "배송 지연", source: "배송상태", status: "보정 대기" },
      { kind: "Relation", name: "고객A -> 배송 지연", source: "클레임유형", status: "검토 필요" }
    ],
    impactItems: [
      { label: "관리 대상 후보", value: "고객A", detail: "반복 클레임 고객군 후보", tone: "info" },
      { label: "업무 흐름 후보", value: "배송 지연", detail: "출고대기시간 36.8시간 평균 후보", tone: "orange" },
      { label: "지표 후보", value: "클레임률", detail: "현재 기준 반영 전 검토 필요", tone: "warning" },
      { label: "인사이트 후보", value: "보상 비용 증가", detail: "고객A 클레임 반복 신호", tone: "danger" }
    ],
    reviewEvents: [
      { id: "draft-customer-review-1", label: "필드 매핑 확인", owner: "박민재", time: "대기", detail: "고객군과 고객명 표기 차이 확인 필요", tone: "warning" },
      { id: "draft-customer-review-2", label: "관계 검토", owner: "AI 초안", time: "2026-05-12 14:33", detail: "고객A -> 배송 지연 관계 후보 생성", tone: "info" }
    ],
    flowEvents: dataVaultRevisionFixtures["source-orders"].flowEvents,
    evidenceIds: orderEvidenceIds
  },
  {
    id: "draft-margin-risk-flow",
    title: "상품 마진/공급 리스크 초안",
    subtitle: "상품별_마진_공급사.csv 기반",
    statusLabel: "승인 대기",
    statusTone: "info",
    owner: "AI 초안",
    updatedAt: "2026-05-12 14:34",
    summary: "상품 P-42와 공급업체 A사의 마진율, 납품준수율을 기준으로 리스크 구조를 추정합니다.",
    sourceFiles: ["상품별_마진_공급사.csv"],
    fields: ["상품군", "공급사", "평균마진율", "납품준수율", "반품비용"],
    entityCount: 5,
    eventCount: 3,
    relationCount: 5,
    structureRows: [
      { kind: "Entity", name: "P-42", source: "상품군", status: "후보 확정" },
      { kind: "Entity", name: "공급업체 A사", source: "공급사", status: "명칭 보정 필요" },
      { kind: "Metric", name: "평균 마진율", source: "평균마진율", status: "계산 대기" },
      { kind: "Relation", name: "공급업체 A사 -> P-42", source: "납품준수율", status: "검토 필요" }
    ],
    impactItems: [
      { label: "관리 대상 후보", value: "P-42", detail: "저마진 상품군 후보", tone: "violet" },
      { label: "관계 후보", value: "공급업체 A사", detail: "P-42 공급 연결 후보", tone: "emerald" },
      { label: "지표 후보", value: "평균 마진율", detail: "13.6% 샘플 평균", tone: "danger" },
      { label: "업무 흐름 후보", value: "납품 리스크", detail: "공급 조건 재협의 후보", tone: "orange" }
    ],
    reviewEvents: [
      { id: "draft-margin-review-1", label: "공급사 명칭 검토", owner: "박민재", time: "대기", detail: "공급업체 A와 공급업체 A사 표기 통일 필요", tone: "warning" },
      { id: "draft-margin-review-2", label: "Metric 연결 확인", owner: "AI 초안", time: "2026-05-12 14:34", detail: "평균 마진율과 납품 리스크 연결 후보 생성", tone: "info" }
    ],
    flowEvents: dataVaultRevisionFixtures["source-margin"].flowEvents,
    evidenceIds: marginEvidenceIds
  }
];

export const vaultCorrectionItems: VaultCorrectionItem[] = [
  {
    id: "correction-customer-name",
    title: "고객명 표기 보정",
    subtitle: "고객 A -> 고객A",
    statusLabel: "보정됨",
    statusTone: "success",
    actor: "박민재",
    updatedAt: "2026-05-12 14:36",
    summary: "AI 초안의 고객 A 표기를 현재 기준 데이터와 맞추기 위해 고객A로 통일한 샘플 보정입니다.",
    sourceName: "주문_배송_클레임.xlsx",
    revisionRows: [
      { field: "고객군", source: "고객A", draft: "고객 A", correction: "고객A", current: "고객A", note: "표기 통일" },
      { field: "클레임유형", source: "배송 지연", draft: "지연 클레임", correction: "배송 지연", current: "배송 지연", note: "분류명 보존" }
    ],
    impactItems: [
      { label: "관리 대상", value: "고객A", detail: "동일 고객군으로 병합", tone: "info" },
      { label: "지표", value: "클레임률", detail: "재계산 예정", tone: "warning" },
      { label: "인사이트", value: "보상 비용 증가", detail: "반복 클레임 신호 유지", tone: "danger" },
      { label: "반영 상태", value: "현재 기준 대기", detail: "실제 반영은 추후 구현", tone: "emerald" }
    ],
    correctionEvents: dataVaultRevisionFixtures["source-orders"].correctionEvents,
    flowEvents: dataVaultRevisionFixtures["source-orders"].flowEvents,
    evidenceIds: orderEvidenceIds
  },
  {
    id: "correction-supplier-name",
    title: "공급사 명칭 보정",
    subtitle: "공급업체 A -> 공급업체 A사",
    statusLabel: "승인됨",
    statusTone: "success",
    actor: "박민재",
    updatedAt: "2026-05-12 14:35",
    summary: "상품/마진 초안의 공급사 명칭을 운영 기준 명칭으로 맞춘 샘플 보정입니다.",
    sourceName: "상품별_마진_공급사.csv",
    revisionRows: [
      { field: "공급사", source: "공급업체 A사", draft: "공급업체 A", correction: "공급업체 A사", current: "공급업체 A사", note: "명칭 보정" },
      { field: "평균마진율", source: "13.8%, 13.4%", draft: "13.6% 평균", correction: "13.6%", current: "13.6%", note: "표시 단위 보정" }
    ],
    impactItems: [
      { label: "관리 대상", value: "공급업체 A사", detail: "공급사 기준명 확정", tone: "emerald" },
      { label: "지표", value: "평균 마진율", detail: "13.6% 샘플 유지", tone: "danger" },
      { label: "업무 흐름", value: "납품 리스크", detail: "공급 조건 재협의 후보", tone: "orange" },
      { label: "반영 상태", value: "반영 예정", detail: "현재 기준 데이터 화면에서 표시", tone: "info" }
    ],
    correctionEvents: dataVaultRevisionFixtures["source-margin"].correctionEvents,
    flowEvents: dataVaultRevisionFixtures["source-margin"].flowEvents,
    evidenceIds: marginEvidenceIds
  }
];

export const vaultCurrentDataItems: VaultCurrentDataItem[] = [
  {
    id: "current-customer-a",
    title: "고객A 기준 데이터",
    subtitle: "관리 대상 · 고객",
    statusLabel: "반영 예정",
    statusTone: "info",
    owner: "영업 1팀",
    updatedAt: "2026-05-12 14:50",
    summary: "고객A 클레임 흐름을 현재 기준 데이터에 반영하기 전 샘플 상태입니다.",
    domain: "관리 대상",
    records: [
      { field: "기준명", value: "고객A", status: "보정 반영", note: "고객 A 표기 통일" },
      { field: "연결 상품", value: "P-42", status: "연결 예정", note: "지연 주문 상품군" },
      { field: "대표 지표", value: "클레임률", status: "재계산 대기", note: "실제 계산은 추후 구현" }
    ],
    impactItems: [
      { label: "관리 대상", value: "고객A", detail: "현재 기준명 유지", tone: "info" },
      { label: "업무 흐름", value: "클레임 접수", detail: "반복 클레임 흐름 연결", tone: "orange" },
      { label: "지표", value: "클레임률", detail: "재계산 예정", tone: "warning" },
      { label: "인사이트", value: "보상 비용 증가", detail: "의사결정 후보", tone: "danger" }
    ],
    flowEvents: dataVaultRevisionFixtures["source-orders"].flowEvents,
    evidenceIds: orderEvidenceIds
  },
  {
    id: "current-p42-margin",
    title: "P-42 마진 기준 데이터",
    subtitle: "관리 대상 · 상품",
    statusLabel: "검토 대기",
    statusTone: "warning",
    owner: "재무/구매",
    updatedAt: "2026-05-12 14:48",
    summary: "P-42 상품군의 평균 마진율과 공급 리스크를 현재 기준 데이터로 정리한 샘플입니다.",
    domain: "지표/관리 대상",
    records: [
      { field: "기준명", value: "P-42", status: "후보 확정", note: "상품군 코드 유지" },
      { field: "연결 공급사", value: "공급업체 A사", status: "보정 반영", note: "공급사 명칭 보정" },
      { field: "대표 지표", value: "평균 마진율 13.6%", status: "재계산 대기", note: "실제 계산은 추후 구현" }
    ],
    impactItems: [
      { label: "관리 대상", value: "P-42", detail: "저마진 상품군", tone: "violet" },
      { label: "관계", value: "공급업체 A사", detail: "공급 연결 유지", tone: "emerald" },
      { label: "지표", value: "평균 마진율", detail: "13.6% 샘플", tone: "danger" },
      { label: "업무 흐름", value: "납품 리스크", detail: "재협의 후보", tone: "orange" }
    ],
    flowEvents: dataVaultRevisionFixtures["source-margin"].flowEvents,
    evidenceIds: marginEvidenceIds
  }
];

export function getVaultDraftItem(id?: string): VaultDraftItem | undefined {
  return vaultDraftItems.find((item) => item.id === id) ?? vaultDraftItems[0];
}

export function getVaultCorrectionItem(id?: string): VaultCorrectionItem | undefined {
  return vaultCorrectionItems.find((item) => item.id === id) ?? vaultCorrectionItems[0];
}

export function getVaultCurrentDataItem(id?: string): VaultCurrentDataItem | undefined {
  return vaultCurrentDataItems.find((item) => item.id === id) ?? vaultCurrentDataItems[0];
}
