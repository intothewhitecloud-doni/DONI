import type { DomainTypeColor, DomainTypeDefinition, DomainTypePresetColor, DomainTypeScope } from "./types";

export const UNSPECIFIED_TYPE_LABEL = "미지정";
export const DEFAULT_TYPE_COLOR: DomainTypeColor = "slate";
export const DOMAIN_TYPE_COLORS: DomainTypePresetColor[] = ["blue", "orange", "pink", "violet", "emerald", "slate"];

export const domainTypeColorLabels: Record<DomainTypePresetColor, string> = {
  blue: "파랑",
  orange: "주황",
  pink: "분홍",
  violet: "보라",
  emerald: "초록",
  slate: "회색"
};

export const domainTypeColorHexValues: Record<DomainTypePresetColor, string> = {
  blue: "#2563eb",
  orange: "#fb923c",
  pink: "#ec4899",
  violet: "#8b5cf6",
  emerald: "#34d399",
  slate: "#64748b"
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

export function normalizeHexColor(color?: string): `#${string}` | undefined {
  const normalized = color?.trim();
  if (!normalized) {
    return undefined;
  }

  const candidate = normalized.startsWith("#") ? normalized : `#${normalized}`;
  if (/^#[0-9a-fA-F]{3}$/.test(candidate)) {
    const [, r, g, b] = candidate;
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase() as `#${string}`;
  }

  if (/^#[0-9a-fA-F]{6}$/.test(candidate)) {
    return candidate.toLowerCase() as `#${string}`;
  }

  return undefined;
}

export function isPresetTypeColor(color?: string): color is DomainTypePresetColor {
  return DOMAIN_TYPE_COLORS.includes(color as DomainTypePresetColor);
}

export function normalizeTypeColor(color?: string): DomainTypeColor {
  const normalized = color?.trim();
  if (isPresetTypeColor(normalized)) {
    return normalized;
  }

  return normalizeHexColor(normalized) ?? DEFAULT_TYPE_COLOR;
}

export function defaultTypeColor(indexOrLabel: number | string): DomainTypeColor {
  const colors = DOMAIN_TYPE_COLORS.filter((color) => color !== DEFAULT_TYPE_COLOR);
  const index =
    typeof indexOrLabel === "number"
      ? indexOrLabel
      : Array.from(normalizeTypeLabel(indexOrLabel)).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return colors[index % colors.length] ?? DEFAULT_TYPE_COLOR;
}

export function domainTypeColorHex(color?: string): string {
  const normalized = normalizeTypeColor(color);
  if (isPresetTypeColor(normalized)) {
    return domainTypeColorHexValues[normalized];
  }

  return normalized;
}

export function domainTypeColorDisplayLabel(color?: string): string {
  const normalized = normalizeTypeColor(color);
  return isPresetTypeColor(normalized) ? domainTypeColorLabels[normalized] : normalized.toUpperCase();
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
