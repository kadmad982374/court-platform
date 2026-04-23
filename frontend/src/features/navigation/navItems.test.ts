import { describe, expect, it } from 'vitest';
import { NAV_ITEMS, visibleItems } from './navItems';
import type { RoleCode } from '@/shared/types/domain';

describe('navItems / visibleItems', () => {
  it('all general items are visible to any authenticated user (excluding admin entries)', () => {
    const someRole: RoleCode[] = ['STATE_LAWYER'];
    const items = visibleItems(someRole);
    // /admin/users is restricted to CENTRAL_SUPERVISOR (UI sub-phase B), so a
    // STATE_LAWYER should see exactly NAV_ITEMS.length - 1 entries.
    const adminCount = NAV_ITEMS.filter((it) =>
      it.allowedRoles.length > 0 && !it.allowedRoles.includes('STATE_LAWYER'),
    ).length;
    expect(items.length).toBe(NAV_ITEMS.length - adminCount);
  });

  it('an empty role list sees nothing (foundation contract)', () => {
    const items = visibleItems([]);
    expect(items.length).toBe(0);
  });

  it('a CENTRAL_SUPERVISOR sees the foundation + business + reference + notifications + admin items', () => {
    const items = visibleItems(['CENTRAL_SUPERVISOR']);
    const paths = items.map((i) => i.to);
    expect(paths).toContain('/dashboard');
    expect(paths).toContain('/profile');
    expect(paths).toContain('/cases');
    expect(paths).toContain('/resolved-register');
    expect(paths).toContain('/execution-files');
    expect(paths).toContain('/legal-library');
    expect(paths).toContain('/public-entities');
    expect(paths).toContain('/circulars');
    expect(paths).toContain('/notifications');
    expect(paths).toContain('/admin/users');
  });

  it('UI sub-phase B — `/admin/users` is hidden from every non-CENTRAL_SUPERVISOR role', () => {
    for (const r of ['BRANCH_HEAD','SECTION_HEAD','ADMIN_CLERK','STATE_LAWYER','READ_ONLY_SUPERVISOR','SPECIAL_INSPECTOR'] as const) {
      const paths = visibleItems([r]).map((i) => i.to);
      expect(paths).not.toContain('/admin/users');
    }
    expect(visibleItems(['CENTRAL_SUPERVISOR']).map((i) => i.to)).toContain('/admin/users');
  });

  it('does NOT mount sidebar entries for attachments or reminders (intentional — D-036/D-037 host-page sections only)', () => {
    const forbidden = ['/attachments', '/reminders'];
    for (const it of NAV_ITEMS) {
      expect(forbidden).not.toContain(it.to);
    }
  });

  it('Phase 9 business items remain present and grouped under "الأعمال"', () => {
    const paths = NAV_ITEMS.map((i) => i.to);
    expect(paths).toContain('/cases');
    expect(paths).toContain('/resolved-register');
    expect(paths).toContain('/execution-files');
    for (const path of ['/cases', '/resolved-register', '/execution-files']) {
      const it = NAV_ITEMS.find((n) => n.to === path)!;
      expect(it.section).toBe('الأعمال');
    }
  });

  it('Phase 10 notifications item is grouped under "عام"', () => {
    const it = NAV_ITEMS.find((n) => n.to === '/notifications');
    expect(it).toBeTruthy();
    expect(it!.section).toBe('عام');
  });
});
