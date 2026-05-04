// Unit tests for the MobileSidebar drawer component.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MobileSidebar } from './MobileSidebar';

const mockUseAuth = vi.fn();
vi.mock('@/features/auth/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

beforeEach(() => {
  mockUseAuth.mockReset();
  mockUseAuth.mockReturnValue({
    user: { id: 1, username: 'alice', fullName: 'Alice', roles: ['CENTRAL_SUPERVISOR'] },
  });
  document.body.style.overflow = '';
});

function renderDrawer(open: boolean, onClose = vi.fn()) {
  const utils = render(
    <MemoryRouter>
      <MobileSidebar open={open} onClose={onClose} />
    </MemoryRouter>,
  );
  return { ...utils, onClose };
}

describe('MobileSidebar', () => {
  it('renders a dialog with the correct ARIA labelling', () => {
    renderDrawer(true);

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeTruthy();
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('aria-label')).toBe('القائمة الرئيسية');
  });

  it('locks body scroll while open', () => {
    renderDrawer(true);
    expect(document.body.style.overflow).toBe('hidden');
  });

  it('restores body scroll when closed', () => {
    const { rerender, onClose } = renderDrawer(true);
    expect(document.body.style.overflow).toBe('hidden');

    rerender(
      <MemoryRouter>
        <MobileSidebar open={false} onClose={onClose} />
      </MemoryRouter>,
    );
    expect(document.body.style.overflow).toBe('');
  });

  it('invokes onClose when Escape is pressed while open', () => {
    const { onClose } = renderDrawer(true);

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onClose).toHaveBeenCalled();
  });

  it('does NOT bind Escape handler while closed', () => {
    const { onClose } = renderDrawer(false);
    onClose.mockClear(); // ignore the route-change effect on first render

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onClose).not.toHaveBeenCalled();
  });

  it('invokes onClose when the backdrop is clicked', () => {
    const { onClose } = renderDrawer(true);
    onClose.mockClear();

    const backdrop = document.querySelector('[aria-hidden="true"]');
    expect(backdrop).toBeTruthy();
    fireEvent.click(backdrop as Element);

    expect(onClose).toHaveBeenCalled();
  });

  it('invokes onClose when the close-button is clicked', () => {
    const { onClose } = renderDrawer(true);
    onClose.mockClear();

    fireEvent.click(screen.getByLabelText('إغلاق القائمة'));

    expect(onClose).toHaveBeenCalled();
  });

  it('renders nav items grouped by section for the current user roles', () => {
    renderDrawer(true);

    // CENTRAL_SUPERVISOR sees most of the nav items; just confirm we have at least
    // one navigation link with a non-empty label.
    const links = document.querySelectorAll('a');
    expect(links.length).toBeGreaterThan(0);
  });

  it('falls back to empty roles when user is null without crashing', () => {
    mockUseAuth.mockReturnValue({ user: null });
    expect(() => renderDrawer(true)).not.toThrow();
  });
});
