export type Screen =
  | "home"
  | "login"
  | "signup"
  | "workspace"
  | "upload"
  | "analysis"
  | "review"
  | "dashboard"
  | "vault"
  | "objects"
  | "workflow"
  | "metrics"
  | "insights"
  | "insightDetail"
  | "proposalCreate"
  | "proposalVote"
  | "decisionConfirm"
  | "verification"
  | "verificationDetail"
  | "organization"
  | "settings"
  | "outcome";

export type LinkTargetScreen =
  | "workflow"
  | "metrics"
  | "objects"
  | "insights"
  | "insightDetail"
  | "proposalVote"
  | "verificationDetail";

export interface LinkTarget {
  screen: LinkTargetScreen;
  focusId?: string;
  label: string;
}

export type Role = "owner" | "manager" | "member";

export type MembershipStatus = "pending" | "active" | "rejected" | "inactive";

export type PermissionAction =
  | "workspace:select"
  | "source:upload"
  | "analysis:start"
  | "candidate:review"
  | "candidate:confirm"
  | "insight:proposal"
  | "proposal:vote"
  | "proposal:finalize"
  | "verification:create"
  | "outcome:record"
  | "admin:manage"
  | "audit:read";

export type CandidateType = "managed_object" | "workflow_event" | "relation" | "metric";
export type CandidateStatus = "needs_review" | "edited" | "confirmed" | "excluded";
export type AnalysisJobStatus = "queued" | "parsing" | "extracting" | "reviewing_ready" | "completed" | "failed";
export type InsightStatus = "new" | "reviewing" | "proposal_created" | "paused" | "resolved";
export type ProposalStatus = "draft" | "reviewing" | "voting" | "closed" | "approved" | "rejected" | "finalized" | "verified";
export type VoteChoice = "approve" | "reject" | "abstain";
export type VerificationStatus = "pending" | "verified" | "failed";
export type MetricChartType = "bar" | "line" | "time_series" | "pie" | "table";
export type VerificationMethod = "local_hash" | "xrpl_ready" | "xrpl_confirmed";
export type TrustCertificationStatus = "pending" | "certified" | "failed" | "not_requested";
export type DomainTypeScope = "managed_object" | "workflow";
export type DomainTypePresetColor = "blue" | "orange" | "pink" | "violet" | "emerald" | "slate";
export type DomainTypeColor = DomainTypePresetColor | `#${string}`;

export interface DomainTypeDefinition {
  id: string;
  scope: DomainTypeScope;
  label: string;
  color: DomainTypeColor;
}

export interface User {
  id: string;
  email?: string;
  name: string;
  role: Role;
}

export interface AuthAccount {
  email?: string;
  loginId: string;
  password: string;
  role: Role;
  userId: string;
}

export interface Workspace {
  id: string;
  name: string;
  inviteCode: string;
}

export interface WorkspaceMember {
  id: string;
  userId: string;
  workspaceId: string;
  role: Role;
  name: string;
  title: string;
  status: MembershipStatus;
}

export interface WorkspaceSession {
  loggedIn: boolean;
  currentUserId: string;
  workspaceId: string;
  role: Role;
}

export interface CompanyProfile {
  name: string;
  industry: string;
  goal: string;
  dataReadiness: "draft" | "ready";
}

export interface SourceFile {
  id: string;
  name: string;
  kind: string;
  rowCount: number;
  status: "ready" | "uploaded" | "parsed";
  uploadedAt?: string;
  size?: number;
  mimeType?: string;
  dataUrl?: string;
  textContent?: string;
  previewColumns?: string[];
  previewRows?: string[][];
}

export interface AnalysisJob {
  id: string;
  sourceFileIds: string[];
  status: AnalysisJobStatus;
  progress: number;
  currentStep: string;
  startedAt?: string;
  completedAt?: string;
}

