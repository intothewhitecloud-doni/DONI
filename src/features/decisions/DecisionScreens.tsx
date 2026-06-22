"use client";

import { useMemo, useState } from "react";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card, SectionTitle } from "../../components/ui/Card";
import type { ActorSnapshot, Proposal, VoteChoice } from "../../lib/domain/types";
import { summarizeVotes } from "../../lib/policies/voting";
import { canCurrentUser, roleLabel } from "../../lib/prototype/permissions";
import { activeCompanyUserForUser, canOpenProposalDetail, proposalStatusLabel } from "../../lib/prototype/policy";
import { activeProposal, currentCompanyData, latestDecision } from "../../lib/prototype/selectors";
import { usePrototype } from "../../lib/prototype/PrototypeProvider";

const choiceLabels: Record<VoteChoice, string> = {
  approve: "승인",
  reject: "반려",
  abstain: "기권"
};

function actorNameFromSnapshot(snapshot: ActorSnapshot | undefined, fallbackName: string | undefined): string {
  return snapshot?.name ?? fallbackName ?? "삭제된 사용자";
}

function actorDetailFromSnapshot(snapshot: ActorSnapshot | undefined, fallbackTitle: string | undefined): string {
  if (fallbackTitle?.trim()) {
    return fallbackTitle.trim();
  }
  if (snapshot) {
    const snapshotRoleLabel = snapshot.role === "owner" || snapshot.role === "manager" ? roleLabel(snapshot.role) : snapshot.role;
    return `${snapshotRoleLabel} · 기록 스냅샷`;
  }
  return "미지정";
}

export function ProposalVoteScreen() {
  const { commands, state } = usePrototype();
  const proposal = activeProposal(state);
  const proposals = currentCompanyData(state).proposals;
  const currentCompanyUser = activeCompanyUserForUser(state, state.session.currentUserId);
  const canOpenDetail = canOpenProposalDetail(currentCompanyUser);
  const canFinalizeProposal = canCurrentUser(state, "proposal:finalize");
  const canVoteProposal = canCurrentUser(state, "proposal:vote");
  const [choice, setChoice] = useState<VoteChoice>("approve");
  const summary = useMemo(() => (proposal ? summarizeVotes(proposal, state.votes) : undefined), [proposal, state.votes]);
  const currentUserVote = proposal
    ? state.votes.find((vote) => vote.proposalId === proposal.id && vote.voterId === state.session.currentUserId)
    : undefined;

  if (proposals.length === 0) {
    return (
      <div className="space-y-8">
        <SectionTitle title="의사결정" />
        <Button onClick={() => commands.navigate("dashboard")}>대시보드로 이동</Button>
      </div>
    );
  }

  if (!proposal || !canOpenDetail) {
    return <ProposalList proposals={proposals} canOpenDetail={canOpenDetail} />;
  }

  return (
    <div className="space-y-8">
      <Button variant="secondary" onClick={() => commands.navigate("proposalVote")}>목록으로 돌아가기</Button>
      <SectionTitle title="의사결정" />
      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <Card className="space-y-5">
          <p className="text-sm leading-6 text-slate-600">{proposal.summary}</p>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <VoteStat label="승인" value={summary?.approve ?? 0} tone="success" />
            <VoteStat label="반려" value={summary?.reject ?? 0} tone="danger" />
            <VoteStat label="기권" value={summary?.abstain ?? 0} tone="neutral" />
            <VoteStat label="참여율" value={`${Math.round(summary?.participationPercent ?? 0)}%`} tone="info" />
          </div>
          <div className="rounded-md bg-slate-50 p-4 text-sm leading-6 text-slate-600">
            정족수 {proposal.votingRule.quorumPercent}% 이상, 승인율 {proposal.votingRule.approvalPercent}% 이상이면 통과됩니다.
            동률이면 {roleLabel(proposal.votingRule.tieBreakerRole)}가 조정합니다.
          </div>
          <div className="rounded-md border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
            현재 내 투표 상태: {currentUserVote ? `${choiceLabels[currentUserVote.choice]} · ${currentUserVote.reason}` : "아직 참여하지 않음"}
          </div>
          {canVoteProposal && (
            <>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(choiceLabels) as VoteChoice[]).map((item) => (
                  <Button key={item} variant={choice === item ? "primary" : "secondary"} onClick={() => setChoice(item)}>
                    {choiceLabels[item]}
                  </Button>
                ))}
              </div>
              <div className="flex flex-wrap gap-3">
                <Button onClick={() => commands.castVote(proposal.id, choice, "현재 사용자의 검토 의견입니다.")}>투표 반영</Button>
                {canFinalizeProposal && <Button variant="secondary" onClick={() => commands.finalizeProposal(proposal.id)}>결과 확정</Button>}
              </div>
            </>
          )}
        </Card>
        <Card className="space-y-4">
          <h2 className="text-lg font-bold text-slate-950">참여 구성원</h2>
          {proposal.voterUserIds.map((userId, index) => {
            const user = state.users.find((item) => item.id === userId);
            const companyUser = activeCompanyUserForUser(state, userId);
            const vote = state.votes.find((item) => item.proposalId === proposal.id && item.voterId === userId);
            const voterSnapshot =
              proposal.voterSnapshots?.find((snapshot) => snapshot.userId === userId) ?? proposal.voterSnapshots?.[index];
            return (
              <div key={userId} className="flex min-w-0 items-center justify-between gap-3 rounded-md border border-slate-200 p-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-900">{actorNameFromSnapshot(voterSnapshot, user?.name)}</p>
                  <p className="truncate text-xs text-slate-500">{actorDetailFromSnapshot(voterSnapshot, companyUser?.title)}</p>
                </div>
                <Badge tone={vote ? "success" : "neutral"}>{vote ? choiceLabels[vote.choice] : "대기"}</Badge>
              </div>
            );
          })}
          <div className="pt-3">
            <h3 className="font-bold text-slate-950">검토 의견</h3>
            <div className="mt-3 space-y-2">
              {proposal.comments.map((comment) => {
                const author = state.users.find((user) => user.id === comment.authorId);
                return (
                  <div key={comment.id} className="rounded-md border border-slate-200 bg-slate-50 p-3">
                    <p className="text-sm font-semibold text-slate-900">
                      {actorNameFromSnapshot(comment.authorSnapshot, author?.name)}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-slate-600">{comment.message}</p>
                  </div>
                );
              })}
              {state.votes
                .filter((vote) => vote.proposalId === proposal.id)
                .map((vote) => {
                  const voter = state.users.find((user) => user.id === vote.voterId);
                  return (
                    <div key={`${vote.id}-opinion`} className="rounded-md border border-slate-200 p-3">
                      <p className="text-sm font-semibold text-slate-900">
                        {actorNameFromSnapshot(vote.voterSnapshot, voter?.name)} · {choiceLabels[vote.choice]}
                      </p>
                      <p className="mt-1 text-sm leading-6 text-slate-600">{vote.reason}</p>
                    </div>
                  );
                })}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

