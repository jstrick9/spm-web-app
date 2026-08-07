import { test, expect } from '@playwright/test';

/**
 * Access Control manager end-to-end — regression for the snake/camel case
 * member mismatch: the members API returns user_id/role_id/full_name but the
 * matrix read m.userId/m.roleId/m.fullName, so rows showed "email email",
 * every role dropdown displayed "Owner" regardless of the real role, and
 * role changes/removals sent userId=undefined (server 404).
 *
 * Flow: invite a manager → the matrix shows their NAME (not doubled email)
 * and their actual role selected → change the role → server reflects it.
 */
test.use({ viewport: { width: 1440, height: 1400 } });

const BASE = process.env.A11Y_BASE_URL || 'http://localhost:3000';

async function clickSafely(locator: import('@playwright/test').Locator): Promise<void> {
  await locator.evaluate((el) => el.scrollIntoView({ block: 'center', inline: 'nearest' }));
  await locator.click();
}

test('access control shows real names/roles and role changes persist', async ({ page, request }) => {
  const allErrors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') allErrors.push(`[console.error] ${msg.text().slice(0, 260)}`);
  });
  page.on('pageerror', (err) => allErrors.push(`[pageerror] ${String(err).slice(0, 260)}`));
  page.on('response', (res) => {
    if (res.status() >= 400) allErrors.push(`[http ${res.status()}] ${res.url().slice(0, 200)}`);
  });

  const login = await request.post('/api/auth/login', {
    data: { email: 'owner@demo.local', password: 'wedding123' },
  });
  expect(login.ok()).toBeTruthy();
  const { token } = await login.json();
  const orgId = (await (await request.get('/api/orgs', { headers: { authorization: `Bearer ${token}` } })).json()).organizations[0].id;

  // fresh member
  const email = `ac-${Date.now()}@example.com`;
  const reg = await request.post('/api/auth/register', {
    data: { email, password: 'testpass123', fullName: 'Alex Access', orgName: 'Tmp' },
  });
  expect(reg.ok()).toBeTruthy();
  const invite = await request.post(`/api/orgs/${orgId}/members`, {
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    data: { userEmail: email, roleId: 'sys_manager' },
  });
  expect(invite.status()).toBe(201);

  // ── 1. Open the Access Control matrix ──
  await page.goto(BASE + '/#/');
  await page.getByLabel(/email address/i).fill('owner@demo.local');
  await page.locator('#pw').fill('wedding123');
  await page.getByRole('button', { name: 'Sign in securely' }).click();
  await expect(page.locator('body')).toContainText(/good (morning|afternoon|evening)/i, { timeout: 20_000 });

  await page.goto(BASE + '/#/system/catalog');
  await page.getByRole('button', { name: /User & Access Matrix/i }).click();
  await page.waitForTimeout(2500);

  // ── 2. The member row shows the real NAME (not "email email") ──
  await expect(page.getByText('Alex Access').first()).toBeVisible({ timeout: 10_000 });

  // ── 3. The role select shows the ACTUAL role (Venue Manager) ──
  // scope to THIS run's member (prior runs leave same-named rows behind)
  const row = page.locator('div').filter({ hasText: email }).filter({ has: page.locator('select') }).last();
  const roleSelect = row.locator('select').first();
  await expect(roleSelect).toHaveValue('sys_manager', { timeout: 10_000 });

  // ── 4. Change the role to Planner → server reflects it ──
  await roleSelect.selectOption('sys_planner');
  await expect(page.getByText('Staff account role updated successfully').first()).toBeVisible({ timeout: 15_000 });

  const membersRes = await request.get(`/api/orgs/${orgId}/members`, {
    headers: { authorization: `Bearer ${token}` },
  });
  const { members } = (await membersRes.json()) as { members: Array<any> };
  const updated = members.find((m: any) => m.email === email);
  expect(updated, 'member must exist').toBeTruthy();
  expect(updated.role_id, 'role change must persist server-side').toBe('sys_planner');

  // ── 5. Custom roles: create → rename → delete (regression: created
  // custom roles could never be renamed or removed) ──
  await page.getByRole('button', { name: 'Create Custom Role' }).click();
  const roleName = `Ops Role ${Date.now()}`;
  await page.locator('#role-name').fill(roleName);
  await page.locator('#role-key').fill(`ops-${Date.now()}`);
  await page.locator('#role-desc').fill('Temporary ops role for e2e.');
  // grant one permission so the create button enables
  const permCheckbox = page.locator('input[type="checkbox"]').first();
  await permCheckbox.check();
  await page.getByRole('button', { name: 'Create Custom Role', exact: true }).last().click();
  await expect(page.getByText('Custom role created').or(page.getByText(/role created/i)).first()).toBeVisible({ timeout: 15_000 });

  // rename it
  await page.getByRole('button', { name: 'Rename' }).first().click();
  const renameDialog = page.getByRole('dialog');
  await expect(renameDialog).toBeVisible({ timeout: 10_000 });
  await renameDialog.locator('#prompt-field').fill(`${roleName} Renamed`);
  await clickSafely(renameDialog.getByRole('button', { name: 'Save' }));
  await expect(page.getByText('Role updated').first()).toBeVisible({ timeout: 15_000 });

  const rolesRes = await request.get(`/api/orgs/${orgId}/roles`, { headers: { authorization: `Bearer ${token}` } });
  const { roles } = (await rolesRes.json()) as { roles: Array<any> };
  const renamed = roles.find((r: any) => r.name === `${roleName} Renamed`);
  expect(renamed, 'renamed custom role must exist server-side').toBeTruthy();
  expect(renamed.is_system).toBeFalsy();

  // delete it
  await page.getByRole('button', { name: 'Delete' }).first().click();
  const deleteDialog = page.getByRole('dialog');
  await expect(deleteDialog).toBeVisible({ timeout: 10_000 });
  await clickSafely(deleteDialog.getByRole('button', { name: /confirm|delete/i }).last());
  await expect(page.getByText('Role deleted').first()).toBeVisible({ timeout: 15_000 });

  const rolesRes2 = await request.get(`/api/orgs/${orgId}/roles`, { headers: { authorization: `Bearer ${token}` } });
  const { roles: roles2 } = (await rolesRes2.json()) as { roles: Array<any> };
  expect(roles2.find((r: any) => r.id === renamed.id), 'deleted custom role must be gone').toBeFalsy();

  expect(allErrors, `access control produced console/network errors:\n${allErrors.join('\n')}`).toEqual([]);
});
