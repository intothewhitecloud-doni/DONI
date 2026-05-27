"use client";

import { useMemo, useState } from "react";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card, SectionTitle } from "../../components/ui/Card";
import { Popup } from "../../components/ui/Popup";
import type { CompanyUser, CompanyUserStatus } from "../../lib/domain/types";
import { UNASSIGNED_ORGANIZATION_CATEGORY_ID } from "../../lib/domain/types";
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

export function CompanyManagementScreen() {
  const { commands, state } = usePrototype();
  const actor = currentCompanyUser(state);
  const canManage = actor?.role === "owner" && actor.status === "active";
  const [companyName, setCompanyName] = useState(state.company.name);
  const [statusFilter, setStatusFilter] = useState<CompanyUserStatus | "all">("all");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [editingCategoryId, setEditingCategoryId] = useState("");
  const [editingCategoryName, setEditingCategoryName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<CompanyUser | undefined>();

  const users = useMemo(
    () => state.companyUsers.filter((companyUser) => statusFilter === "all" || companyUser.status === statusFilter),
    [state.companyUsers, statusFilter]
  );

  function saveCompany() {
    commands.updateCompanyProfile({ name: companyName });
  }

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

  function confirmDeleteAccount() {
    if (deleteTarget && commands.deleteCompanyUserAccount(deleteTarget.id)) {
      setDeleteTarget(undefined);
    }
  }

  return (
    <div className="space-y-8">
      <SectionTitle
        eyebrow="기업 관리"
        title="기업 정보, 사용자, 조직 카테고리"
        description="조직은 권한이 아니라 분류/표시용 카테고리입니다. 기업 관리자는 이 화면을 조회만 할 수 있습니다."
      />

      <Card className="space-y-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <p className="text-caption text-muted">기업 정보</p>
            <label className="block text-sm font-medium text-slate-700">
              기업명
              <input
                className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 md:w-96"
                disabled={!canManage}
                value={companyName}
                onChange={(event) => setCompanyName(event.target.value)}
              />
            </label>
          </div>
          {canManage && <Button onClick={saveCompany}>기업 정보 저장</Button>}
        </div>
        <div className="flex flex-wrap items-center gap-3 rounded-md bg-surface-soft p-4">
          <div>
            <p className="text-caption text-muted">회사코드</p>
            <p className="font-mono text-title-sm text-ink">{state.company.code}</p>
          </div>
          {canManage && <Button variant="secondary" onClick={commands.regenerateCompanyCode}>새 코드 발급</Button>}
        </div>
      </Card>

      <Card className="space-y-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <SectionTitle
            eyebrow="사용자 관리"
            title="기업 사용자"
            description="계정 삭제는 이 기업 콘솔의 사용자 계정 자체를 제거합니다. 과거 기록에는 이름/역할 스냅샷이 남습니다."
          />
          <div className="flex flex-wrap gap-2">
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
        <div className="overflow-x-auto rounded-lg border border-hairline">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="bg-surface-soft text-caption text-muted">
              <tr>
                <th className="px-4 py-3">사용자</th>
                <th className="px-4 py-3">역할</th>
                <th className="px-4 py-3">상태</th>
                <th className="px-4 py-3">조직</th>
                <th className="px-4 py-3">직책</th>
                <th className="px-4 py-3">관리</th>
              </tr>
            </thead>
            <tbody>
              {users.map((companyUser) => (
                <CompanyUserRow
                  key={companyUser.id}
                  canManage={canManage}
                  companyUser={companyUser}
                  isCurrentUser={companyUser.userId === state.session.currentUserId}
                  onDelete={() => setDeleteTarget(companyUser)}
                />
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="space-y-5">
        <SectionTitle
          eyebrow="조직 카테고리"
          title="분류/표시용 조직"
          description="조직은 이름만 관리합니다. 삭제하면 연결된 사용자와 파일이 미지정으로 이동합니다."
        />
        {canManage && (
          <div className="flex flex-col gap-2 md:flex-row">
            <input
              className="flex-1 rounded-md border border-slate-200 px-3 py-2"
              placeholder="새 조직 이름"
              value={newCategoryName}
              onChange={(event) => setNewCategoryName(event.target.value)}
            />
            <Button onClick={addCategory}>조직 추가</Button>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          {state.organizationCategories.map((category) => (
            <div key={category.id} className="flex items-center gap-2 rounded-full border border-hairline bg-white px-3 py-2">
              {editingCategoryId === category.id ? (
                <>
                  <input
                    className="w-40 rounded-md border border-slate-200 px-2 py-1 text-sm"
                    value={editingCategoryName}
                    onChange={(event) => setEditingCategoryName(event.target.value)}
                  />
                  <button className="whitespace-nowrap text-button text-primary" onClick={submitCategoryEdit}>저장</button>
                  <button className="whitespace-nowrap text-button text-muted" onClick={() => setEditingCategoryId("")}>취소</button>
                </>
              ) : (
                <>
                  <Badge tone={category.id === UNASSIGNED_ORGANIZATION_CATEGORY_ID ? "neutral" : "info"}>{category.name}</Badge>
                  {canManage && category.id !== UNASSIGNED_ORGANIZATION_CATEGORY_ID && (
                    <>
                      <button className="whitespace-nowrap text-button text-primary" onClick={() => startCategoryEdit(category.id, category.name)}>수정</button>
                      <button className="whitespace-nowrap text-button text-error" onClick={() => commands.deleteOrganizationCategory(category.id)}>삭제</button>
                    </>
                  )}
                </>
              )}
            </div>
          ))}
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
  const [title, setTitle] = useState(companyUser.title);
  const [organizationCategoryId, setOrganizationCategoryId] = useState(companyUser.organizationCategoryId);
  const category = state.organizationCategories.find((item) => item.id === companyUser.organizationCategoryId);
  const editable = canManage && !isCurrentUser && companyUser.role !== "owner" && companyUser.status === "active";
  const pendingEditable = canManage && !isCurrentUser && companyUser.status === "pending";

  function save() {
    commands.updateCompanyUser({ companyUserId: companyUser.id, role: companyUser.role, title, organizationCategoryId });
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
          <select className="rounded-md border border-slate-200 px-2 py-1" value={organizationCategoryId} onChange={(event) => setOrganizationCategoryId(event.target.value)}>
            {state.organizationCategories.map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </select>
        ) : (
          <Badge tone="neutral">{category?.name ?? "미지정"}</Badge>
        )}
      </td>
      <td className="px-4 py-3">
        {editable ? (
          <input className="w-40 rounded-md border border-slate-200 px-2 py-1" value={title} onChange={(event) => setTitle(event.target.value)} />
        ) : (
          companyUser.title || "미지정"
        )}
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-nowrap gap-2">
          {editable && <Button onClick={save}>저장</Button>}
          {pendingEditable && <Button onClick={() => commands.approveCompanyUser(companyUser.id)}>승인</Button>}
          {pendingEditable && <Button variant="secondary" onClick={() => commands.rejectCompanyUser(companyUser.id)}>반려</Button>}
          {canManage && !isCurrentUser && companyUser.role !== "owner" && <Button variant="danger" onClick={onDelete}>삭제</Button>}
          {!canManage && <span className="text-caption text-muted">조회 전용</span>}
        </div>
      </td>
    </tr>
  );
}

export function SettingsScreen() {
  return (
    <div className="space-y-6">
      <SectionTitle eyebrow="설정" title="콘솔 설정" description="알림, 저장소, 화면 표시 옵션은 이후 단계에서 확장합니다." />
      <Card>
        <p className="text-sm text-slate-600">현재 프로토타입은 기업 단일 콘솔 구조로 동작합니다.</p>
      </Card>
    </div>
  );
}
