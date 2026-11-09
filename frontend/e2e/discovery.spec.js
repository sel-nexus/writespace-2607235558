/** Exercise complete discovery journeys; account and reader implementations belong to later slices. */
import { test, expect, seedDiscovery, demoPosts, demoUsers, demoSession } from './fixtures.js';

test('guest discovers local stories, follows the preview destination and returns', async ({ page, browserErrors }, testInfo) => {
  await seedDiscovery(page, { posts: demoPosts, users: demoUsers });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Room for your words.');
  await expect(page.getByRole('region', { name: 'Less noise. More story.' }).getByRole('article')).toHaveCount(3);
  const latest = page.getByRole('region', { name: 'Latest stories' });
  await expect(latest.getByRole('heading', { level: 3 })).toHaveText(['Local story 4', 'Local story 3', 'Local story 2']);
  await expect(latest).toContainText('Words saved locally on day 4.');
  await expect(latest).toContainText('Nov 4, 2026');
  await expect(page.getByRole('complementary')).toContainText('plaintext in localStorage');
  await expect(page.getByRole('complementary')).toContainText('admin/admin');
  await expect(page.getByRole('contentinfo')).toContainText('local demo');
  await page.screenshot({ path: testInfo.outputPath('discovery-desktop.png'), fullPage: true });
  await page.getByRole('link', { name: 'Read Local story 4' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.getByRole('link', { name: 'WriteSpace', exact: true }).click();
  await expect(latest.getByRole('article')).toHaveCount(3);
  await page.reload();
  await expect(latest).toContainText('Words saved locally on day 4.');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts')))).toEqual(demoPosts);
  expect(browserErrors).toEqual([]);
});

test('empty discovery and mobile navigation expose real account destinations', async ({ page, browserErrors }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByText(/No stories yet/)).toBeVisible();
  const toggle = page.getByRole('button', { name: 'Open navigation' });
  await expect(page.getByRole('link', { name: 'Log in', exact: true })).toBeHidden();
  await toggle.click();
  await expect(page.getByRole('button', { name: 'Close navigation', exact: true })).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByRole('link', { name: 'Register', exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('discovery-mobile-menu.png'), fullPage: true });
  await page.getByRole('button', { name: 'Close navigation' }).click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await page.getByRole('link', { name: 'Get started' }).click();
  await expect(page).toHaveURL(/\/register$/);
  await page.getByRole('link', { name: 'WriteSpace', exact: true }).click();
  await toggle.click();
  await page.getByRole('link', { name: 'Log in', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.getByRole('link', { name: 'WriteSpace', exact: true }).click();
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  expect(await page.getByRole('banner').evaluate((header) => Math.round(header.getBoundingClientRect().top))).toBe(0);
  expect(browserErrors).toEqual([]);
});

test('signed-in discovery routes previews to their IDs and logs out without removing collections', async ({ page, browserErrors }) => {
  await seedDiscovery(page, { posts: demoPosts, users: demoUsers, session: demoSession });
  await page.goto('/');
  await expect(page.getByRole('navigation')).toContainText('Demo Admin');
  await expect(page.getByRole('link', { name: 'Admin dashboard' })).toHaveAttribute('href', '/admin');
  await page.getByRole('link', { name: 'Read Local story 4' }).click();
  await expect(page).toHaveURL(new RegExp(`/blog/${demoPosts[1].id}$`));
  await page.getByRole('link', { name: 'WriteSpace', exact: true }).click();
  await page.getByRole('button', { name: 'Log out' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('link', { name: 'Read Local story 4' })).toHaveAttribute('href', '/login');
  await page.reload();
  expect(await page.evaluate(() => localStorage.getItem('writespace_session'))).toBeNull();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts')))).toEqual(demoPosts);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_users')))).toEqual(demoUsers);
  expect(browserErrors).toEqual([]);
});

test('failed mobile logout preserves identity, route and workflow', async ({ page, browserErrors }, testInfo) => {
  await seedDiscovery(page, { session: demoSession });
  await page.addInitScript(() => {
    Storage.prototype.removeItem = () => { throw new DOMException('Denied', 'SecurityError'); };
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/unsupported');
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await page.getByRole('button', { name: 'Log out' }).click();
  await expect(page.getByRole('alert')).toContainText('Your changes have not been saved. You are still signed in.');
  await expect(page).toHaveURL(/\/unsupported$/);
  await expect(page.getByRole('button', { name: 'Close navigation' })).toHaveAttribute('aria-expanded', 'true');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_session')))).toEqual(demoSession);
  await page.screenshot({ path: testInfo.outputPath('discovery-logout-failure.png'), fullPage: true });
  expect(browserErrors).toEqual([]);
});
