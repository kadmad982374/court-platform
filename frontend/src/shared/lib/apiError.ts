import { AxiosError } from 'axios';
import type { ApiErrorBody } from '@/shared/types/domain';

/** Extract a user-facing Arabic message from an arbitrary error. */
export function extractApiErrorMessage(err: unknown, fallback = 'حدث خطأ غير متوقع'): string {
  const ax = err as AxiosError<ApiErrorBody> | undefined;
  const body = ax?.response?.data;
  if (body?.message) return body.message;
  if (body?.code)    return body.code;
  if (ax?.message)   return ax.message;
  return fallback;
}

export function extractApiErrorCode(err: unknown): string | null {
  const ax = err as AxiosError<ApiErrorBody> | undefined;
  return ax?.response?.data?.code ?? null;
}

