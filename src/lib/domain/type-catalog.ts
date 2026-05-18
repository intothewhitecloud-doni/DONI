import type { DomainTypeColor, DomainTypeDefinition, DomainTypeScope } from "./types";

export const UNSPECIFIED_TYPE_LABEL = "미지정";
export const DEFAULT_TYPE_COLOR: DomainTypeColor = "slate";
export const DOMAIN_TYPE_COLORS: DomainTypeColor[] = ["blue", "orange", "pink", "violet", "emerald", "slate"];

export const domainTypeColorLabels: Record<DomainTypeColor, string> = {
  blue: "파랑",
  orange: "주황",
  pink: "분홍",
  violet: "보라",
  emerald: "초록",
  slate: "회색"
};

export function normalizeTypeLabel(label: string): string {
  return label.trim().replace(/\s+/g, " ");
}

export function displayTypeLabel(label?: string): string {
  const normalized = normalizeTypeLabel(label ?? "");
  return normalized || UNSPECIFIED_TYPE_LABEL;
}

export function domainTypeId(scope: DomainTypeScope, label: string, existingIds: string[] = []): string {
  const stem =
    normalizeTypeLabel(label)
      .toLowerCase()
      .replace(/[^a-z0-9가-힣]+/g, "-")
      .replace(/^-|-$/g, "") || "unspecified";
  const prefix = scope === "managed_object" ? "managed-type" : "workflow-type";
  const baseId = `${prefix}-${stem}`;
  if (!existingIds.includes(baseId)) {
    return baseId;
  }

  let index = 2;
  while (existingIds.includes(`${baseId}-${index}`)) {
    index += 1;
  }
  return `${baseId}-${index}`;
}

export function normalizeTypeColor(color?: string): DomainTypeColor {
  return DOMAIN_TYPE_COLORS.includes(color as DomainTypeColor) ? (color as DomainTypeColor) : DEFAULT_TYPE_COLOR;
}

export function defaultTypeColor(indexOrLabel: number | string): DomainTypeColor {
  const colors = DOMAIN_TYPE_COLORS.filter((color) => color !== DEFAULT_TYPE_COLOR);
  const index =
    typeof indexOrLabel === "number"
      ? indexOrLabel
      : Array.from(normalizeTypeLabel(indexOrLabel)).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return colors[index % colors.length] ?? DEFAULT_TYPE_COLOR;
}

function normalizeCatalogColor(color: string | undefined, index: number): DomainTypeColor {
  return color ? normalizeTypeColor(color) : defaultTypeColor(index);
}

export function normalizeDomainTypeDefinition(type: DomainTypeDefinition, index = 0): DomainTypeDefinition {
  return {
    ...type,
    label: normalizeTypeLabel(type.label),
    color: normalizeCatalogColor(type.color, index)
  };
}

export function normalizeDomainTypeCatalog(types: DomainTypeDefinition[], scope: DomainTypeScope): DomainTypeDefinition[] {
  const existingIds: string[] = [];
  const normalized: DomainTypeDefinition[] = [];

  for (const [index, type] of types.entries()) {
    const label = normalizeTypeLabel(type.label);
    if (!label) {
      continue;
    }

    const id = type.id || domainTypeId(scope, label, existingIds);
    existingIds.push(id);
    normalized.push(
      normalizeDomainTypeDefinition(
        {
          ...type,
          id,
          scope,
          label,
          color: normalizeCatalogColor(type.color, index)
        },
        index
      )
    );
  }

  return normalized;
}
