import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Badge, type BadgeTone } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import type { EvidenceReference, OrganizationCategory, SourceFile } from "../../lib/domain/types";
import { UNASSIGNED_ORGANIZATION_CATEGORY_ID } from "../../lib/domain/types";
import {
  findPhaseOneFileProjection,
  type PhaseOneAnalysisProjection,
  type PhaseOneApplyStatus,
  type PhaseOneFileProjection,
  type PhaseOneSignal,
  type PhaseOneStructureGroup,
  type PhaseOneStructureItem
} from "../../lib/prototype/queries/phaseOneAnalysisProjection";
import { deriveSourceFileRenderType } from "../../lib/prototype/sourceFiles";
import {
  createUploadedFileRevisionFixture,
  getDataVaultRevisionFixture,
  getVaultCorrectionItem,
  getVaultCurrentDataItem,
  getVaultDraftItem,
  vaultCorrectionItems,
  vaultCurrentDataItems,
  vaultDraftItems,
  vaultStageTabs,
  type VaultCorrectionItem,
  type VaultCurrentDataItem,
  type VaultDraftItem,
  type VaultImpactItem,
  type VaultRevisionFixture,
  type VaultTabId
} from "./dataVaultRevisionFixtures";
import {
  formatEvidenceSource,
  sourceFileListSummary,
  SourceFilePreviewPanel
} from "./SourceFilePreviewPanel";

type EditingFileDraft = {
  description: string;
  kind: string;
  name: string;
  organizationCategoryId: string;
};

type LocalApplyStatus = "idle" | PhaseOneApplyStatus;

type DataVaultRevisionWorkbenchProps = {
  activeFile?: SourceFile;
  activeTab: VaultTabId;
  allSourceFiles: SourceFile[];
  canManageFiles: boolean;
  canonicalEvidence: EvidenceReference[];
  editingFile: EditingFileDraft;
  fileEvidence: EvidenceReference[];
  fileFeedback: string;
  organizationCategories: OrganizationCategory[];
  phaseOneProjection: PhaseOneAnalysisProjection;
  selectedOrganizationCategoryId: string;
  sourceFiles: SourceFile[];
  sourceFileKindOptions: string[];
  onChangeEditingFile: (draft: EditingFileDraft) => void;
  onDownloadFile: (file: SourceFile) => void;
  onRemoveFile: (fileId: string) => void;
  onSaveFileInfo: () => void;
  onSelectFile: (fileId: string) => void;
  onSelectOrganizationCategory: (categoryId: string) => void;
  onSelectTab: (tab: VaultTabId) => void;
};

const stageColumnClass: Record<VaultTabId, string> = {
  source: "bg-amber-50 text-slate-900",
  draft: "bg-blue-50 text-blue-900",
  correction: "bg-orange-50 text-orange-900",
  current: "bg-emerald-50 text-emerald-900"
};