export interface EvidenceReference {
  id: string;
  sourceFileId: string;
  sourceKind?: "vault_file" | "canonical_sample";
  analysisSourceId?: string;
  sourceName?: string;
  sheetName?: string;
  rowNumbers?: number[];
  columns?: string[];
  confidence?: number;
  label: string;
  location: string;
  excerpt: string;
}

export interface ExtractionCandidate {
  id: string;
  type: CandidateType;
  title: string;
  description: string;
  confidence: number;
  status: CandidateStatus;
  evidenceIds: string[];
  reviewerNote?: string;
  edgePreview?: {
    fromLabel: string;
    toLabel: string;
    relationType: string;
    metricLabels?: string[];
  };
}

export interface EntityInstance {
  id: string;
  kind: string;
  name: string;
  owner: string;
  status: string;
  summary: string;
  metricIds: string[];
  relationIds: string[];
  eventIds: string[];
  insightIds: string[];
  decisionIds: string[];
}

export interface EventRecord {
  id: string;
  objectId: string;
  workflowType: string;
  name: string;
  occurredAt: string;
  durationHours: number;
  evidenceIds: string[];
}

export interface Relation {
  id: string;
  fromId: string;
  toId: string;
  type: string;
  description: string;
  impact: string;
  status: string;
  evidenceIds: string[];
  confidence?: number;
  metricIds?: string[];
  relationKind?: "structural" | "causal" | "impact" | "lineage" | "supporting";
  strength?: "weak" | "medium" | "strong";
}

export interface MetricDefinition {
  id: string;
  name: string;
  unit: string;
  formula: string;
  relatedObjectIds: string[];
}

export interface MetricValue {
  id: string;
  metricId: string;
  value: number;
  previousValue: number;
  trend: "up" | "down" | "flat";
  status: "normal" | "warning" | "critical";
  chartType: MetricChartType;
  series: Array<{ label: string; value: number; observedAt?: string }>;
  calculatedAt: string;
  evidenceIds: string[];
  basis?: Record<string, number | string>;
}

export interface WorkflowMetricBinding {
  id: string;
  eventId: string;
  metricId: string;
  sourceManagedObjectIds: string[];
}

export interface AIInsight {
  id: string;
  title: string;
  status: InsightStatus;
  severity: "low" | "medium" | "high";
  detected: string;
  reason: string;
  likelyCauses: string[];
  recommendedActions: string[];
  relatedMetricIds: string[];
  relatedObjectIds: string[];
  relatedEventIds: string[];
  relatedRelationIds: string[];
  evidenceIds: string[];
  proposalId?: string;
  supportSummary?: string[];
}

export interface VotingRule {
  quorumPercent: number;
  approvalPercent: number;
  allowAbstain: boolean;
  allowVoteChange: boolean;
  tieBreakerRole: Role;
}

export interface ProposalComment {
  id: string;
  authorId: string;
  message: string;
  createdAt: string;
}

export interface Proposal {
  id: string;
  insightId: string;
  title: string;
  status: ProposalStatus;
  summary: string;
  expectedImpact: string;
  votingRule: VotingRule;
  voterUserIds: string[];
  deadline: string;
  createdAt: string;
  finalizedAt?: string;
  decisionId?: string;
  comments: ProposalComment[];
}

export interface Vote {
  id: string;
  proposalId: string;
  voterId: string;
  choice: VoteChoice;
  reason: string;
  votedAt: string;
}

export interface Decision {
  id: string;
  proposalId: string;
  title: string;
  result: "approved" | "rejected";
  finalizedAt: string;
  summary: string;
  canonicalHash?: string;
}

export interface VerificationRecord {
  id: string;
  decisionId: string;
  status: VerificationStatus;
  revision: number;
  previousVerificationId?: string;
  verificationMethod: VerificationMethod;
  trustCertificationStatus: TrustCertificationStatus;
  scopeHash: string;
  hash: string;
  canonicalJson: string;
  reference: string;
  generatedAt: string;
  verifiedAt: string;
}

