import {
  sampleCandidates,
  sampleEntities,
  sampleEvents,
  sampleEvidence,
  sampleInsights,
  sampleMetricDefinitions,
  sampleMetricValues,
  sampleRelations,
  sampleSourceFiles,
  sampleWorkflowMetricBindings
} from "./sample-analysis";
import type { PrototypeState } from "./types";

const now = "2026-05-07T09:00:00.000Z";

export const initialPrototypeState: PrototypeState = {
  screen: "login",
  session: {
    loggedIn: false,
    currentUserId: "user-manager",
    workspaceId: "workspace-next-manufacturing",
    role: "manager"
  },
  users: [
    { id: "user-admin", name: "박민재", title: "전략기획 관리자", role: "admin" },
    { id: "user-manager", name: "김도현", title: "운영 의사결정 리드", role: "manager" },
    { id: "user-member", name: "이하린", title: "공급망 담당", role: "member" }
  ],
  workspaces: [
    {
      id: "workspace-next-manufacturing",
      name: "넥스트 제조 그룹",
      industry: "제조 및 유통",
      decisionGoal: "저마진 상품을 줄이고 공급망 지연 리스크를 조기에 발견",
      inviteCode: "DONI-NEXT-4821"
    },
    {
      id: "workspace-health-supply",
      name: "헬스케어 공급 협의체",
      industry: "의료 공급망",
      decisionGoal: "긴급 납품 지연과 재고 부족을 사전에 파악",
      inviteCode: "DONI-HEALTH-9174"
    }
  ],
  members: [
    {
      id: "member-admin",
      userId: "user-admin",
      workspaceId: "workspace-next-manufacturing",
      role: "admin",
      name: "박민재",
      title: "전략기획 관리자",
      eligibleVoter: true,
      status: "active"
    },
    {
      id: "member-manager",
      userId: "user-manager",
      workspaceId: "workspace-next-manufacturing",
      role: "manager",
      name: "김도현",
      title: "운영 의사결정 리드",
      eligibleVoter: true,
      status: "active"
    },
    {
      id: "member-member",
      userId: "user-member",
      workspaceId: "workspace-next-manufacturing",
      role: "member",
      name: "이하린",
      title: "공급망 담당",
      eligibleVoter: true,
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