function ProposalList({ canOpenDetail, proposals }: { canOpenDetail: boolean; proposals: Proposal[] }) {
  const { commands, state } = usePrototype();

  return (
    <div className="space-y-8">
      <SectionTitle title="의사결정" />
      {!canOpenDetail && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-900">
          상세 권한이 없어 안건 목록과 내 투표 상태만 조회할 수 있습니다.
        </div>
      )}
      <div className="grid gap-4">
        {proposals.map((proposal) => {
          const summary = summarizeVotes(proposal, state.votes);
          const insight = state.insights.find((item) => item.id === proposal.insightId);
          const currentUserVote = state.votes.find((vote) => vote.proposalId === proposal.id && vote.voterId === state.session.currentUserId);
          return (
            <Card key={proposal.id} className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <Badge tone={proposal.status === "approved" || proposal.status === "finalized" ? "success" : proposal.status === "rejected" ? "danger" : "info"}>
                    {proposalStatusLabel(proposal.status)}
                  </Badge>
                  <h2 className="mt-3 text-xl font-bold text-slate-950">{proposal.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{proposal.summary}</p>
                </div>
                {canOpenDetail && (
                  <Button onClick={() => commands.navigateToTarget({ screen: "proposalVote", focusId: proposal.id, label: proposal.title })}>
                    상세 보기
                  </Button>
                )}
              </div>
              {canOpenDetail && (
                <>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <VoteStat label="승인" value={summary.approve} tone="success" />
                    <VoteStat label="반려" value={summary.reject} tone="danger" />
                    <VoteStat label="기권" value={summary.abstain} tone="neutral" />
                    <VoteStat label="참여율" value={`${Math.round(summary.participationPercent)}%`} tone="info" />
                  </div>
                  <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs font-bold text-slate-500">출처 인사이트</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">{insight?.title ?? proposal.insightId}</p>
                  </div>
                </>
              )}
              <div className="rounded-md border border-blue-200 bg-blue-50 p-3">
                <p className="text-xs font-bold text-blue-700">현재 내 투표 상태</p>
                <p className="mt-1 text-sm font-semibold text-blue-950">
                  {currentUserVote ? `${choiceLabels[currentUserVote.choice]} · ${currentUserVote.reason}` : "참여 기록 없음"}
                </p>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

export function DecisionConfirmScreen() {
  const { commands, state } = usePrototype();
  const decision = latestDecision(state);
  const canCreateVerification = canCurrentUser(state, "verification:create");

  if (!decision) {
    return (
      <div className="space-y-8">
        <SectionTitle title="의사결정" />
        <Button onClick={() => commands.navigate("proposalVote")}>투표로 이동</Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <SectionTitle title="의사결정" />
      <Card className="space-y-4">
        <Badge tone="success">최종 확정</Badge>
        <p className="text-sm leading-6 text-slate-600">{decision.summary}</p>
        <p className="text-sm text-slate-600">확정 시각 {new Date(decision.finalizedAt).toLocaleString("ko-KR")}</p>
        {canCreateVerification && <Button onClick={() => commands.generateVerificationRecord(decision.id)}>검증 기록 생성</Button>}
      </Card>
    </div>
  );
}

function VoteStat({ label, value, tone }: { label: string; value: string | number; tone: "success" | "danger" | "neutral" | "info" }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-4">
      <Badge tone={tone}>{label}</Badge>
      <p className="mt-3 text-2xl font-bold text-slate-950">{value}</p>
    </div>
  );
}
