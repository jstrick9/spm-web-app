/**
 * Helpers for SQLite's TEXT-as-JSON columns. Always go through these
 * so we have one place to handle malformed rows (logging, defaults).
 */
export function parseJson(raw, fallback) {
    if (!raw)
        return fallback;
    try {
        return JSON.parse(raw);
    }
    catch {
        return fallback;
    }
}
export function stringifyJson(value) {
    return JSON.stringify(value ?? {});
}
//# sourceMappingURL=json.js.map