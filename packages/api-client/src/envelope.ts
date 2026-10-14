/**
 * pluto-server wraps every response through `TransformInterceptor`
 * (`apps/server/src/common/interceptors/transform.interceptor.ts`) and every
 * error through `AllExceptionsFilter`.
 *
 * IMPORTANT: the generated OpenAPI schema documents the *inner* payload (e.g.
 * `PaginatedExpensesResponseDto`), not this envelope — see
 * `internal/mobile-plan.md` "Phase 2 blocker A". The client is therefore
 * responsible for unwrapping, which is exactly what `unwrapEnvelope` does.
 */

export interface ApiEnvelope<T> {
  success: true;
  data: T;
  timestamp: string;
}

export interface ApiErrorEnvelope {
  success: false;
  statusCode: number;
  path: string;
  method: string;
  error: string | string[] | Record<string, unknown>;
  timestamp: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** True when a decoded body looks like the success envelope. */
export function isEnvelope(value: unknown): value is ApiEnvelope<unknown> {
  return isRecord(value) && value.success === true && 'data' in value;
}

/** Returns the payload inside the envelope, or the value unchanged. */
export function unwrapEnvelope<T>(value: unknown): T {
  return (isEnvelope(value) ? value.data : value) as T;
}

/** Best-effort message extraction from an error envelope, mirroring the web client. */
export function extractErrorMessage(body: unknown, fallback = 'Request failed.'): string {
  if (!isRecord(body)) return fallback;

  const { error } = body as Partial<ApiErrorEnvelope>;
  if (typeof error === 'string') return error;
  if (Array.isArray(error)) return error.join(' ');
  if (isRecord(error)) {
    const messages = Object.values(error)
      .flat()
      .map(String)
      .filter(Boolean);
    if (messages.length > 0) return messages.join(' ');
  }
  return fallback;
}
