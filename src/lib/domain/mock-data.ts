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
import { demoAccounts } from "./auth-fixtures";

const now = "2026-05-07T09:00:00.000Z";

export const initialPrototypeState: PrototypeState = {
  screen: "login",
  session: {
    loggedIn: false,
    currentUserId: "user-manager",
    workspaceId: "workspace-next-manufacturing",
    role: "manager"
  },
  authAccounts: demoAccounts,
  users: [
    { email: "owner@next.example", id: "user-admin", name: "박민재", role: "owner" },
    { email: "manager@next.example", id: "user-manager", name: "김도현", role: "manager" },
    { email: "member@next.example", id: "user-member", name: "이하린", role: "member" }
  ],
  workspaces: [
    {
      id: "workspace-next-manufacturing",
      name: "넥스트 제조 그룹",
      inviteCode: "DONI-NEXT-4821"
    },
    {
      id: "workspace-health-supply",
      name: "헬스케어 공급 협의체",
      inviteCode: "DONI-HEALTH-9174"
    }
  ],
  members: [
    {
      id: "member-admin",
      userId: "user-admin",
      workspaceId: "workspace-next-manufacturing",
      role: "owner",
      name: "박민재",
      title: "워크스페이스 소유자",
      status: "active"
    },
    {
      id: "member-manager",
      userId: "user-manager",
      workspaceId: "workspace-next-manufacturing",
      role: "manager",
      name: "김도현",
      title: "운영 의사결정 리드",
      status: "active"
    },
    {
      id: "member-member",
      userId: "user-member",
      workspaceId: "workspace-next-manufacturing",
      role: "member",
      name: "이하린",
      title: "공급망 담당",
      status: "active"
    }
  ],
  workspaceDataById: {},
  company: {
    name: "넥스트 제조 그룹",
    industry: "제조 및 유통",
    goal: "저마진 상품을 줄이고 공급망 지연 리스크를 조기에 발견",
    dataReadiness: "draft"
  },
  sourceFiles: sampleSourceFiles,
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
      targetType: "workspace",
      targetId: "workspace-next-manufacturing",
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
