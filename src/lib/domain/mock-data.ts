import {
  sampleCandidates,
  sampleEntities,
  sampleEvents,
  sampleEvidence,
  sampleInsights,
  sampleManagedObjectTypes,
  sampleMetricDefinitions,
  sampleMetricValues,
  sampleRelations,
  sampleSourceFiles,
  sampleWorkflowTypes,
  sampleWorkflowMetricBindings
} from "./sample-analysis";
import type { PrototypeState } from "./types";
import { createDefaultStructureMapViewState, UNASSIGNED_ORGANIZATION_CATEGORY_ID } from "./types";
import { demoAccounts } from "./auth-fixtures";

const now = "2026-05-07T09:00:00.000Z";

export const initialPrototypeState: PrototypeState = {
  screen: "login",
  session: {
    loggedIn: false,
    currentUserId: "user-manager",
    role: "manager"
  },
  authAccounts: demoAccounts,
  users: [
    { email: "owner@next.example", id: "user-owner", name: "박민재", role: "owner" },
    { email: "manager@next.example", id: "user-manager", name: "김도현", role: "manager" }
  ],
  company: {
    id: "company-next-manufacturing",
    name: "넥스트 제조",
    code: "DONI-NEXT-4821",
    dataReadiness: "draft"
  },
  companyUsers: [
    {
      id: "company-user-owner",
      userId: "user-owner",
      role: "owner",
      name: "박민재",
      email: "owner@next.example",
      title: "기업 소유자",
      status: "active",
      organizationCategoryId: "org-operations"
    },
    {
      id: "company-user-manager",
      userId: "user-manager",
      role: "manager",
      name: "김도현",
      email: "manager@next.example",
      title: "운영 의사결정 리드",
      status: "active",
      organizationCategoryId: "org-operations"
    }
  ],
  organizationCategories: [
    { id: UNASSIGNED_ORGANIZATION_CATEGORY_ID, name: "미지정" },
    { id: "org-operations", name: "운영" },
    { id: "org-supply", name: "공급망" }
  ],
  structureMapView: createDefaultStructureMapViewState(),
  sourceFiles: sampleSourceFiles.map((file) => ({
    ...file,
    organizationCategoryId: file.organizationCategoryId ?? UNASSIGNED_ORGANIZATION_CATEGORY_ID
  })),
  analysisJobs: [],
  evidence: sampleEvidence,
  candidates: sampleCandidates,
  managedObjectTypes: sampleManagedObjectTypes,
  workflowTypes: sampleWorkflowTypes,
  entities: sampleEntities,
  events: sampleEvents,
  relations: sampleRelations,
  metricDefinitions: sampleMetricDefinitions,
  metricValues: sampleMetricValues,
  workflowMetricBindings: sampleWorkflowMetricBindings,
  insights: sampleInsights,
  proposals: [],
  votes: [],
  decisions: [],
  verificationRecords: [],
  outcomes: [],
  auditLogs: [
    {
      id: "audit-initial",
      at: now,
      actorId: "system",
      action: "초기 운영 데이터 준비",
      targetType: "company",
      targetId: "company-next-manufacturing",
      summary: "보관 파일 기반 운영 구조와 증거 데이터를 준비했습니다."
    }
  ],
  notifications: [
    { id: "notice-ready", level: "info", message: "분석 데이터가 준비되었습니다." }
  ],
  activeCandidateType: "managed_object",
  activeInsightId: "insight-customer-claims",
  activeProposalId: ""
};
