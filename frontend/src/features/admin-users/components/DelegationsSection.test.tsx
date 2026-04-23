// UI sub-phase B — DelegationsSection.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

vi.mock('../api/usersAdmin', async () => {
  const actual = await vi.importActual<typeof import('../api/usersAdmin')>('../api/usersAdmin');
  return { ...actual, addDelegated: vi.fn(), patchDelegated: vi.fn() };
});

import { addDelegated, patchDelegated } from '../api/usersAdmin';
import { DelegationsSection } from './DelegationsSection';

function wrap(node: ReactNode) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={qc}>{node}</QueryClientProvider>);
}

beforeEach(() => {
  cleanup();
  vi.clearAllMocks();
  (addDelegated   as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 1 });
  (patchDelegated as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 1 });
});

describe('DelegationsSection', () => {
  it('adds a permission grant', async () => {
    wrap(<DelegationsSection userId={1} delegations={[]} />);
    fireEvent.change(screen.getByLabelText('delegation-code'), { target: { value: 'ASSIGN_LAWYER' } });
    fireEvent.submit(screen.getByTestId('admin-delegations-add-form'));
    await waitFor(() =>
      expect(addDelegated).toHaveBeenCalledWith(1, { code: 'ASSIGN_LAWYER', granted: true }),
    );
  });

  it('toggle granted triggers PATCH', async () => {
    wrap(
      <DelegationsSection
        userId={1}
        delegations={[{ id: 9, userId: 1, code: 'ASSIGN_LAWYER',
          granted: true, grantedByUserId: null, grantedAt: null }]}
      />,
    );
    fireEvent.click(screen.getByLabelText('toggle-ASSIGN_LAWYER'));
    await waitFor(() => expect(patchDelegated).toHaveBeenCalledWith(1, 9, { granted: false }));
  });
});

