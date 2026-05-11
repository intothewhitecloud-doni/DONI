type JsonLike = null | boolean | number | string | JsonLike[] | { [key: string]: JsonLike | undefined };

function normalize(value: unknown): JsonLike | undefined {
  if (value === undefined || typeof value === "function" || typeof value === "symbol") {
    return undefined;
  }

  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return value;
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      return null;
    }

    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => {
      const normalized = normalize(item);
      return normalized === undefined ? null : normalized;
    });
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const sorted: Record<string, JsonLike> = {};

    for (const key of Object.keys(record).sort()) {
      const normalized = normalize(record[key]);
      if (normalized !== undefined) {
        sorted[key] = normalized;
      }
    }

    return sorted;
  }

  return String(value);
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(normalize(value));
}

