// Unit tests for the API error extraction helpers.

import { describe, it, expect } from 'vitest';
import { extractApiErrorMessage, extractApiErrorCode } from './apiError';

function axiosLikeError(body: unknown, axMessage?: string) {
  return {
    isAxiosError: true,
    message: axMessage,
    response: { status: 400, data: body },
  };
}

describe('extractApiErrorMessage', () => {
  it('prefers body.message when present', () => {
    const err = axiosLikeError({ code: 'X', message: 'حقل مطلوب' });
    expect(extractApiErrorMessage(err)).toBe('حقل مطلوب');
  });

  it('falls back to body.code when message is missing', () => {
    const err = axiosLikeError({ code: 'CONFLICT' });
    expect(extractApiErrorMessage(err)).toBe('CONFLICT');
  });

  it('falls back to axios message when body is empty', () => {
    const err = axiosLikeError({}, 'Network Error');
    expect(extractApiErrorMessage(err)).toBe('Network Error');
  });

  it('returns the default Arabic fallback for unknown error shapes', () => {
    expect(extractApiErrorMessage(undefined)).toBe('حدث خطأ غير متوقع');
    expect(extractApiErrorMessage(null)).toBe('حدث خطأ غير متوقع');
    expect(extractApiErrorMessage('string error')).toBe('حدث خطأ غير متوقع');
  });

  it('respects an explicit fallback override', () => {
    expect(extractApiErrorMessage(undefined, 'try again')).toBe('try again');
  });

  it('handles a partially-typed body where only code is set', () => {
    const err = axiosLikeError({ code: 'BAD_REQUEST', message: '' });
    // empty string is falsy → falls through to code
    expect(extractApiErrorMessage(err)).toBe('BAD_REQUEST');
  });
});

describe('extractApiErrorCode', () => {
  it('returns the code when present', () => {
    expect(extractApiErrorCode(axiosLikeError({ code: 'CONFLICT' }))).toBe('CONFLICT');
  });

  it('returns null when no code present', () => {
    expect(extractApiErrorCode(axiosLikeError({ message: 'oops' }))).toBeNull();
  });

  it('returns null for malformed errors', () => {
    expect(extractApiErrorCode(undefined)).toBeNull();
    expect(extractApiErrorCode(null)).toBeNull();
    expect(extractApiErrorCode('weird')).toBeNull();
  });
});
