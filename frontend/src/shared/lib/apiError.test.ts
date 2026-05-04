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
  // PR-7: Arabic translation by error code is the priority.
  it('translates a known code to Arabic, ignoring the English server message', () => {
    const err = axiosLikeError({
      code: 'INVALID_CREDENTIALS',
      message: 'Invalid credentials',
    });
    expect(extractApiErrorMessage(err)).toBe('بيانات الدخول غير صحيحة.');
  });

  it('translates DISALLOWED_FILE_TYPE to its full Arabic explanation', () => {
    const err = axiosLikeError({
      code: 'DISALLOWED_FILE_TYPE',
      message: 'Only PDF, DOCX, XLSX, PNG, and JPEG files are accepted',
    });
    expect(extractApiErrorMessage(err)).toContain('PDF');
    expect(extractApiErrorMessage(err)).toContain('غير مدعوم');
  });

  it('falls back to body.message for unknown codes (developer-readable)', () => {
    const err = axiosLikeError({
      code: 'SOME_UNMAPPED_CODE',
      message: 'حقل مطلوب',
    });
    expect(extractApiErrorMessage(err)).toBe('حقل مطلوب');
  });

  it('falls back to body.code when both translation and message are missing', () => {
    const err = axiosLikeError({ code: 'STILL_UNMAPPED' });
    expect(extractApiErrorMessage(err)).toBe('STILL_UNMAPPED');
  });

  it('falls back to axios message when body is empty', () => {
    const err = axiosLikeError({}, 'Network Error');
    expect(extractApiErrorMessage(err)).toBe('Network Error');
  });

  it('returns the default Arabic fallback for unknown error shapes', () => {
    expect(extractApiErrorMessage(undefined)).toBe('حدث خطأ غير متوقع.');
    expect(extractApiErrorMessage(null)).toBe('حدث خطأ غير متوقع.');
    expect(extractApiErrorMessage('string error')).toBe('حدث خطأ غير متوقع.');
  });

  it('respects an explicit fallback override (used as the contextual hint)', () => {
    expect(extractApiErrorMessage(undefined, 'تعذّر تحميل التقدم.'))
      .toBe('تعذّر تحميل التقدم.');
  });

  it('handles a partially-typed body where only code is set and unmapped', () => {
    const err = axiosLikeError({ code: 'BAD_REQUEST', message: '' });
    // BAD_REQUEST isn't in the Arabic map; empty message is falsy → falls through to code.
    expect(extractApiErrorMessage(err)).toBe('BAD_REQUEST');
  });

  it('translation wins over message even when the message is a non-empty English string', () => {
    const err = axiosLikeError({
      code: 'ACCOUNT_LOCKED',
      message: 'Account is temporarily locked. Try again later.',
    });
    const result = extractApiErrorMessage(err);
    expect(result).not.toContain('Account');
    expect(result).toContain('مقفل');
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
