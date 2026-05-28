import type { CompanyUser, OrganizationCategory, SourceFile } from "../domain/types";
import { UNASSIGNED_ORGANIZATION_CATEGORY_ID } from "../domain/types";

type OrganizationCategoryUsage = {
  companyUsers?: CompanyUser[];
  sourceFiles?: SourceFile[];
};

export function hasUnassignedOrganizationCategoryUsage({
  companyUsers = [],
  sourceFiles = []
}: OrganizationCategoryUsage): boolean {
  return [...companyUsers, ...sourceFiles].some(
    (item) => (item.organizationCategoryId ?? UNASSIGNED_ORGANIZATION_CATEGORY_ID) === UNASSIGNED_ORGANIZATION_CATEGORY_ID
  );
}

export function visibleOrganizationCategories(
  categories: OrganizationCategory[],
  usage: OrganizationCategoryUsage
): OrganizationCategory[] {
  const regularCategories = categories.filter((category) => category.id !== UNASSIGNED_ORGANIZATION_CATEGORY_ID);
  const unassignedCategory = categories.find((category) => category.id === UNASSIGNED_ORGANIZATION_CATEGORY_ID) ?? {
    id: UNASSIGNED_ORGANIZATION_CATEGORY_ID,
    name: "미지정"
  };

  return hasUnassignedOrganizationCategoryUsage(usage)
    ? [...regularCategories, unassignedCategory]
    : regularCategories;
}

export function organizationCategoryOptionsForSelection(
  categories: OrganizationCategory[],
  usage: OrganizationCategoryUsage,
  selectedCategoryId?: string
): OrganizationCategory[] {
  const visibleCategories = visibleOrganizationCategories(categories, usage);
  if (selectedCategoryId !== UNASSIGNED_ORGANIZATION_CATEGORY_ID) {
    return visibleCategories;
  }

  return visibleCategories.some((category) => category.id === UNASSIGNED_ORGANIZATION_CATEGORY_ID)
    ? visibleCategories
    : [
        ...visibleCategories,
        categories.find((category) => category.id === UNASSIGNED_ORGANIZATION_CATEGORY_ID) ?? {
          id: UNASSIGNED_ORGANIZATION_CATEGORY_ID,
          name: "미지정"
        }
      ];
}
