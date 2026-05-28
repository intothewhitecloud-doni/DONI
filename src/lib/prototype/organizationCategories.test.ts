import assert from "node:assert/strict";
import test from "node:test";
import type { CompanyUser, OrganizationCategory, SourceFile } from "../domain/types";
import { UNASSIGNED_ORGANIZATION_CATEGORY_ID } from "../domain/types";
import {
  organizationCategoryOptionsForSelection,
  visibleOrganizationCategories
} from "./organizationCategories";

const categories: OrganizationCategory[] = [
  { id: UNASSIGNED_ORGANIZATION_CATEGORY_ID, name: "미지정" },
  { id: "org-operations", name: "운영" },
  { id: "org-supply", name: "공급망" }
];

test("visible organization categories keep unassigned last when used", () => {
  const sourceFiles: SourceFile[] = [
    {
      id: "source-unassigned",
      kind: "표 형식 데이터",
      name: "미분류.csv",
      rowCount: 1,
      status: "ready",
      organizationCategoryId: UNASSIGNED_ORGANIZATION_CATEGORY_ID
    }
  ];

  assert.deepEqual(
    visibleOrganizationCategories(categories, { sourceFiles }).map((category) => category.name),
    ["운영", "공급망", "미지정"]
  );
});

test("visible organization categories hide unassigned when it has no usage", () => {
  const companyUsers: CompanyUser[] = [
    {
      id: "company-user-manager",
      name: "김도현",
      role: "manager",
      status: "active",
      title: "운영 리드",
      userId: "user-manager",
      organizationCategoryId: "org-operations"
    }
  ];

  assert.deepEqual(
    visibleOrganizationCategories(categories, { companyUsers }).map((category) => category.name),
    ["운영", "공급망"]
  );
});

test("organization category selection preserves a current unassigned value", () => {
  assert.deepEqual(
    organizationCategoryOptionsForSelection(categories, {}, UNASSIGNED_ORGANIZATION_CATEGORY_ID).map((category) => category.name),
    ["운영", "공급망", "미지정"]
  );
});
