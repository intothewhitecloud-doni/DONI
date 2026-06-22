"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card, SectionTitle } from "../../components/ui/Card";
import { Popup } from "../../components/ui/Popup";
import type { CompanyUser, CompanyUserStatus } from "../../lib/domain/types";
import { UNASSIGNED_ORGANIZATION_CATEGORY_ID } from "../../lib/domain/types";
import {
  organizationCategoryOptionsForSelection,
  visibleOrganizationCategories
} from "../../lib/prototype/organizationCategories";
import { companyUserStatusLabel } from "../../lib/prototype/policy";
import { roleLabel } from "../../lib/prototype/permissions";
import { currentCompanyUser } from "../../lib/prototype/selectors";
import { usePrototype } from "../../lib/prototype/PrototypeProvider";

const statusFilters: Array<{ label: string; value: CompanyUserStatus | "all" }> = [
  { label: "전체", value: "all" },
  { label: "승인 대기", value: "pending" },
  { label: "승인 완료", value: "active" },
  { label: "반려", value: "rejected" }
];
const ORGANIZATION_MENU_GAP = 8;
const ORGANIZATION_MENU_MAX_WIDTH = 384;
const VIEWPORT_MENU_PADDING = 16;

function emptyUserFilterMessage(statusFilter: CompanyUserStatus | "all"): string {
  const label = statusFilters.find((filter) => filter.value === statusFilter)?.label ?? "선택한 상태";
  return statusFilter === "all" ? "등록된 사용자가 없습니다." : `${label} 상태의 사용자가 없습니다.`;
}

