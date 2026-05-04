import { AxiosError } from 'axios';
import type { ApiErrorBody } from '@/shared/types/domain';
import { AR_ERROR_MESSAGES } from './errorMessages.ar';

/**
 * Extract a user-facing **Arabic** message from an arbitrary error.
 *
 * Resolution order (PR-7):
 *   1. Translated Arabic message keyed by the backend's stable error CODE.
 *   2. The English `body.message` from the server (developer-targeted; shown
 *      only as a last resort so unknown codes still surface SOMETHING readable).
 *   3. The bare `body.code` if there's no message.
 *   4. The axios `error.message` (network failure, timeout, ...).
 *   5. The caller-supplied Arabic `fallback`.
 */
export function extractApiErrorMessage(err: unknown, fallback = 'حدث خطأ غير متوقع.'): string {
  const ax = err as AxiosError<ApiErrorBody> | undefined;
  const body = ax?.response?.data;
  if (body?.code) {
    const ar = AR_ERROR_MESSAGES[body.code];
    if (ar) return ar;
  }
  if (body?.message) return body.message;
  if (body?.code)    return body.code;
  if (ax?.message)   return ax.message;
  return fallback;
}

export function extractApiErrorCode(err: unknown): string | null {
  const ax = err as AxiosError<ApiErrorBody> | undefined;
  return ax?.response?.data?.code ?? null;
}

