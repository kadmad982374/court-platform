// Phase 2 (#3) — تحت الرفع typed-client URL/params/body assertions.

import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/shared/api/http', () => {
  const get = vi.fn();
  const post = vi.fn();
  const put = vi.fn();
  return { http: { get, post, put } };
});

import { http } from '@/shared/api/http';
import {
  listPendingSubmissions,
  createPendingSubmission,
  updatePendingSubmission,
  type CreatePendingSubmissionRequest,
} from './api';

const mock = (fn: unknown) => fn as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  mock(http.get).mockResolvedValue({ data: { content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 } });
  mock(http.post).mockResolvedValue({ data: { id: 1 } });
  mock(http.put).mockResolvedValue({ data: { id: 1 } });
});

const body: CreatePendingSubmissionRequest = {
  branchId: 1, departmentId: 2,
  incomingNumber: '2026/534', letterNumber: '1342/ص',
  publicEntityName: 'السورية للاتصالات', opponentName: 'سمير بدور',
  subject: 'ترك عمل', notes: 'تحت رفع صلح',
};

describe('listPendingSubmissions', () => {
  it('GETs /pending-submissions with default page/size and no q', async () => {
    await listPendingSubmissions();
    const [url, opts] = mock(http.get).mock.calls[0];
    expect(url).toBe('/pending-submissions');
    expect(opts.params).toEqual({ page: 0, size: 20 });
  });

  it('includes a trimmed q and custom paging', async () => {
    await listPendingSubmissions({ q: '  السورية  ', page: 2, size: 5 });
    const [, opts] = mock(http.get).mock.calls[0];
    expect(opts.params).toEqual({ page: 2, size: 5, q: 'السورية' });
  });

  it('drops a blank/whitespace-only q', async () => {
    await listPendingSubmissions({ q: '   ' });
    const [, opts] = mock(http.get).mock.calls[0];
    expect(opts.params.q).toBeUndefined();
  });

  it('returns the response data envelope', async () => {
    const res = await listPendingSubmissions();
    expect(res).toEqual({ content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 });
  });
});

describe('create / update', () => {
  it('createPendingSubmission → POST /pending-submissions with body', async () => {
    await createPendingSubmission(body);
    expect(http.post).toHaveBeenCalledWith('/pending-submissions', body);
  });

  it('updatePendingSubmission → PUT /pending-submissions/{id} with body', async () => {
    await updatePendingSubmission(7, body);
    expect(http.put).toHaveBeenCalledWith('/pending-submissions/7', body);
  });
});
