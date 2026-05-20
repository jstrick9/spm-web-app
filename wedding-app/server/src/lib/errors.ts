/**
 * Standard error shape. Routes throw these; the global error handler
 * (in src/index.ts) converts them to clean JSON responses.
 *
 * Every error has a stable string `code` so the client can branch on
 * it without parsing prose messages.
 */

export class HttpError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message?: string,
    public details?: unknown,
  ) {
    super(message ?? code);
    this.name = 'HttpError';
  }
}

export const BadRequest    = (code: string, details?: unknown) => new HttpError(400, code, undefined, details);
export const Unauthorized  = (code = 'unauthenticated')         => new HttpError(401, code);
export const Forbidden     = (code = 'forbidden')               => new HttpError(403, code);
export const NotFound      = (code = 'not-found')               => new HttpError(404, code);
export const Conflict      = (code: string, details?: unknown)  => new HttpError(409, code, undefined, details);
export const ServerError   = (code = 'internal-error')          => new HttpError(500, code);
