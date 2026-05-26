import type { Proposal, Vote, VoteChoice } from "../domain/types";

export interface VoteSummary {
  approve: number;
  reject: number;
  abstain: number;
  totalVotes: number;
  eligibleCount: number;
  participationPercent: number;
  approvalPercent: number;
  quorumSatisfied: boolean;
  approvalSatisfied: boolean;
  tied: boolean;
  passed: boolean;
}

const choices: VoteChoice[] = ["approve", "reject", "abstain"];

export function summarizeVotes(proposal: Proposal, votes: Vote[]): VoteSummary {
  const eligibleVotes = votes.filter(
    (vote) => vote.proposalId === proposal.id && proposal.voterUserIds.includes(vote.voterId)
  );

  const latestByVoter = new Map<string, Vote>();
  for (const vote of eligibleVotes) {
    latestByVoter.set(vote.voterId, vote);
  }

  const counts = Object.fromEntries(choices.map((choice) => [choice, 0])) as Record<VoteChoice, number>;
  for (const vote of latestByVoter.values()) {
    counts[vote.choice] += 1;
  }

  const totalVotes = latestByVoter.size;
  const eligibleCount = proposal.voterUserIds.length;
  const participationPercent = eligibleCount === 0 ? 0 : (totalVotes / eligibleCount) * 100;
  const decisiveVotes = counts.approve + counts.reject;
  const approvalPercent = totalVotes === 0 ? 0 : (counts.approve / totalVotes) * 100;
  const quorumSatisfied = participationPercent >= proposal.votingRule.quorumPercent;
  const approvalSatisfied = approvalPercent >= proposal.votingRule.approvalPercent;
  const tied = counts.approve === counts.reject && decisiveVotes > 0;

  return {
    approve: counts.approve,
    reject: counts.reject,
    abstain: counts.abstain,
    totalVotes,
    eligibleCount,
    participationPercent,
    approvalPercent,
    quorumSatisfied,
    approvalSatisfied,
    tied,
    passed: quorumSatisfied && approvalSatisfied && !tied
  };
}
