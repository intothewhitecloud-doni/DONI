import { canonicalJson } from "./canonical-json";

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function sha256Hex(value: unknown): Promise<string> {
  const source = typeof value === "string" ? value : canonicalJson(value);
  const cryptoApi = globalThis.crypto?.subtle;

  if (!cryptoApi) {
    throw new Error("SHA256 계산을 위한 Web Crypto 환경을 찾을 수 없습니다.");
  }

  const digest = await cryptoApi.digest("SHA-256", new TextEncoder().encode(source));
  return toHex(digest);
}

