/**
 * Helpers for SQLite's TEXT-as-JSON columns. Always go through these
 * so we have one place to handle malformed rows (logging, defaults).
 */

export function parseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function stringifyJson(value: unknown): string {
  return JSON.stringify(value ?? {});
}
