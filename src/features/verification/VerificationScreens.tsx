"use client";

import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card, SectionTitle } from "../../components/ui/Card";
import { canCurrentUser } from "../../lib/prototype/permissions";
import { getVerificationDetailView } from "../../lib/prototype/queries/verificationQueries";
import { usePrototype } from "../../lib/prototype/PrototypeProvider";

export function VerificationListScreen() {
  const { commands, state } = usePrototype();
  const canFinalizeProposal = canCurrentUser(state, "proposal:finalize");

  return (
    <div className="space-y-8">
      <SectionTitle eyebrow="검증 기록" title="의사결정 검증 상태" />
      {state.verificationRecords.length === 0 ? (
        <Card className="space-y-4">
          <p className="text-sm text-slate-600">아직 생성된 검증 기록이 없습니다.</p>
          {canFinalizeProposal && <Button onClick={() => commands.navigate("decisionConfirm")}>결과 확정 화면으로 이동</Button>}
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {state.verificationRecords.map((record) => (
            <Card key={record.id} className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <Badge tone="success">검증 완료</Badge>
                <Badge tone={record.trustCertificationStatus === "pending" ? "warning" : "info"}>{trustStatusLabel(record.trustCertificationStatus)}</Badge>
              </div>
              <p className="font-bold text-slate-950">{record.reference}</p>
              <p className="break-all text-sm text-slate-600">{record.hash}</p>
              <Button
                variant="secondary"
                onClick={() => commands.navigateToTarget({ screen: "verificationDetail", focusId: record.id, label: "검증 상세 보기" })}
              >
                상세 보기
              </Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export function VerificationDetailScreen() {
  const { commands, state } = usePrototype();
  const { decision, history, record, timeline } = getVerificationDetailView(state);
  const canRecordOutcome = canCurrentUser(state, "outcome:record");

  if (!decision || !record) {
    return (
      <div className="space-y-8">
        <SectionTitle eyebrow="검증 기록 > 상세" title="검증할 의사결정이 없습니다" />
        <Button onClick={() => commands.navigate("proposalVote")}>의사결정으로 이동</Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <Button variant="secondary" onClick={() => commands.navigate("verification")}>목록으로 돌아가기</Button>
      <SectionTitle eyebrow="검증 기록 > 상세" title="결과 해시와 감사 흐름" />
      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <Card className="min-w-0 space-y-4">
          <Badge tone="success">검증 완료</Badge>
          <h2 className="text-xl font-bold text-slate-950">{decision.title}</h2>
          <p className="text-sm text-slate-600">결과 해시가 표준 데이터와 일치합니다. 향후 XRPL 기반 인증 결과가 이 기록 위에 누적됩니다.</p>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-md bg-slate-50 p-3">
              <p className="text-xs font-semibold text-slate-500">검증 차수</p>
              <p className="mt-2 text-lg font-bold text-slate-950">{record.revision}차</p>
            </div>
            <div className="rounded-md bg-slate-50 p-3">
              <p className="text-xs font-semibold text-slate-500">인증 상태</p>
              <p className="mt-2 text-lg font-bold text-slate-950">{trustStatusLabel(record.trustCertificationStatus)}</p>
            </div>
          </div>
          <div className="rounded-md bg-slate-50 p-3">
            <p className="text-xs font-semibold text-slate-500">해시</p>
            <p className="mt-2 break-all text-sm font-semibold text-slate-900">{record.hash}</p>
          </div>
          <div className="rounded-md bg-slate-50 p-3">
            <p className="text-xs font-semibold text-slate-500">선택 범위 해시</p>
            <p className="mt-2 break-all text-sm font-semibold text-slate-900">{record.scopeHash}</p>
          </div>
          <details className="min-w-0 overflow-hidden rounded-md border border-slate-200 p-3">
            <summary className="cursor-pointer text-sm font-semibold text-slate-800">기술 상세 보기</summary>
            <pre className="mt-3 max-h-64 min-w-0 max-w-full overflow-x-auto whitespace-pre-wrap break-words rounded-md bg-slate-950 p-3 text-xs text-slate-100">{record.canonicalJson}</pre>
          </details>
          {canRecordOutcome && <Button onClick={() => commands.recordOutcome(decision.id)}>실행 결과 기록</Button>}
        </Card>
        <Card className="min-w-0 space-y-3">
          <h2 className="text-lg font-bold text-slate-950">검증 이력</h2>
          {history.map((historyRecord) => (
            <div key={historyRecord.id} className={`rounded-md border p-3 ${historyRecord.id === record.id ? "border-blue-500 bg-blue-50" : "border-slate-200"}`}>
              <div className="flex items-center justify-between gap-3">
                <p className="font-semibold text-slate-900">{historyRecord.revision}차 검증</p>
                <Badge tone={historyRecord.status === "verified" ? "success" : "warning"}>{historyRecord.status === "verified" ? "완료" : "대기"}</Badge>
              </div>
              <p className="mt-1 break-all text-xs text-slate-500">{historyRecord.hash}</p>
            </div>
          ))}
        </Card>
        <Card className="min-w-0 space-y-3">
          <h2 className="text-lg font-bold text-slate-950">감사 흐름</h2>
          {timeline.map((log) => (
          <div key={log.id} className="rounded-md border border-slate-200 p-3">
              <div className="flex min-w-0 items-center justify-between gap-3">
                <p className="min-w-0 truncate font-semibold text-slate-900" title={log.action}>{log.action}</p>
                <span className="shrink-0 whitespace-nowrap text-xs text-slate-500">{new Date(log.at).toLocaleString("ko-KR")}</span>
              </div>
              <p className="mt-1 text-sm text-slate-600">{log.summary}</p>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}

function trustStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    certified: "인증 완료",
    failed: "인증 실패",
    not_requested: "인증 미요청",
    pending: "인증 대기"
  };

  return labels[status] ?? "인증 대기";
}

export function OutcomeScreen() {
  const { state } = usePrototype();
  const outcome = state.outcomes[0];

  return (
    <div className="space-y-8">
      <SectionTitle eyebrow="검증 기록 > 결과 재분석" title="실행 결과와 인공지능 재분석" />
      <Card className="space-y-4">
        {outcome ? (
          <>
            <Badge tone="success">재분석 완료</Badge>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-md bg-slate-50 p-4">
                <p className="text-sm text-slate-500">이전 평균 마진율</p>
                <p className="mt-2 text-3xl font-bold text-slate-950">{outcome.beforeMetricValue}%</p>
              </div>
              <div className="rounded-md bg-emerald-50 p-4">
                <p className="text-sm text-emerald-700">개선 후 평균 마진율</p>
                <p className="mt-2 text-3xl font-bold text-emerald-900">{outcome.afterMetricValue}%</p>
              </div>
            </div>
            <p className="text-sm leading-6 text-slate-600">{outcome.summary}</p>
          </>
        ) : (
          <p className="text-sm text-slate-600">아직 기록된 실행 결과가 없습니다.</p>
        )}
      </Card>
    </div>
  );
}
