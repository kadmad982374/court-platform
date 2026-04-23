// Unit tests for the RequireAuth route guard.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { RequireAuth } from './RequireAuth';

const mockUseAuth = vi.fn();

vi.mock('./AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

function renderAt(path: string, anyOf?: readonly string[]) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<RequireAuth anyOf={anyOf as never} />}>
          <Route path="/protected" element={<div>protected-content</div>} />
        </Route>
        <Route path="/login" element={<div>login-page</div>} />
        <Route path="/dashboard" element={<div>dashboard-page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  mockUseAuth.mockReset();
});

describe('RequireAuth', () => {
  it('renders a splash spinner while bootstrapping', () => {
    mockUseAuth.mockReturnValue({ status: 'bootstrapping', hasAnyRole: () => false });
    renderAt('/protected');
    expect(screen.getByRole('status')).toBeTruthy();
    expect(screen.queryByText('protected-content')).toBeNull();
  });

  it('redirects anonymous users to /login', () => {
    mockUseAuth.mockReturnValue({ status: 'anonymous', hasAnyRole: () => false });
    renderAt('/protected');
    expect(screen.getByText('login-page')).toBeTruthy();
  });

  it('renders the outlet when authenticated and no role gate', () => {
    mockUseAuth.mockReturnValue({ status: 'authenticated', hasAnyRole: () => true });
    renderAt('/protected');
    expect(screen.getByText('protected-content')).toBeTruthy();
  });

  it('redirects to /dashboard when role gate is not satisfied', () => {
    mockUseAuth.mockReturnValue({ status: 'authenticated', hasAnyRole: () => false });
    renderAt('/protected', ['ADMIN_CLERK']);
    expect(screen.getByText('dashboard-page')).toBeTruthy();
  });

  it('renders the outlet when role gate is satisfied', () => {
    const hasAnyRole = vi.fn().mockReturnValue(true);
    mockUseAuth.mockReturnValue({ status: 'authenticated', hasAnyRole });
    renderAt('/protected', ['ADMIN_CLERK']);
    expect(screen.getByText('protected-content')).toBeTruthy();
    expect(hasAnyRole).toHaveBeenCalledWith(['ADMIN_CLERK']);
  });
});


