import { test, expect } from '@playwright/test';
import { loginAs, logout } from '../fixtures/auth';
import { USERS } from '../fixtures/users';

test.describe('1) Auth foundation', () => {
  test('login page renders Arabic RTL form', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByText('تسجيل الدخول')).toBeVisible();
    await expect(page.locator('#username')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.getByRole('button', { name: /دخول/ })).toBeEnabled();
    await expect(page.getByRole('link', { name: /نسيت كلمة المرور/ })).toBeVisible();
  });

  test('login fails with bad password and shows Arabic error', async ({ page }) => {
    await page.goto('/login');
    await page.locator('#username').fill(USERS.sectionHead.username);
    await page.locator('#password').fill('wrong-password!!');
    await page.getByRole('button', { name: /دخول/ }).click();
    await expect(page.getByRole('alert')).toContainText('بيانات الدخول غير صحيحة', {
      timeout: 10_000,
    });
    // Should still be on /login
    await expect(page).toHaveURL(/\/login/);
  });

  test('successful login as section_fi_dam → dashboard', async ({ page }) => {
    await loginAs(page, 'sectionHead');
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('protected route /cases redirects to /login when unauthenticated', async ({ page }) => {
    await page.goto('/cases');
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });

  test('logout clears session and re-protects routes', async ({ page }) => {
    await loginAs(page, 'sectionHead');
    await logout(page);
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });

  test('forgot-password page is reachable from login', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('link', { name: /نسيت كلمة المرور/ }).click();
    await expect(page).toHaveURL(/\/forgot-password/);
    // Should have at least one input (mobile/username) and a submit button.
    await expect(page.locator('input').first()).toBeVisible();
  });
});