export function DataVaultRevisionWorkbench({
  activeFile,
  activeTab,
  allSourceFiles,
  canManageFiles,
  canonicalEvidence,
  editingFile,
  fileEvidence,
  fileFeedback,
  organizationCategories,
  phaseOneProjection,
  selectedOrganizationCategoryId,
  sourceFiles,
  sourceFileKindOptions,
  onChangeEditingFile,
  onDownloadFile,
  onRemoveFile,
  onSaveFileInfo,
  onSelectFile,
  onSelectOrganizationCategory,
  onSelectTab
}: DataVaultRevisionWorkbenchProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeDraftId, setActiveDraftId] = useState(vaultDraftItems[0]?.id ?? "");
  const [activeCorrectionId, setActiveCorrectionId] = useState(vaultCorrectionItems[0]?.id ?? "");
  const [activeCurrentDataId, setActiveCurrentDataId] = useState(vaultCurrentDataItems[0]?.id ?? "");
  const [localApplyStatusByFileId, setLocalApplyStatusByFileId] = useState<Record<string, LocalApplyStatus>>({});
  const localApplyTimers = useRef<number[]>([]);
  const fixture = useMemo(
    () => activeFile ? getDataVaultRevisionFixture(activeFile.id) ?? createUploadedFileRevisionFixture(activeFile) : undefined,
    [activeFile]
  );
  const fileProjection = findPhaseOneFileProjection(phaseOneProjection, activeFile?.id);
  const localApplyStatus = activeFile ? localApplyStatusByFileId[activeFile.id] : undefined;
  const effectiveApplyStatus = applyStatusForFile(activeFile, localApplyStatus);
  const activeDraft = getVaultDraftItem(activeDraftId) ?? vaultDraftItems[0];
  const activeCorrection = getVaultCorrectionItem(activeCorrectionId) ?? vaultCorrectionItems[0];
  const activeCurrentData = getVaultCurrentDataItem(activeCurrentDataId) ?? vaultCurrentDataItems[0];
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredFiles = useMemo(
    () =>
      normalizedQuery
        ? sourceFiles.filter((file) => `${file.name} ${file.kind}`.toLowerCase().includes(normalizedQuery))
        : sourceFiles,
    [normalizedQuery, sourceFiles]
  );
  const selectedCategoryName =
    organizationCategories.find((category) => category.id === selectedOrganizationCategoryId)?.name ?? "미지정";
  const activeFileOrganizationName =
    organizationCategories.find((category) => category.id === (activeFile?.organizationCategoryId ?? UNASSIGNED_ORGANIZATION_CATEGORY_ID))?.name ?? "미지정";
  const matchedEvidence = fixture ? canonicalEvidence.filter((evidence) => fixture.evidenceIds.includes(evidence.id)) : [];

  useEffect(() => () => {
    localApplyTimers.current.forEach((timer) => window.clearTimeout(timer));
    localApplyTimers.current = [];
  }, []);

  function handleStartLocalApplyStatus() {
    if (!activeFile) {
      return;
    }

    const fileId = activeFile.id;
    const currentStatus = applyStatusForFile(activeFile, localApplyStatusByFileId[fileId]);

    if (currentStatus !== "idle") {
      return;
    }

    setLocalApplyStatusByFileId((current) => ({ ...current, [fileId]: "pending" }));
    const analyzingTimer = window.setTimeout(() => {
      setLocalApplyStatusByFileId((current) => ({ ...current, [fileId]: current[fileId] === "pending" ? "analyzing" : current[fileId] }));
    }, 1000);
    const appliedTimer = window.setTimeout(() => {
      setLocalApplyStatusByFileId((current) => ({ ...current, [fileId]: current[fileId] === "analyzing" ? "applied" : current[fileId] }));
    }, 3000);

    localApplyTimers.current = [...localApplyTimers.current, analyzingTimer, appliedTimer];
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 overflow-x-auto border-b border-slate-200" role="tablist" aria-label="데이터 보관함 화면 탭">
        {vaultStageTabs.map((tab) => (
          <button
            key={tab.id}
            aria-selected={activeTab === tab.id}
            className={`min-w-max border-b-2 px-4 py-3 text-left transition ${
              activeTab === tab.id
                ? "border-blue-600 text-blue-700"
                : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-900"
            }`}
            role="tab"
            type="button"
            onClick={() => onSelectTab(tab.id)}
          >
            <span className="block text-sm font-bold">{tab.label}</span>
            <span className="mt-1 block text-xs">{tab.helper}</span>
          </button>
        ))}
      </div>

      {fileFeedback && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">
          {fileFeedback}
        </div>
      )}

      <div className="grid min-w-0 items-start gap-4 xl:grid-cols-[minmax(220px,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(260px,1fr)] 2xl:grid-cols-[minmax(240px,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(280px,1fr)]">
        {activeTab === "source" ? (
          <Card className="min-w-0 space-y-4" density="compact">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase text-blue-600">원천 파일</p>
                <h2 className="mt-1 text-lg font-bold text-slate-950">보관 파일</h2>
              </div>
              <Badge tone={sourceFiles.length > 0 ? "info" : "neutral"}>{sourceFiles.length}개</Badge>
            </div>

            <label className="block">
              <span className="sr-only">데이터 검색</span>
              <input
                className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                placeholder="데이터 검색"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
            </label>

            <div className="flex gap-2 overflow-x-auto pb-1">
              {organizationCategories.map((category) => {
                const count = allSourceFiles.filter(
                  (file) => (file.organizationCategoryId ?? UNASSIGNED_ORGANIZATION_CATEGORY_ID) === category.id
                ).length;
                return (
                  <button
                    key={category.id}
                    className={`min-w-max rounded-md border px-3 py-2 text-xs font-bold transition ${
                      selectedOrganizationCategoryId === category.id
                        ? "border-blue-500 bg-blue-50 text-blue-700"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                    type="button"
                    onClick={() => onSelectOrganizationCategory(category.id)}
                  >
                    {category.name} · {count}
                  </button>
                );
              })}
            </div>

            <div className="space-y-2">
              {filteredFiles.length === 0 ? (
                <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-4">
                  <p className="font-semibold text-slate-900">조회할 파일이 없습니다</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{selectedCategoryName} 분류를 보려면 파일 추가 또는 검색어 조정이 필요합니다.</p>
                </div>
              ) : (
                filteredFiles.map((file) => (
                  <button
                    key={file.id}
                    className={`w-full rounded-md border p-3 text-left transition ${
                      activeFile?.id === file.id ? "border-blue-500 bg-blue-50 shadow-sm" : "border-slate-200 bg-white hover:bg-slate-50"
                    }`}
                    type="button"
                    onClick={() => onSelectFile(file.id)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-slate-950" title={file.name}>{file.name}</p>
                        <p className="mt-1 truncate text-xs text-slate-600">{sourceFileListSummary(file)}</p>
                        <p className="mt-2 text-xs text-slate-500">
                          {file.uploadedAt ? new Date(file.uploadedAt).toLocaleString("ko-KR") : "등록 시간 없음"}
                        </p>
                      </div>
                      <Badge tone={sourceStatusTone(file, localApplyStatusByFileId[file.id])}>
                        {fileStatusLabel(file, localApplyStatusByFileId[file.id])}
                      </Badge>
                    </div>
                  </button>
                ))
              )}
            </div>
          </Card>
        ) : activeTab === "draft" ? (
          <StageListPanel
            activeId={activeDraft?.id}
            badge={`${vaultDraftItems.length}건`}
            description="업로드된 원천 파일 전체에서 추정한 AI 구조 초안을 샘플로 보여줍니다."
            eyebrow="AI 초안"
            items={vaultDraftItems}
            title="AI 초안 목록"
            onSelect={setActiveDraftId}
          />
        ) : activeTab === "correction" ? (
          <StageListPanel
            activeId={activeCorrection?.id}
            badge={`${vaultCorrectionItems.length}건`}
            description="사용자가 보정한 필드와 기준값 변경 흐름을 샘플로 보여줍니다."
            eyebrow="보정 기록"
            items={vaultCorrectionItems}
            title="보정 항목 목록"
            onSelect={setActiveCorrectionId}
          />
        ) : (
          <StageListPanel
            activeId={activeCurrentData?.id}
            badge={`${vaultCurrentDataItems.length}건`}
            description="현재 기준에 반영 대기 중인 기준 데이터 샘플 목록입니다."
            eyebrow="현재 기준"
            items={vaultCurrentDataItems}
            title="기준 데이터 목록"
            onSelect={setActiveCurrentDataId}
          />
        )}

        {activeTab === "source" ? (
          <div className="min-w-0 space-y-4 xl:col-span-2">
          <Card className="min-w-0 space-y-4" density="compact">
            {activeFile && fixture ? (
              <>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={sourceStatusTone(activeFile, effectiveApplyStatus)}>{fileStatusLabel(activeFile, effectiveApplyStatus)}</Badge>
                      <Badge tone="neutral">{fixture.statusLabel}</Badge>
                      <span className="text-xs font-semibold text-slate-500">
                        {fixture.updatedAt}
                      </span>
                    </div>
                    <h2 className="mt-3 truncate text-xl font-bold text-slate-950" title={activeFile.name}>{activeFile.name}</h2>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      {fixture.impactSummary}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button className="h-9 px-3" variant="secondary" onClick={() => onDownloadFile(activeFile)}>
                      다운로드
                    </Button>
                    {canManageFiles && (
                      <Button className="h-9 px-3" variant="danger" onClick={() => onRemoveFile(activeFile.id)}>
                        제거
                      </Button>
                    )}
                  </div>
                </div>

                <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase text-blue-600">기본 정보</p>
                      <h3 className="mt-1 text-lg font-bold text-slate-950">데이터 상세</h3>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge tone="neutral">{activeFileOrganizationName}</Badge>
                      {activeFile.appliedAt && <Badge tone="success">현재 기준 반영됨</Badge>}
                    </div>
                  </div>

                  {canManageFiles ? (
                    <div className="mt-3 space-y-3">
                      <label className="block min-w-0 space-y-1">
                        <span className="text-xs font-bold text-slate-500">데이터명</span>
                        <input
                          className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900"
                          value={editingFile.name}
                          onChange={(event) => onChangeEditingFile({ ...editingFile, name: event.target.value })}
                        />
                      </label>
                      <div className="grid gap-3 md:grid-cols-2">
                        <label className="min-w-0 space-y-1">
                          <span className="text-xs font-bold text-slate-500">데이터 유형</span>
                          <select
                            className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900"
                            value={editingFile.kind}
                            onChange={(event) => onChangeEditingFile({ ...editingFile, kind: event.target.value })}
                          >
                            {sourceFileKindOptions.map((kind) => (
                              <option key={kind} value={kind}>{kind}</option>
                            ))}
                          </select>
                        </label>
                        <label className="min-w-0 space-y-1">
                          <span className="text-xs font-bold text-slate-500">담당 부서(조직)</span>
                          <select
                            className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900"
                            value={editingFile.organizationCategoryId}
                            onChange={(event) => onChangeEditingFile({ ...editingFile, organizationCategoryId: event.target.value })}
                          >
                            {organizationCategories.map((category) => (
                              <option key={category.id} value={category.id}>{category.name}</option>
                            ))}
                          </select>
                        </label>
                      </div>
                      <label className="block min-w-0 space-y-1">
                        <span className="text-xs font-bold text-slate-500">설명</span>
                        <textarea
                          className="min-h-20 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm leading-6 text-slate-900"
                          placeholder="데이터에 대한 설명을 입력하세요"
                          value={editingFile.description}
                          onChange={(event) => onChangeEditingFile({ ...editingFile, description: event.target.value })}
                        />
                      </label>
                      <div className="flex justify-end border-t border-slate-200 pt-3">
                        <Button className="h-10 px-4" variant="secondary" onClick={onSaveFileInfo}>
                          정보 저장
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <ReadOnlyFileInfo description={activeFile.description} file={activeFile} organizationName={activeFileOrganizationName} />
                  )}
                </div>

                {fileProjection && (
                  <ApplyStatusPanel
                    fileProjection={fileProjection}
                    localStatus={effectiveApplyStatus}
                    onStart={handleStartLocalApplyStatus}
                  />
                )}

                <div className="grid gap-3 md:grid-cols-2">
                  <SummaryPanel
                    title="포함된 주요 필드"
                    items={(fileProjection?.majorFields.length ? fileProjection.majorFields : fixture.fields)
                      .map((field) => ({ label: "필드", value: field, detail: "원천값 기준", tone: "neutral" }))}
                  />
                  <SummaryPanel title="영향 요약" items={[...fixture.affected, ...fixture.metrics].slice(0, 4)} />
                </div>

                {fileProjection && (
                  <StructureCandidatePanel groups={fileProjection.structureGroups} />
                )}

                <div className="space-y-3 rounded-md border border-slate-200 bg-slate-50/70 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase text-blue-600">출처 데이터</p>
                      <h3 className="mt-1 text-lg font-bold text-slate-950">파일 미리보기</h3>
                    </div>
                    <Badge tone="neutral">{fixture.owner}</Badge>
                  </div>
                  <SourceFilePreviewPanel file={activeFile} renderType={deriveSourceFileRenderType(activeFile)} />
                </div>
              </>
            ) : (
              <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-5">
                <p className="font-semibold text-slate-900">조회할 파일을 선택하세요</p>
              </div>
            )}
          </Card>

          {activeFile && fixture ? (
            <Card className="min-w-0 space-y-3" density="compact">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase text-blue-600">변화 비교</p>
                  <h3 className="mt-1 text-lg font-bold text-slate-950">원천 / 초안 / 보정 / 현재 기준</h3>
                </div>
                <Badge tone="warning">샘플 흐름</Badge>
              </div>

              <div className="overflow-x-auto rounded-md border border-slate-200">
                <table className="min-w-[760px] w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs font-bold text-slate-500">
                    <tr>
                      <th className="px-3 py-2">필드</th>
                      <StageHeader stage="source" activeStage={activeTab}>원천 기록</StageHeader>
                      <StageHeader stage="draft" activeStage={activeTab}>AI 구조 초안</StageHeader>
                      <StageHeader stage="correction" activeStage={activeTab}>보정 기록</StageHeader>
                      <StageHeader stage="current" activeStage={activeTab}>현재 기준 데이터</StageHeader>
                      <th className="px-3 py-2">비고</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {fixture.revisionRows.map((row) => (
                      <tr key={row.field}>
                        <td className="whitespace-nowrap px-3 py-2 font-bold text-slate-900">{row.field}</td>
                        <StageCell stage="source" activeStage={activeTab}>{row.source}</StageCell>
                        <StageCell stage="draft" activeStage={activeTab}>{row.draft}</StageCell>
                        <StageCell stage="correction" activeStage={activeTab}>{row.correction}</StageCell>
                        <StageCell stage="current" activeStage={activeTab}>{row.current}</StageCell>
                        <td className="whitespace-nowrap px-3 py-2 text-slate-600">{row.note}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          ) : (
            <Card className="min-w-0 space-y-3" density="compact">
              <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-5">
                <p className="font-semibold text-slate-900">조회할 파일을 선택하세요</p>
              </div>
            </Card>
          )}
          </div>
        ) : activeTab === "draft" && activeDraft ? (
          <DraftDetailPanel item={activeDraft} />
        ) : activeTab === "correction" && activeCorrection ? (
          <CorrectionDetailPanel item={activeCorrection} />
        ) : activeCurrentData ? (
          <CurrentDataDetailPanel item={activeCurrentData} />
        ) : (
          <EmptyDetailPanel />
        )}

        {activeTab === "source" ? (
          <SourceRightRail
            decisionCandidates={phaseOneProjection.decisionCandidates}
            evidence={[...matchedEvidence, ...fileEvidence]}
            fileProjection={fileProjection}
            fixture={fixture}
            hasActiveFile={Boolean(activeFile)}
            localApplyStatus={effectiveApplyStatus}
            onStartLocalApplyStatus={handleStartLocalApplyStatus}
          />
        ) : activeTab === "draft" && activeDraft ? (
          <DraftRightRail evidence={canonicalEvidence.filter((item) => activeDraft.evidenceIds.includes(item.id))} item={activeDraft} />
        ) : activeTab === "correction" && activeCorrection ? (
          <CorrectionRightRail evidence={canonicalEvidence.filter((item) => activeCorrection.evidenceIds.includes(item.id))} item={activeCorrection} />
        ) : activeCurrentData ? (
          <CurrentDataRightRail evidence={canonicalEvidence.filter((item) => activeCurrentData.evidenceIds.includes(item.id))} item={activeCurrentData} />
        ) : (
          <SourceRightRail
            decisionCandidates={phaseOneProjection.decisionCandidates}
            evidence={[]}
            fixture={undefined}
            hasActiveFile={false}
            localApplyStatus="idle"
            onStartLocalApplyStatus={handleStartLocalApplyStatus}
          />
        )}
      </div>
    </div>
  );
}

type StageListItem = {
  id: string;
  statusLabel: string;
  statusTone: BadgeTone;
  subtitle: string;
  summary: string;
  title: string;
  updatedAt: string;
};

function StageListPanel({
  activeId,
  badge,
  description,
  eyebrow,
  items,
  title,
  onSelect
}: {
  activeId?: string;
  badge: string;
  description: string;
  eyebrow: string;
  items: StageListItem[];
  title: string;
  onSelect: (id: string) => void;
}) {
  return (
    <Card className="min-w-0 space-y-4" density="compact">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase text-blue-600">{eyebrow}</p>
          <h2 className="mt-1 text-lg font-bold text-slate-950">{title}</h2>
        </div>
        <Badge tone="info">{badge}</Badge>
      </div>
      <p className="text-sm leading-6 text-slate-600">{description}</p>
      <div className="space-y-2">
        {items.map((item) => (
          <button
            key={item.id}
            className={`w-full rounded-md border p-3 text-left transition ${
              activeId === item.id ? "border-blue-500 bg-blue-50 shadow-sm" : "border-slate-200 bg-white hover:bg-slate-50"
            }`}
            type="button"
            onClick={() => onSelect(item.id)}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-slate-950" title={item.title}>{item.title}</p>
                <p className="mt-1 truncate text-xs text-slate-600">{item.subtitle}</p>
                <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-500">{item.summary}</p>
                <p className="mt-2 text-xs text-slate-500">{item.updatedAt}</p>
              </div>
              <Badge tone={item.statusTone}>{item.statusLabel}</Badge>
            </div>
          </button>
        ))}
      </div>
    </Card>
  );
}

function EmptyDetailPanel() {
  return (
    <div className="min-w-0 space-y-4 xl:col-span-2">
      <Card className="min-w-0 space-y-3" density="compact">
        <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-5">
          <p className="font-semibold text-slate-900">표시할 샘플 데이터가 없습니다</p>
        </div>
      </Card>
    </div>
  );
}

function DraftDetailPanel({ item }: { item: VaultDraftItem }) {
  return (
    <div className="min-w-0 space-y-4 xl:col-span-2">
      <StageDetailCard
        badge={item.statusLabel}
        badgeTone={item.statusTone}
        eyebrow="AI 구조 초안"
        meta={`${item.owner} · ${item.updatedAt}`}
        summary={item.summary}
        title={item.title}
      >
        <div className="grid gap-3 md:grid-cols-3">
          <MetricBox label="Entity" value={`${item.entityCount}`} />
          <MetricBox label="Event" value={`${item.eventCount}`} />
          <MetricBox label="Relation" value={`${item.relationCount}`} />
        </div>
        <SummaryPanel title="추정 필드" items={item.fields.map((field) => ({ label: "필드", value: field, detail: "AI 구조 초안", tone: "neutral" }))} />
      </StageDetailCard>

      <Card className="min-w-0 space-y-3" density="compact">
        <SectionHeader badge={`${item.structureRows.length}개`} badgeTone="info" eyebrow="구조 보기" title="AI 구조 초안 상세" />
        <div className="overflow-x-auto rounded-md border border-slate-200">
          <table className="min-w-[620px] w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-bold text-slate-500">
              <tr>
                <th className="px-3 py-2">구분</th>
                <th className="px-3 py-2">이름</th>
                <th className="px-3 py-2">출처 필드</th>
                <th className="px-3 py-2">상태</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {item.structureRows.map((row) => (
                <tr key={`${row.kind}-${row.name}`}>
                  <td className="whitespace-nowrap px-3 py-2 font-bold text-slate-900">{row.kind}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-slate-700">{row.name}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-slate-700">{row.source}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-slate-600">{row.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function CorrectionDetailPanel({ item }: { item: VaultCorrectionItem }) {
  return (
    <div className="min-w-0 space-y-4 xl:col-span-2">
      <StageDetailCard
        badge={item.statusLabel}
        badgeTone={item.statusTone}
        eyebrow="보정 기록"
        meta={`${item.actor} · ${item.updatedAt}`}
        summary={item.summary}
        title={item.title}
      >
        <div className="grid gap-3 md:grid-cols-2">
          <MetricBox label="출처 데이터" value={item.sourceName} />
          <MetricBox label="보정 항목" value={`${item.revisionRows.length}개`} />
        </div>
      </StageDetailCard>

      <Card className="min-w-0 space-y-3" density="compact">
        <SectionHeader badge="샘플 기준" badgeTone="warning" eyebrow="변화 비교" title="원천 / 초안 / 보정 / 현재 기준" />
        <RevisionComparisonTable activeStage="correction" rows={item.revisionRows} />
      </Card>
    </div>
  );
}

function CurrentDataDetailPanel({ item }: { item: VaultCurrentDataItem }) {
  return (
    <div className="min-w-0 space-y-4 xl:col-span-2">
      <StageDetailCard
        badge={item.statusLabel}
        badgeTone={item.statusTone}
        eyebrow="현재 기준 데이터"
        meta={`${item.owner} · ${item.updatedAt}`}
        summary={item.summary}
        title={item.title}
      >
        <div className="grid gap-3 md:grid-cols-2">
          <MetricBox label="도메인" value={item.domain} />
          <MetricBox label="기준 필드" value={`${item.records.length}개`} />
        </div>
      </StageDetailCard>

      <Card className="min-w-0 space-y-3" density="compact">
        <SectionHeader badge="반영 예정" badgeTone="info" eyebrow="기준 데이터" title="현재 기준 데이터 상세" />
        <div className="overflow-x-auto rounded-md border border-slate-200">
          <table className="min-w-[620px] w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-bold text-slate-500">
              <tr>
                <th className="px-3 py-2">필드</th>
                <th className="px-3 py-2">값</th>
                <th className="px-3 py-2">상태</th>
                <th className="px-3 py-2">메모</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {item.records.map((record) => (
                <tr key={record.field}>
                  <td className="whitespace-nowrap px-3 py-2 font-bold text-slate-900">{record.field}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-slate-700">{record.value}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-slate-700">{record.status}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-slate-600">{record.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function StageDetailCard({
  badge,
  badgeTone,
  children,
  eyebrow,
  meta,
  summary,
  title
}: {
  badge: string;
  badgeTone: BadgeTone;
  children: ReactNode;
  eyebrow: string;
  meta: string;
  summary: string;
  title: string;
}) {
  return (
    <Card className="min-w-0 space-y-4" density="compact">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase text-blue-600">{eyebrow}</p>
          <h2 className="mt-2 text-xl font-bold text-slate-950">{title}</h2>
          <p className="mt-2 text-sm font-semibold text-slate-500">{meta}</p>
          <p className="mt-3 text-sm leading-6 text-slate-600">{summary}</p>
        </div>
        <Badge tone={badgeTone}>{badge}</Badge>
      </div>
      {children}
    </Card>
  );
}

function MetricBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md border border-slate-200 bg-white p-3">
      <p className="text-xs font-bold text-slate-500">{label}</p>
      <p className="mt-2 truncate text-lg font-bold text-slate-950" title={value}>{value}</p>
    </div>
  );
}

function SectionHeader({
  badge,
  badgeTone,
  eyebrow,
  title
}: {
  badge: string;
  badgeTone: BadgeTone;
  eyebrow: string;
  title: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <p className="text-xs font-bold uppercase text-blue-600">{eyebrow}</p>
        <h3 className="mt-1 text-lg font-bold text-slate-950">{title}</h3>
      </div>
      <Badge tone={badgeTone}>{badge}</Badge>
    </div>
  );
}

function RevisionComparisonTable({
  activeStage,
  rows
}: {
  activeStage: VaultTabId;
  rows: VaultCorrectionItem["revisionRows"];
}) {
  return (
    <div className="overflow-x-auto rounded-md border border-slate-200">
      <table className="min-w-[760px] w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs font-bold text-slate-500">
          <tr>
            <th className="px-3 py-2">필드</th>
            <StageHeader stage="source" activeStage={activeStage}>원천 기록</StageHeader>
            <StageHeader stage="draft" activeStage={activeStage}>AI 구조 초안</StageHeader>
            <StageHeader stage="correction" activeStage={activeStage}>보정 기록</StageHeader>
            <StageHeader stage="current" activeStage={activeStage}>현재 기준 데이터</StageHeader>
            <th className="px-3 py-2">비고</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {rows.map((row) => (
            <tr key={row.field}>
              <td className="whitespace-nowrap px-3 py-2 font-bold text-slate-900">{row.field}</td>
              <StageCell stage="source" activeStage={activeStage}>{row.source}</StageCell>
              <StageCell stage="draft" activeStage={activeStage}>{row.draft}</StageCell>
              <StageCell stage="correction" activeStage={activeStage}>{row.correction}</StageCell>
              <StageCell stage="current" activeStage={activeStage}>{row.current}</StageCell>
              <td className="whitespace-nowrap px-3 py-2 text-slate-600">{row.note}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SourceRightRail({
  decisionCandidates,
  evidence,
  fileProjection,
  fixture,
  hasActiveFile,
  localApplyStatus,
  onStartLocalApplyStatus
}: {
  decisionCandidates: PhaseOneAnalysisProjection["decisionCandidates"];
  evidence: EvidenceReference[];
  fileProjection?: PhaseOneFileProjection;
  fixture?: VaultRevisionFixture;
  hasActiveFile: boolean;
  localApplyStatus: LocalApplyStatus;
  onStartLocalApplyStatus: () => void;
}) {
  return (
    <aside className="min-w-0 space-y-4">
      {fixture ? (
        <>
          {fileProjection && (
            <RightPanel title="분석 반영 상태" eyebrow="적용 흐름" badge={applyStatusLabel(localApplyStatus)} badgeTone={applyStatusTone(localApplyStatus)}>
              <ApplyFlowPanel
                fileProjection={fileProjection}
                localStatus={localApplyStatus}
                onStart={onStartLocalApplyStatus}
              />
            </RightPanel>
          )}
          {fileProjection && (
            <RightPanel title="영향 화면" eyebrow="흐름 영향" badge={`${fileProjection.affectedScreens.length}곳`} badgeTone="info">
              <SignalList signals={fileProjection.affectedScreens} />
            </RightPanel>
          )}
          {fileProjection && (
            <RightPanel
              title="Decision 후보"
              eyebrow="최종 검토 전"
              badge={`${fileProjection.decisionCandidateIds.length}건`}
              badgeTone="warning"
            >
              <DecisionCandidateRail
                candidates={decisionCandidates.filter((candidate) => fileProjection.decisionCandidateIds.includes(candidate.id))}
              />
            </RightPanel>
          )}
          <ImpactPreviewPanel items={[...fixture.affected, ...fixture.metrics, ...fixture.insights]} notice={fixture.sampleNotice} />
          <RightPanel title="보정 기록" eyebrow="수정 흐름" badge={`${fixture.correctionEvents.length}건`} badgeTone="warning">
            <CorrectionTimeline events={fixture.correctionEvents} />
          </RightPanel>
          <RightPanel title="출처 근거" eyebrow="근거 데이터" badge={`${evidence.length}건`} badgeTone="neutral">
            <EvidenceList evidence={evidence} />
          </RightPanel>
          <RightPanel title="데이터 흐름 기록" eyebrow="반영 경로" badge="예정 포함" badgeTone="success">
            <FlowTimeline events={fixture.flowEvents} />
          </RightPanel>
        </>
      ) : (
        <>
          <RightPanel title="영향 미리보기" eyebrow="사전 감지" badge="대기" badgeTone="neutral">
            <p className="text-sm leading-6 text-slate-600">
              {hasActiveFile ? "영향 감지는 후속 로직에서 연결됩니다." : "파일 선택 시 상태가 표시됩니다."}
            </p>
          </RightPanel>
          <RightPanel title="출처 근거" eyebrow="근거 데이터" badge={`${evidence.length}건`} badgeTone="neutral">
            <EvidenceList evidence={evidence} />
          </RightPanel>
          <RightPanel title="데이터 흐름 기록" eyebrow="반영 경로" badge="분석 대기" badgeTone="neutral">
            <p className="text-sm leading-6 text-slate-600">파일 선택 후 분석 반영 흐름이 표시됩니다.</p>
          </RightPanel>
        </>
      )}
    </aside>
  );
}

function DraftRightRail({ evidence, item }: { evidence: EvidenceReference[]; item: VaultDraftItem }) {
  return (
    <aside className="min-w-0 space-y-4">
      <ImpactPreviewPanel items={item.impactItems} notice="AI 구조 초안이 현재 기준과 지표에 줄 수 있는 영향을 샘플로 사전 표시합니다." />
      <RightPanel title="검토 기록" eyebrow="초안 흐름" badge={`${item.reviewEvents.length}건`} badgeTone="warning">
        <FlowTimeline events={item.reviewEvents} />
      </RightPanel>
      <RightPanel title="출처 근거" eyebrow="근거 데이터" badge={`${evidence.length}건`} badgeTone="neutral">
        <EvidenceList evidence={evidence} />
      </RightPanel>
      <RightPanel title="데이터 흐름 기록" eyebrow="반영 경로" badge="예정 포함" badgeTone="success">
        <FlowTimeline events={item.flowEvents} />
      </RightPanel>
    </aside>
  );
}

function CorrectionRightRail({ evidence, item }: { evidence: EvidenceReference[]; item: VaultCorrectionItem }) {
  return (
    <aside className="min-w-0 space-y-4">
      <ImpactPreviewPanel items={item.impactItems} notice="사용자 보정이 현재 기준과 지표에 줄 수 있는 영향을 샘플로 표시합니다." />
      <RightPanel title="보정 기록" eyebrow="수정 흐름" badge={`${item.correctionEvents.length}건`} badgeTone="warning">
        <CorrectionTimeline events={item.correctionEvents} />
      </RightPanel>
      <RightPanel title="출처 근거" eyebrow="근거 데이터" badge={`${evidence.length}건`} badgeTone="neutral">
        <EvidenceList evidence={evidence} />
      </RightPanel>
      <RightPanel title="데이터 흐름 기록" eyebrow="반영 경로" badge="예정 포함" badgeTone="success">
        <FlowTimeline events={item.flowEvents} />
      </RightPanel>
    </aside>
  );
}

function CurrentDataRightRail({ evidence, item }: { evidence: EvidenceReference[]; item: VaultCurrentDataItem }) {
  return (
    <aside className="min-w-0 space-y-4">
      <ImpactPreviewPanel items={item.impactItems} notice="현재 기준 데이터로 반영될 때 바뀌는 영향 범위를 샘플로 표시합니다." />
      <RightPanel title="출처 근거" eyebrow="근거 데이터" badge={`${evidence.length}건`} badgeTone="neutral">
        <EvidenceList evidence={evidence} />
      </RightPanel>
      <RightPanel title="데이터 흐름 기록" eyebrow="반영 경로" badge="예정 포함" badgeTone="success">
        <FlowTimeline events={item.flowEvents} />
      </RightPanel>
    </aside>
  );
}

function ApplyStatusPanel({
  fileProjection,
  localStatus,
  onStart
}: {
  fileProjection: PhaseOneFileProjection;
  localStatus: LocalApplyStatus;
  onStart: () => void;
}) {
  const canStart = localStatus === "idle";

  return (
    <div className="rounded-md border border-blue-100 bg-blue-50 p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase text-blue-700">분석에 반영</p>
          <h3 className="mt-1 text-lg font-bold text-slate-950">{applyStatusLabel(localStatus)}</h3>
          <p className="mt-2 text-sm leading-6 text-slate-700">{fileProjection.impactSummary}</p>
          <p className="mt-1 text-xs leading-5 text-blue-700">
            클릭 후 반영 대기와 AI 분석 중 상태를 거쳐 반영 완료로 잠깁니다.
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <Badge tone={applyStatusTone(localStatus)}>{applyAiStatusLabel(localStatus, fileProjection)}</Badge>
          <Button className="h-9 px-3" disabled={!canStart} variant="secondary" onClick={onStart}>
            {applyButtonLabel(localStatus)}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ApplyFlowPanel({
  fileProjection,
  localStatus,
  onStart
}: {
  fileProjection: PhaseOneFileProjection;
  localStatus: LocalApplyStatus;
  onStart: () => void;
}) {
  const canStart = localStatus === "idle";

  return (
    <div className="space-y-3">
      <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-bold text-slate-950">{applyStatusLabel(localStatus)}</p>
          <Badge tone={applyStatusTone(localStatus)}>{applyFlowBadgeLabel(localStatus)}</Badge>
        </div>
        <p className="mt-2 text-xs leading-5 text-slate-600">{applyStatusLabel(localStatus)} · {applyAiStatusLabel(localStatus, fileProjection)}</p>
        <Button className="mt-3 h-8 px-3" disabled={!canStart} variant="secondary" onClick={onStart}>
          {applyButtonLabel(localStatus)}
        </Button>
      </div>
      <SignalList signals={fileProjection.flowSteps.map((step) => ({
        ...step,
        value: step.id.endsWith("flow-apply") ? applyStatusLabel(localStatus) : step.value,
        tone: step.id.endsWith("flow-apply") ? applyStatusTone(localStatus) : step.tone
      }))} />
    </div>
  );
}

function StructureCandidatePanel({ groups }: { groups: PhaseOneStructureGroup[] }) {
  const visibleGroups = groups.filter((group) => group.items.length > 0);

  return (
    <div className="rounded-md border border-slate-200 bg-white p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase text-blue-600">파일이 만드는 구조 후보</p>
          <h3 className="mt-1 text-lg font-bold text-slate-950">Entity - Event - Relation - Metric - Decision</h3>
        </div>
        <Badge tone="info">{visibleGroups.reduce((total, group) => total + group.items.length, 0)}개</Badge>
      </div>
      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        {visibleGroups.map((group) => (
          <div key={group.kind} className="min-w-0 rounded-md border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-bold text-slate-500">{group.label}</p>
              <Badge tone="neutral">{group.items.length}개</Badge>
            </div>
            <div className="mt-3 space-y-2">
              {group.items.slice(0, 3).map((item) => (
                <StructureCandidateRow key={item.id} item={item} />
              ))}
              {group.items.length > 3 && (
                <p className="text-xs font-semibold text-slate-500">외 {group.items.length - 3}개 후보</p>
              )}
            </div>
          </div>
        ))}
        {visibleGroups.length === 0 && (
          <p className="text-sm leading-6 text-slate-600">미리보기 필드 기반 후보 생성 대기 상태입니다.</p>
        )}
      </div>
    </div>
  );
}

function StructureCandidateRow({ item }: { item: PhaseOneStructureItem }) {
  return (
    <div className="min-w-0 rounded-md border border-slate-200 bg-white p-2.5">
      <div className="flex min-w-0 items-center justify-between gap-2">
        <p className="min-w-0 truncate text-sm font-bold text-slate-950" title={item.title}>{item.title}</p>
        <Badge tone={item.tone}>{item.tone === "danger" ? "주의" : "후보"}</Badge>
      </div>
      <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-600">{item.description}</p>
    </div>
  );
}

function SignalList({ signals }: { signals: PhaseOneSignal[] }) {
  return (
    <div className="space-y-2">
      {signals.map((signal) => (
        <div key={signal.id} className="rounded-md border border-slate-200 bg-white p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-500">{signal.label}</p>
              <p className="mt-1 break-words text-sm font-bold text-slate-950">{signal.value}</p>
            </div>
            <Badge tone={signal.tone}>{signal.tone === "danger" ? "주의" : "연결"}</Badge>
          </div>
          <p className="mt-2 text-xs leading-5 text-slate-600">{signal.detail}</p>
        </div>
      ))}
    </div>
  );
}

function DecisionCandidateRail({
  candidates
}: {
  candidates: PhaseOneAnalysisProjection["decisionCandidates"];
}) {
  if (candidates.length === 0) {
    return <p className="text-sm leading-6 text-slate-600">이 파일에서 직접 연결된 Decision 후보는 아직 없습니다.</p>;
  }

  return (
    <div className="space-y-2">
      {candidates.map((candidate) => (
        <div key={candidate.id} className="rounded-md border border-slate-200 bg-white p-3">
          <div className="flex items-start justify-between gap-3">
            <p className="min-w-0 text-sm font-bold leading-5 text-slate-950">{candidate.title}</p>
            <Badge tone={candidate.impactLabel === "높은 영향" ? "danger" : "warning"}>{candidate.statusLabel}</Badge>
          </div>
          <p className="mt-2 text-xs leading-5 text-slate-600">{candidate.summary}</p>
          <p className="mt-2 text-xs font-semibold text-slate-500">{candidate.evidenceStrengthLabel}</p>
        </div>
      ))}
    </div>
  );
}

function ImpactPreviewPanel({
  items,
  notice
}: {
  items: VaultImpactItem[];
  notice: string;
}) {
  return (
    <RightPanel title="영향 미리보기" eyebrow="사전 감지" badge="샘플 기준" badgeTone="info">
      <p className="text-sm leading-6 text-slate-600">{notice}</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-2" data-vault-impact-grid="true">
        {items.map((item) => (
          <ImpactRow key={`${item.label}-${item.value}`} item={item} />
        ))}
      </div>
    </RightPanel>
  );
}

function CorrectionTimeline({ events }: { events: VaultRevisionFixture["correctionEvents"] }) {
  return (
    <div className="space-y-3">
      {events.map((event) => (
        <TimelineRow key={event.id} tone={event.tone} title={event.title} meta={`${event.actor} · ${event.time}`} detail={event.detail} />
      ))}
    </div>
  );
}

function FlowTimeline({ events }: { events: VaultDraftItem["flowEvents"] }) {
  return (
    <div className="space-y-3">
      {events.map((event) => (
        <TimelineRow key={event.id} tone={event.tone} title={event.label} meta={`${event.owner} · ${event.time}`} detail={event.detail} />
      ))}
    </div>
  );
}

function EvidenceList({ evidence }: { evidence: EvidenceReference[] }) {
  return (
    <div className="space-y-2">
      {evidence.slice(0, 4).map((item) => (
        <div key={item.id} className="rounded-md border border-slate-200 bg-white p-3">
          <p className="text-sm font-bold text-slate-950">{item.label}</p>
          <p className="mt-1 text-xs text-slate-500">{formatEvidenceSource(item)}</p>
          <p className="mt-2 max-h-16 overflow-hidden text-xs leading-5 text-slate-600">{item.excerpt}</p>
        </div>
      ))}
      {evidence.length === 0 && (
        <p className="text-sm leading-6 text-slate-600">분석 후 근거 위치가 표시됩니다.</p>
      )}
    </div>
  );
}

function SummaryPanel({ title, items }: { title: string; items: VaultImpactItem[] }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-3">
      <p className="text-xs font-bold text-slate-500">{title}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {items.map((item) => (
          <Badge key={`${item.label}-${item.value}`} tone={item.tone}>{item.value}</Badge>
        ))}
      </div>
    </div>
  );
}

function ReadOnlyFileInfo({
  description,
  file,
  organizationName
}: {
  description?: string;
  file: SourceFile;
  organizationName: string;
}) {
  return (
    <div className="mt-3 grid gap-3 md:grid-cols-2">
      <DetailInfoItem label="데이터명" value={file.name} />
      <DetailInfoItem label="데이터 유형" value={file.kind} />
      <DetailInfoItem className="md:col-span-2" label="설명" value={description || "설명 없음"} />
      <DetailInfoItem label="담당 부서(조직)" value={organizationName} />
      <DetailInfoItem label="현재 기준 반영" value={file.appliedAt ? formatDateTime(file.appliedAt) : "대기"} />
    </div>
  );
}

function DetailInfoItem({ className = "", label, value }: { className?: string; label: string; value: string }) {
  return (
    <div className={`rounded-md border border-slate-200 bg-white p-3 ${className}`}>
      <p className="text-xs font-bold text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold leading-6 text-slate-900">{value}</p>
    </div>
  );
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("ko-KR");
}

function applyStatusForFile(file: SourceFile | undefined, localStatus: LocalApplyStatus | undefined): LocalApplyStatus {
  if (file?.appliedAt) {
    return "applied";
  }

  return localStatus ?? "idle";
}

function applyStatusLabel(status: LocalApplyStatus): string {
  if (status === "applied") {
    return "반영 완료";
  }

  if (status === "analyzing") {
    return "AI 분석 중";
  }

  if (status === "pending") {
    return "반영 대기";
  }

  return "분석 반영 전";
}

function applyButtonLabel(status: LocalApplyStatus): string {
  if (status === "applied") {
    return "반영됨";
  }

  if (status === "analyzing") {
    return "AI 분석 중";
  }

  if (status === "pending") {
    return "반영 대기";
  }

  return "분석에 반영";
}

function applyAiStatusLabel(status: LocalApplyStatus, fileProjection: PhaseOneFileProjection): string {
  if (status === "applied") {
    return "AI 분석 반영됨";
  }

  if (status === "analyzing") {
    return "AI 분석 중";
  }

  if (status === "pending") {
    return "반영 대기 중";
  }

  return fileProjection.aiStatusLabel;
}

function applyFlowBadgeLabel(status: LocalApplyStatus): string {
  if (status === "applied") {
    return "반영됨";
  }

  if (status === "analyzing") {
    return "분석 중";
  }

  if (status === "pending") {
    return "대기 중";
  }

  return "반영 대기";
}

function applyStatusTone(status: LocalApplyStatus): PhaseOneSignal["tone"] {
  if (status === "applied") {
    return "success";
  }

  if (status === "analyzing") {
    return "info";
  }

  if (status === "pending") {
    return "warning";
  }

  return "neutral";
}

function ImpactRow({ item }: { item: VaultImpactItem }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-bold text-slate-500">{item.label}</p>
          <p className="mt-1 break-words text-sm font-bold text-slate-950">{item.value}</p>
        </div>
        <Badge tone={item.tone}>{item.tone === "danger" ? "주의" : "영향"}</Badge>
      </div>
      <p className="mt-2 text-xs leading-5 text-slate-600">{item.detail}</p>
    </div>
  );
}

function RightPanel({
  badge,
  badgeTone,
  children,
  eyebrow,
  title
}: {
  badge: string;
  badgeTone: BadgeTone;
  children: ReactNode;
  eyebrow: string;
  title: string;
}) {
  return (
    <Card className="min-w-0 space-y-3" density="compact">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase text-blue-600">{eyebrow}</p>
          <h3 className="mt-1 text-base font-bold text-slate-950">{title}</h3>
        </div>
        <Badge tone={badgeTone}>{badge}</Badge>
      </div>
      {children}
    </Card>
  );
}

function TimelineRow({
  detail,
  meta,
  title,
  tone
}: {
  detail: string;
  meta: string;
  title: string;
  tone: BadgeTone;
}) {
  return (
    <div className="grid grid-cols-[12px_minmax(0,1fr)] gap-3">
      <span className={`mt-1 size-3 rounded-full border-2 ${timelineDotClass(tone)}`} />
      <div className="min-w-0">
        <p className="text-sm font-bold text-slate-950">{title}</p>
        <p className="mt-1 text-xs text-slate-500">{meta}</p>
        <p className="mt-1 text-xs leading-5 text-slate-600">{detail}</p>
      </div>
    </div>
  );
}

function StageHeader({
  activeStage,
  children,
  stage
}: {
  activeStage: VaultTabId;
  children: ReactNode;
  stage: VaultTabId;
}) {
  return (
    <th className={`whitespace-nowrap px-3 py-2 ${activeStage === stage ? stageColumnClass[stage] : ""}`}>
      {children}
    </th>
  );
}

function StageCell({
  activeStage,
  children,
  stage
}: {
  activeStage: VaultTabId;
  children: ReactNode;
  stage: VaultTabId;
}) {
  return (
    <td className={`whitespace-nowrap px-3 py-2 ${activeStage === stage ? stageColumnClass[stage] : "text-slate-700"}`}>
      {children}
    </td>
  );
}

function fileStatusLabel(file: SourceFile, localStatus: LocalApplyStatus | undefined): string {
  const status = applyStatusForFile(file, localStatus);

  if (status === "applied") {
    return "반영됨";
  }

  if (status === "analyzing") {
    return "AI 분석 중";
  }

  if (status === "pending") {
    return "반영 대기";
  }

  return "추가됨";
}

function sourceStatusTone(file: SourceFile, localStatus: LocalApplyStatus | undefined): BadgeTone {
  const status = applyStatusForFile(file, localStatus);

  if (status === "applied") {
    return "success";
  }

  if (status === "analyzing") {
    return "info";
  }

  if (status === "pending") {
    return "warning";
  }

  return "neutral";
}

function timelineDotClass(tone: BadgeTone): string {
  if (tone === "success" || tone === "emerald") {
    return "border-emerald-500 bg-emerald-100";
  }

  if (tone === "warning" || tone === "orange") {
    return "border-amber-500 bg-amber-100";
  }

  if (tone === "danger") {
    return "border-red-500 bg-red-100";
  }

  if (tone === "info") {
    return "border-blue-500 bg-blue-100";
  }

  return "border-slate-300 bg-white";
}
