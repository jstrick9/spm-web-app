/**
 * Standard error shape. Routes throw these; the global error handler
 * (in src/index.ts) converts them to clean JSON responses.
 *
 * Every error has a stable string `code` so the client can branch on
 * it without parsing prose messages.
 */
export class HttpError extends Error {
    statusCode;
    code;
    details;
    constructor(statusCode, code, message, details) {
        super(message ?? code);
        this.statusCode = statusCode;
        this.code = code;
        this.details = details;
        this.name = 'HttpError';
    }
}
export const BadRequest = (code, details) => new HttpError(400, code, undefined, details);
export const Unauthorized = (code = 'unauthenticated') => new HttpError(401, code);
export const Forbidden = (code = 'forbidden') => new HttpError(403, code);
export const NotFound = (code = 'not-found') => new HttpError(404, code);
export const Conflict = (code, details) => new HttpError(409, code, undefined, details);
export const ServerError = (code = 'internal-error') => new HttpError(500, code);
//# sourceMappingURL=errors.js.map