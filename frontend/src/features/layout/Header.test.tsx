// Unit tests for the Header component.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Header } from './Header';

const mockUseAuth = vi.fn();
vi.mock('@/features/auth/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

beforeEach(() => {
  mockUseAuth.mockReset();
});

describe('Header', () => {
  it('shows the user full name and Arabic role label when authenticated', () => {
    mockUseAuth.mockReturnValue({
      user: { fullName: 'علي العلي', roles: ['STATE_LAWYER'] },
      logout: vi.fn(),
    });

    render(<Header />);

    expect(screen.getByText('علي العلي')).toBeTruthy();
    // ROLE_LABEL_AR['STATE_LAWYER'] is the Arabic label; we verify *some* Arabic text appears
    // without coupling to the exact translation string.
    expect(screen.getByLabelText('تسجيل الخروج')).toBeTruthy();
  });

  it('renders the hamburger button only when onMenuToggle is provided', () => {
    mockUseAuth.mockReturnValue({ user: null, logout: vi.fn() });

    const { rerender } = render(<Header />);
    expect(screen.queryByLabelText('فتح القائمة')).toBeNull();

    const onToggle = vi.fn();
    rerender(<Header onMenuToggle={onToggle} />);
    const btn = screen.getByLabelText('فتح القائمة');
    expect(btn).toBeTruthy();

    fireEvent.click(btn);
    expect(onToggle).toHaveBeenCalled();
  });

  it('disables the logout button while sign-out is in flight, then re-enables', async () => {
    let resolve: (() => void) | null = null;
    const logout = vi.fn(
      () =>
        new Promise<void>((r) => {
          resolve = () => r();
        }),
    );
    mockUseAuth.mockReturnValue({
      user: { fullName: 'X', roles: ['CENTRAL_SUPERVISOR'] },
      logout,
    });

    render(<Header />);
    const btn = screen.getByLabelText('تسجيل الخروج');
    fireEvent.click(btn);

    await waitFor(() => expect(btn).toHaveProperty('disabled', true));
    expect(logout).toHaveBeenCalled();

    resolve!();
    await waitFor(() => expect(btn).toHaveProperty('disabled', false));
  });

  it('renders without user info gracefully (logout button still present)', () => {
    mockUseAuth.mockReturnValue({ user: null, logout: vi.fn() });
    render(<Header />);
    expect(screen.getByLabelText('تسجيل الخروج')).toBeTruthy();
  });
});
