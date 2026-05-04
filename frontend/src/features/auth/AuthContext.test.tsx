// Unit tests for the AuthProvider / useAuth context.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from './AuthContext';
import { tokenStorage } from '@/shared/lib/tokenStorage';

const mockFetchCurrentUser = vi.fn();
const mockLogin = vi.fn();
const mockLogout = vi.fn();

vi.mock('./api', () => ({
  fetchCurrentUser: (...args: unknown[]) => mockFetchCurrentUser(...args),
  login: (...args: unknown[]) => mockLogin(...args),
  logout: (...args: unknown[]) => mockLogout(...args),
}));

function Probe() {
  const { status, user, hasAnyRole, login, logout } = useAuth();
  return (
    <div>
      <div data-testid="status">{status}</div>
      <div data-testid="user">{user ? user.username : 'none'}</div>
      <div data-testid="role-yes">{String(hasAnyRole(['STATE_LAWYER']))}</div>
      <div data-testid="role-empty">{String(hasAnyRole([]))}</div>
      <button data-testid="login" onClick={() => login('alice', 'pw')}>
        login
      </button>
      <button data-testid="logout" onClick={() => logout()}>
        logout
      </button>
    </div>
  );
}

beforeEach(() => {
  mockFetchCurrentUser.mockReset();
  mockLogin.mockReset();
  mockLogout.mockReset();
  tokenStorage.clear();
});

describe('AuthProvider bootstrap', () => {
  it('resolves to anonymous when no tokens are stored', async () => {
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('anonymous'));
    expect(mockFetchCurrentUser).not.toHaveBeenCalled();
  });

  it('resolves to authenticated when tokens exist and /users/me returns', async () => {
    tokenStorage.set({ accessToken: 'a', refreshToken: 'r' });
    mockFetchCurrentUser.mockResolvedValueOnce({
      id: 1,
      username: 'alice',
      fullName: 'Alice',
      mobileNumber: null,
      isActive: true,
      mustChangePassword: false,
      roles: ['STATE_LAWYER'],
    });

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('authenticated'));
    expect(screen.getByTestId('user').textContent).toBe('alice');
    expect(screen.getByTestId('role-yes').textContent).toBe('true');
    expect(screen.getByTestId('role-empty').textContent).toBe('true'); // empty roles list always passes
  });

  it('falls back to anonymous and clears tokens when /users/me throws', async () => {
    tokenStorage.set({ accessToken: 'a', refreshToken: 'r' });
    mockFetchCurrentUser.mockRejectedValueOnce(new Error('boom'));

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('anonymous'));
    expect(tokenStorage.get()).toBeNull();
  });
});

describe('AuthProvider login / logout', () => {
  it('login calls api.login then refetches the user', async () => {
    // Real api.login both POSTs and stashes tokens via tokenStorage.set; mirror that
    // so the subsequent loadUser sees tokens and calls fetchCurrentUser.
    mockLogin.mockImplementationOnce(async () => {
      tokenStorage.set({ accessToken: 'a', refreshToken: 'r' });
    });
    mockFetchCurrentUser.mockResolvedValueOnce({
      id: 7,
      username: 'bob',
      fullName: 'Bob',
      mobileNumber: null,
      isActive: true,
      mustChangePassword: false,
      roles: ['ADMIN_CLERK'],
    });

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('anonymous'));

    await act(async () => {
      screen.getByTestId('login').click();
    });

    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('authenticated'));
    expect(mockLogin).toHaveBeenCalledWith('alice', 'pw');
    expect(screen.getByTestId('user').textContent).toBe('bob');
  });

  it('logout calls api.logout and resets state to anonymous', async () => {
    tokenStorage.set({ accessToken: 'a', refreshToken: 'r' });
    mockFetchCurrentUser.mockResolvedValueOnce({
      id: 1,
      username: 'alice',
      fullName: 'Alice',
      mobileNumber: null,
      isActive: true,
      mustChangePassword: false,
      roles: ['STATE_LAWYER'],
    });
    mockLogout.mockResolvedValueOnce(undefined);

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('authenticated'));

    await act(async () => {
      screen.getByTestId('logout').click();
    });

    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('anonymous'));
    expect(mockLogout).toHaveBeenCalled();
    expect(screen.getByTestId('user').textContent).toBe('none');
  });
});

describe('AuthProvider cross-tab sync', () => {
  it('signs out when tokenStorage subscribers fire with no access token', async () => {
    tokenStorage.set({ accessToken: 'a', refreshToken: 'r' });
    mockFetchCurrentUser.mockResolvedValueOnce({
      id: 1,
      username: 'alice',
      fullName: 'Alice',
      mobileNumber: null,
      isActive: true,
      mustChangePassword: false,
      roles: ['STATE_LAWYER'],
    });

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('authenticated'));

    // Simulate another tab clearing tokens.
    await act(async () => {
      tokenStorage.clear();
    });

    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('anonymous'));
  });
});

describe('useAuth outside provider', () => {
  it('throws a clear error when used without AuthProvider', () => {
    function Bad() {
      useAuth();
      return null;
    }
    // Suppress console.error from React
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Bad />)).toThrow(/useAuth must be used inside <AuthProvider>/);
    spy.mockRestore();
  });
});