export function CompanyManagementScreen() {
  const { commands, state } = usePrototype();
  const actor = currentCompanyUser(state);
  const canManage = actor?.role === "owner" && actor.status === "active";
  const [statusFilter, setStatusFilter] = useState<CompanyUserStatus | "all">("all");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [editingCategoryId, setEditingCategoryId] = useState("");
  const [editingCategoryName, setEditingCategoryName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<CompanyUser | undefined>();
  const [categoryMenuOpen, setCategoryMenuOpen] = useState(false);
  const [categoryMenuPosition, setCategoryMenuPosition] = useState<{ left: number; top: number }>();
  const [codeCopied, setCodeCopied] = useState(false);
  const categoryMenuButtonRef = useRef<HTMLButtonElement>(null);

  const users = useMemo(
    () => state.companyUsers.filter((companyUser) => statusFilter === "all" || companyUser.status === statusFilter),
    [state.companyUsers, statusFilter]
  );
  const organizationCategories = useMemo(
    () => visibleOrganizationCategories(state.organizationCategories, {
      companyUsers: state.companyUsers,
      sourceFiles: state.sourceFiles
    }),
    [state.companyUsers, state.organizationCategories, state.sourceFiles]
  );

  function addCategory() {
    if (commands.addOrganizationCategory(newCategoryName)) {
      setNewCategoryName("");
    }
  }

  function startCategoryEdit(categoryId: string, name: string) {
    setEditingCategoryId(categoryId);
    setEditingCategoryName(name);
  }

  function submitCategoryEdit() {
    if (editingCategoryId && commands.updateOrganizationCategory(editingCategoryId, editingCategoryName)) {
      setEditingCategoryId("");
      setEditingCategoryName("");
    }
  }

  function cancelCategoryEdit() {
    setEditingCategoryId("");
    setEditingCategoryName("");
  }

  function deleteOrganizationCategory(categoryId: string) {
    if (commands.deleteOrganizationCategory(categoryId)) {
      cancelCategoryEdit();
    }
  }

  const updateCategoryMenuPosition = useCallback(() => {
    const button = categoryMenuButtonRef.current;
    if (!button || typeof window === "undefined") {
      return;
    }

    const rect = button.getBoundingClientRect();
    const menuWidth = Math.min(ORGANIZATION_MENU_MAX_WIDTH, window.innerWidth - VIEWPORT_MENU_PADDING * 2);
    const maxLeft = window.innerWidth - menuWidth - VIEWPORT_MENU_PADDING;
    const left = Math.max(VIEWPORT_MENU_PADDING, Math.min(rect.left, maxLeft));
    setCategoryMenuPosition({
      left,
      top: rect.bottom + ORGANIZATION_MENU_GAP
    });
  }, []);

  useEffect(() => {
    if (!categoryMenuOpen) {
      return;
    }

    updateCategoryMenuPosition();
    window.addEventListener("resize", updateCategoryMenuPosition);
    window.addEventListener("scroll", updateCategoryMenuPosition, true);
    return () => {
      window.removeEventListener("resize", updateCategoryMenuPosition);
      window.removeEventListener("scroll", updateCategoryMenuPosition, true);
    };
  }, [categoryMenuOpen, updateCategoryMenuPosition]);

  function toggleCategoryMenu() {
    if (!categoryMenuOpen) {
      updateCategoryMenuPosition();
    }
    setCategoryMenuOpen((open) => !open);
  }

  function confirmDeleteAccount() {
    if (deleteTarget && commands.deleteCompanyUserAccount(deleteTarget.id)) {
      setDeleteTarget(undefined);
    }
  }

  async function copyCompanyCode() {
    try {
      await navigator.clipboard.writeText(state.company.code);
      setCodeCopied(true);
      window.setTimeout(() => setCodeCopied(false), 1400);
    } catch {
      setCodeCopied(false);
    }
  }

  return (
    <div className="space-y-8">
      <SectionTitle title="기업 관리" />

      <Card className="space-y-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0 space-y-2">
            <p className="text-caption text-muted">기업 정보</p>
            <h2 className="truncate text-title-lg text-ink">{state.company.name}</h2>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button variant="secondary" onClick={copyCompanyCode}>{codeCopied ? "복사됨" : "코드 복사"}</Button>
            {canManage && <Button onClick={commands.regenerateCompanyCode}>새 코드 발급</Button>}
          </div>
        </div>
        <div className="rounded-md border border-hairline-soft bg-surface-soft p-4">
          <div className="min-w-0">
            <p className="text-caption text-muted">회사코드</p>
            <p className="mt-1 truncate font-mono text-title-sm text-ink">{state.company.code}</p>
          </div>
        </div>
      </Card>

      <Card className="space-y-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <SectionTitle title="기업 사용자" variant="section" />
          <div className="flex flex-wrap items-center gap-2">
            {statusFilters.map((filter) => (
              <Button
                key={filter.value}
                variant={statusFilter === filter.value ? "primary" : "secondary"}
                onClick={() => setStatusFilter(filter.value)}
              >
                {filter.label}
              </Button>
            ))}
          </div>
        </div>
        <div className="relative">
          <div className="overflow-x-auto rounded-lg border border-hairline">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-surface-soft text-caption text-muted">
                <tr>
                  <th className="px-4 py-3">사용자</th>
                  <th className="px-4 py-3">역할</th>
                  <th className="px-4 py-3">상태</th>
                  <th className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span>조직</span>
                      {canManage && (
                        <button
                          ref={categoryMenuButtonRef}
                          aria-expanded={categoryMenuOpen}
                          aria-label="조직 관리"
                          className={`inline-flex size-8 shrink-0 items-center justify-center rounded-md border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
                            categoryMenuOpen
                              ? "border-primary bg-primary text-white"
                              : "border-hairline-soft bg-white text-muted hover:bg-blue-50 hover:text-brand-accent"
                          }`}
                          title="조직 관리"
                          type="button"
                          onClick={toggleCategoryMenu}
                        >
                          <MenuIcon />
                        </button>
                      )}
                    </div>
                  </th>
                  <th className="px-4 py-3">관리</th>
                </tr>
              </thead>
              <tbody>
                {users.length > 0 ? (
                  users.map((companyUser) => (
                    <CompanyUserRow
                      key={companyUser.id}
                      canManage={canManage}
                      companyUser={companyUser}
                      isCurrentUser={companyUser.userId === state.session.currentUserId}
                      onDelete={() => setDeleteTarget(companyUser)}
                    />
                  ))
                ) : (
                  <tr className="border-t border-hairline">
                    <td className="px-4 py-8 text-center text-body-sm text-muted" colSpan={5}>
                      {emptyUserFilterMessage(statusFilter)}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {canManage && categoryMenuOpen && categoryMenuPosition && (
            <OrganizationCategoryMenu
              categories={organizationCategories}
              editingCategoryId={editingCategoryId}
              editingCategoryName={editingCategoryName}
              newCategoryName={newCategoryName}
              onAdd={addCategory}
              onCancelEdit={cancelCategoryEdit}
              onDelete={deleteOrganizationCategory}
              onEditNameChange={setEditingCategoryName}
              onNewNameChange={setNewCategoryName}
              onStartEdit={startCategoryEdit}
              onSubmitEdit={submitCategoryEdit}
              style={{
                left: categoryMenuPosition.left,
                top: categoryMenuPosition.top
              }}
            />
          )}
        </div>
      </Card>

      {deleteTarget && (
        <Popup title="사용자 계정 삭제" onClose={() => setDeleteTarget(undefined)}>
          <p className="text-sm leading-6 text-slate-600">
            {deleteTarget.name} 사용자 계정을 이 기업 콘솔에서 삭제합니다. 과거 의사결정/감사 기록에는 이름과 역할 스냅샷이 유지됩니다.
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDeleteTarget(undefined)}>취소</Button>
            <Button variant="danger" onClick={confirmDeleteAccount}>계정 삭제</Button>
          </div>
        </Popup>
      )}
    </div>
  );
}

function CompanyUserRow({
  canManage,
  companyUser,
  isCurrentUser,
  onDelete
}: {
  canManage: boolean;
  companyUser: CompanyUser;
  isCurrentUser: boolean;
  onDelete: () => void;
}) {
  const { commands, state } = usePrototype();
  const [organizationCategoryId, setOrganizationCategoryId] = useState(companyUser.organizationCategoryId);
  const [saveFeedback, setSaveFeedback] = useState("");
  const saveFeedbackTimeoutRef = useRef<number | undefined>(undefined);
  const category = state.organizationCategories.find((item) => item.id === companyUser.organizationCategoryId);
  const categoryOptions = organizationCategoryOptionsForSelection(
    state.organizationCategories,
    { companyUsers: state.companyUsers, sourceFiles: state.sourceFiles },
    organizationCategoryId
  );
  const editable = canManage && !isCurrentUser && companyUser.role !== "owner" && companyUser.status === "active";
  const pendingEditable = canManage && !isCurrentUser && companyUser.status === "pending";

  useEffect(() => {
    setOrganizationCategoryId(companyUser.organizationCategoryId);
  }, [companyUser.organizationCategoryId]);

  useEffect(() => () => {
    if (saveFeedbackTimeoutRef.current) {
      window.clearTimeout(saveFeedbackTimeoutRef.current);
    }
  }, []);

  function markSaved() {
    setSaveFeedback("저장됨");
    if (saveFeedbackTimeoutRef.current) {
      window.clearTimeout(saveFeedbackTimeoutRef.current);
    }
    saveFeedbackTimeoutRef.current = window.setTimeout(() => setSaveFeedback(""), 1600);
  }

  function updateOrganization(nextOrganizationCategoryId: string) {
    setOrganizationCategoryId(nextOrganizationCategoryId);
    const saved = commands.updateCompanyUser({
      companyUserId: companyUser.id,
      role: companyUser.role,
      title: companyUser.title,
      organizationCategoryId: nextOrganizationCategoryId
    });

    if (saved) {
      markSaved();
    } else {
      setOrganizationCategoryId(companyUser.organizationCategoryId);
    }
  }

  return (
    <tr className="border-t border-hairline">
      <td className="px-4 py-3">
        <p className="font-semibold text-ink">{companyUser.name}</p>
        <p className="text-caption text-muted">{companyUser.email}</p>
      </td>
      <td className="px-4 py-3">
        <Badge tone={companyUser.role === "owner" ? "success" : "info"}>{roleLabel(companyUser.role)}</Badge>
      </td>
      <td className="px-4 py-3"><Badge tone={companyUser.status === "active" ? "success" : companyUser.status === "pending" ? "warning" : "neutral"}>{companyUserStatusLabel(companyUser.status)}</Badge></td>
      <td className="px-4 py-3">
        {editable ? (
          <div className="flex min-w-[13rem] items-center gap-2">
            <select
              className="h-9 min-w-0 max-w-[10rem] rounded-md border border-hairline bg-white px-2 text-body-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              value={organizationCategoryId}
              onChange={(event) => updateOrganization(event.target.value)}
            >
              {categoryOptions.map((category) => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </select>
            {saveFeedback ? (
              <span aria-live="polite" className="w-12 shrink-0 text-caption font-bold text-success" role="status">{saveFeedback}</span>
            ) : (
              <span aria-hidden="true" className="w-12 shrink-0" />
            )}
          </div>
        ) : (
          <Badge tone="neutral">{category?.name ?? "미지정"}</Badge>
        )}
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-nowrap gap-2">
          {pendingEditable && <Button onClick={() => commands.approveCompanyUser(companyUser.id)}>승인</Button>}
          {pendingEditable && <Button variant="secondary" onClick={() => commands.rejectCompanyUser(companyUser.id)}>반려</Button>}
          {canManage && !isCurrentUser && companyUser.role !== "owner" && <Button variant="danger" onClick={onDelete}>삭제</Button>}
          {!canManage && <span className="text-caption text-muted">조회 전용</span>}
        </div>
      </td>
    </tr>
  );
}

function OrganizationCategoryMenu({
  categories,
  editingCategoryId,
  editingCategoryName,
  newCategoryName,
  onAdd,
  onCancelEdit,
  onDelete,
  onEditNameChange,
  onNewNameChange,
  onStartEdit,
  onSubmitEdit,
  style
}: {
  categories: Array<{ id: string; name: string }>;
  editingCategoryId: string;
  editingCategoryName: string;
  newCategoryName: string;
  onAdd: () => void;
  onCancelEdit: () => void;
  onDelete: (categoryId: string) => void;
  onEditNameChange: (name: string) => void;
  onNewNameChange: (name: string) => void;
  onStartEdit: (categoryId: string, name: string) => void;
  onSubmitEdit: () => void;
  style: CSSProperties;
}) {
  return (
    <div
      aria-label="조직 관리"
      className="fixed z-[45] w-[min(24rem,calc(100vw-2rem))] rounded-lg border border-hairline bg-white p-3 text-left shadow-[0_18px_48px_rgba(15,23,42,0.16)]"
      role="dialog"
      style={style}
    >
      <div className="flex items-center justify-between gap-3 border-b border-hairline-soft pb-3">
        <div className="min-w-0">
          <p className="text-title-sm text-ink">조직 관리</p>
        </div>
        <Badge tone="neutral">{categories.length}개</Badge>
      </div>
      <div className="mt-3 flex gap-2">
        <input
          className="min-w-0 flex-1 rounded-md border border-hairline-soft bg-white px-3 py-2 text-body-sm text-ink outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          placeholder="새 조직 이름"
          value={newCategoryName}
          onChange={(event) => onNewNameChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              onAdd();
            }
          }}
        />
        <Button className="h-10 px-3" onClick={onAdd}>추가</Button>
      </div>
      <div className="mt-3 max-h-72 overflow-y-auto rounded-md border border-hairline-soft">
        {categories.length === 0 ? (
          <div className="p-3 text-body-sm text-muted">등록된 조직이 없습니다.</div>
        ) : (
          categories.map((category) => {
            const isUnassigned = category.id === UNASSIGNED_ORGANIZATION_CATEGORY_ID;
            const editing = editingCategoryId === category.id;
            return (
              <div key={category.id} className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-t border-hairline-soft px-3 py-2 first:border-t-0">
                {editing ? (
                  <>
                    <input
                      className="min-w-0 rounded-md border border-hairline-soft px-2 py-1.5 text-body-sm text-ink outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                      value={editingCategoryName}
                      onChange={(event) => onEditNameChange(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          onSubmitEdit();
                        }
                      }}
                    />
                    <div className="flex shrink-0 gap-1">
                      <button className="whitespace-nowrap rounded-md px-2 py-1 text-button text-primary hover:bg-blue-50" type="button" onClick={onSubmitEdit}>저장</button>
                      <button className="whitespace-nowrap rounded-md px-2 py-1 text-button text-muted hover:bg-surface-soft" type="button" onClick={onCancelEdit}>취소</button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="min-w-0">
                      <Badge tone={isUnassigned ? "neutral" : "info"}>{category.name}</Badge>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      {isUnassigned ? (
                        <span className="whitespace-nowrap px-2 py-1 text-caption text-muted">기본값</span>
                      ) : (
                        <>
                          <button className="whitespace-nowrap rounded-md px-2 py-1 text-button text-primary hover:bg-blue-50" type="button" onClick={() => onStartEdit(category.id, category.name)}>수정</button>
                          <button className="whitespace-nowrap rounded-md px-2 py-1 text-button text-error hover:bg-error/10" type="button" onClick={() => onDelete(category.id)}>삭제</button>
                        </>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function MenuIcon() {
  return (
    <svg aria-hidden="true" className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 7h14M5 12h14M5 17h14" />
    </svg>
  );
}

export function SettingsScreen() {
  return (
    <div className="space-y-6">
      <SectionTitle title="설정" />
      <Card>
        <p className="text-sm text-slate-600">현재 프로토타입은 기업 단일 콘솔 구조로 동작합니다.</p>
      </Card>
    </div>
  );
}
