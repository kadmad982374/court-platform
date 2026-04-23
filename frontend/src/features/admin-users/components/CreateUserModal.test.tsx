// UI sub-phase B — CreateUserModal validation + submit.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';

vi.mock('../api/usersAdmin', async () => {
  const actual = await vi.importActual<typeof import('../api/usersAdmin')>('../api/usersAdmin');
  return { ...actual, createUser: vi.fn() };
});

import { createUser } from '../api/usersAdmin';
import { CreateUserModal } from './CreateUserModal';

function wrap(node: ReactNode) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={qc}>{node}</QueryClientProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  cleanup();
  vi.clearAllMocks();
  (createUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 99 });
});

function fill(form: HTMLElement, values: { username?: string; fullName?: string; mobile?: string; password?: string }) {
  const inputs = form.querySelectorAll('input');
  // 0: username, 1: fullName, 2: mobile, 3: password, 4: active checkbox
  if (values.username !== undefined) fireEvent.change(inputs[0]!, { target: { value: values.username } });
  if (values.fullName !== undefined) fireEvent.change(inputs[1]!, { target: { value: values.fullName } });
  if (values.mobile   !== undefined) fireEvent.change(inputs[2]!, { target: { value: values.mobile } });
  if (values.password !== undefined) fireEvent.change(inputs[3]!, { target: { value: values.password } });
}

describe('CreateUserModal', () => {
  it('rejects malformed mobile number', async () => {
    wrap(<CreateUserModal open onClose={() => {}} />);
    const form = screen.getByTestId('admin-user-form');
    fill(form, { username: 'abc', fullName: 'فلان', mobile: '0123456789', password: 'Strong#1234' });
    fireEvent.submit(form);
    await waitFor(() => {
      expect(screen.getByText(/الصيغة: 09XXXXXXXX/)).toBeTruthy();
    });
    expect(createUser).not.toHaveBeenCalled();
  });

  it('rejects forbidden seed password "ChangeMe!2026"', async () => {
    wrap(<CreateUserModal open onClose={() => {}} />);
    const form = screen.getByTestId('admin-user-form');
    fill(form, { username: 'abc', fullName: 'فلان', mobile: '0912345678', password: 'ChangeMe!2026' });
    fireEvent.submit(form);
    await waitFor(() => {
      expect(screen.getByText(/افتراضية محظورة/)).toBeTruthy();
    });
    expect(createUser).not.toHaveBeenCalled();
  });

  it('rejects too-short password', async () => {
    wrap(<CreateUserModal open onClose={() => {}} />);
    const form = screen.getByTestId('admin-user-form');
    fill(form, { username: 'abc', fullName: 'فلان', mobile: '0912345678', password: 'short' });
    fireEvent.submit(form);
    await waitFor(() => {
      expect(screen.getByText(/لا يقل عن 8 أحرف/)).toBeTruthy();
    });
    expect(createUser).not.toHaveBeenCalled();
  });

  it('submits a valid payload to createUser', async () => {
    const onClose = vi.fn();
    wrap(<CreateUserModal open onClose={onClose} />);
    const form = screen.getByTestId('admin-user-form');
    fill(form, { username: 'abc', fullName: 'فلان فلاني', mobile: '0912345678', password: 'Strong#1234' });
    fireEvent.submit(form);
    await waitFor(() => {
      expect(createUser).toHaveBeenCalledWith({
        username: 'abc',
        fullName: 'فلان فلاني',
        mobileNumber: '0912345678',
        initialPassword: 'Strong#1234',
        active: true,
      });
    });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('surfaces a backend error message', async () => {
    (createUser as ReturnType<typeof vi.fn>).mockRejectedValueOnce({
      response: { data: { code: 'USERNAME_TAKEN', message: 'اسم المستخدم مستخدم بالفعل' } },
    });
    wrap(<CreateUserModal open onClose={() => {}} />);
    const form = screen.getByTestId('admin-user-form');
    fill(form, { username: 'abc', fullName: 'فلان فلاني', mobile: '0912345678', password: 'Strong#1234' });
    fireEvent.submit(form);
    await waitFor(() => {
      expect(screen.getByTestId('admin-user-create-error').textContent).toMatch(/مستخدم بالفعل/);
    });
  });
});