export interface OutcomeRecord {
  id: string;
  decisionId: string;
  beforeMetricValue: number;
  afterMetricValue: number;
  status: "recorded" | "reanalyzed";
  summary: string;
  recordedAt: string;
}

export interface AuditLog {
  id: string;
  at: string;
  actorId: string;
  action: string;
  targetType: string;
  targetId: string;
  summary: string;
}

export interface Notification {
  id: string;
  level: "info" | "warning" | "success";
  message: string;
}

export interface WorkspaceOperationalState {
  company: CompanyProfile;
  sourceFiles: SourceFile[];
  analysisJobs: AnalysisJob[];
  evidence: EvidenceReference[];
  candidates: ExtractionCandidate[];
  managedObjectTypes: DomainTypeDefinition[];
  workflowTypes: DomainTypeDefinition[];
  entities: EntityInstance[];
  events: EventRecord[];
  relations: Relation[];
  metricDefinitions: MetricDefinition[];
  metricValues: MetricValue[];
  workflowMetricBindings: WorkflowMetricBinding[];
  insights: AIInsight[];
  proposals: Proposal[];
  votes: Vote[];
  decisions: Decision[];
  verificationRecords: VerificationRecord[];
  outcomes: OutcomeRecord[];
  auditLogs: AuditLog[];
  notifications: Notification[];
  activeCandidateType: CandidateType;
  activeInsightId: string;
  activeProposalId: string;
  selection?: SelectionProfile;
  scope?: SelectionScope;
}

export interface SelectionProfile {
  selectedCandidateIds: string[];
  excludedCandidateIds: string[];
  selectedManagedCandidateIds: string[];
  primaryManagedCandidateId?: string;
  managedCandidateId?: string;
  workflowCandidateIds: string[];
  relationCandidateIds: string[];
  metricCandidateIds: string[];
  scenarioIds: string[];
  scenarioId?: string;
}

export interface SelectionScope {
  selectedManagedCandidateIds: string[];
  includedWorkflowCandidateIds: string[];
  includedRelationCandidateIds: string[];
  includedMetricCandidateIds: string[];
  manuallyExcludedCandidateIds: string[];
  candidateProvenance: Record<string, string[]>;
}

export interface WorkspaceResultBundle {
  selection: SelectionProfile;
  scope: SelectionScope;
  entities: EntityInstance[];
  events: EventRecord[];
  relations: Relation[];
  metricDefinitions: MetricDefinition[];
  metricValues: MetricValue[];
  workflowMetricBindings: WorkflowMetricBinding[];
  insights: AIInsight[];
  proposals: Proposal[];
  decisions: Decision[];
  verificationRecords: VerificationRecord[];
}

export interface PrototypeState {
  screen: Screen;
  session: WorkspaceSession;
  authAccounts: AuthAccount[];
  users: User[];
  workspaces: Workspace[];
  members: WorkspaceMember[];
  workspaceDataById: Record<string, WorkspaceOperationalState>;
  company: CompanyProfile;
  sourceFiles: SourceFile[];
  analysisJobs: AnalysisJob[];
  evidence: EvidenceReference[];
  candidates: ExtractionCandidate[];
  managedObjectTypes: DomainTypeDefinition[];
  workflowTypes: DomainTypeDefinition[];
  entities: EntityInstance[];
  events: EventRecord[];
  relations: Relation[];
  metricDefinitions: MetricDefinition[];
  metricValues: MetricValue[];
  workflowMetricBindings: WorkflowMetricBinding[];
  insights: AIInsight[];
  proposals: Proposal[];
  votes: Vote[];
  decisions: Decision[];
  verificationRecords: VerificationRecord[];
  outcomes: OutcomeRecord[];
  auditLogs: AuditLog[];
  notifications: Notification[];
  activeCandidateType: CandidateType;
  activeInsightId: string;
  activeProposalId: string;
  selection?: SelectionProfile;
  scope?: SelectionScope;
  navigationFocus?: LinkTarget;
  permissionDenied?: string;
  simulatedError?: string;
}
