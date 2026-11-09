/** Verify browser-origin persistence, failure truthfulness and responsive layout. */
import { test, expect, seedDiscovery, demoPosts, demoUsers } from './fixtures.js';

test('restores exact user session and records across reload without app-data requests', async ({ page, browserErrors }) => {
  const requests = [];
  page.on('request', request => {
    if (['xhr', 'fetch'].includes(request.resourceType())) requests.push(request.url());
  });
  await seedDiscovery(page, { posts: demoPosts, users: demoUsers, session: {
    userId: demoUsers[0].id, username: 'reader', displayName: 'Demo Reader', role: 'user',
  } });
  await page.goto('/blogs');
  await expect(page.getByRole('heading', { name: 'Local story 4', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Local story 4', exact: true })).toBeVisible();
  const keys = await page.evaluate(() => Object.keys(localStorage).sort());
  expect(keys).toEqual(['writespace_posts', 'writespace_session', 'writespace_users']);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_users')))).toEqual(demoUsers);
  expect(requests).toEqual([]);
  expect(browserErrors).toEqual([]);
});

test('malformed collections render empty rather than crashing', async ({ page, browserErrors }) => {
  await page.addInitScript(() => {
    localStorage.setItem('writespace_posts', '{');
    localStorage.setItem('writespace_users', '{');
  });
  await page.goto('/');
  const latestStories = page.getByRole('region', { name: 'Latest stories', exact: true });
  await expect(latestStories.getByRole('heading', { name: 'Latest stories', exact: true })).toBeVisible();
  await expect(latestStories.getByText('No stories yet. Your first story can start here.', { exact: true })).toBeVisible();
  await expect(latestStories.locator('article')).toHaveCount(0);
  expect(await page.evaluate(() => ({
    posts: localStorage.getItem('writespace_posts'),
    users: localStorage.getItem('writespace_users'),
  }))).toEqual({ posts: '{', users: '{' });
  expect(browserErrors).toEqual([]);
});

test('malformed users safely reject login without replacing the corrupt collection', async ({ page, browserErrors }) => {
  await page.addInitScript(() => {
    localStorage.setItem('writespace_users', '{');
  });
  await page.goto('/login');
  await page.getByLabel('Username', { exact: true }).fill('reader');
  await page.getByLabel('Password', { exact: true }).fill('demo-only');
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('Invalid username or password.');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'Log in to WriteSpace', exact: true })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('writespace_users'))).toBe('{');
  expect(await page.evaluate(() => localStorage.getItem('writespace_session'))).toBeNull();
  expect(browserErrors).toEqual([]);
});

test('blocked post write retains draft and does not announce success', async ({ page, browserErrors }) => {
  await seedDiscovery(page, { users: demoUsers, session: {
    userId: demoUsers[0].id, username: 'reader', displayName: 'Demo Reader', role: 'user',
  } });
  await page.goto('/write');
  await page.getByLabel('Title', { exact: true }).fill('Unsaved draft');
  await page.getByLabel('Content', { exact: true }).fill('Keep these words');
  await page.evaluate(() => {
    const native = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
      if (key === 'writespace_posts') throw new DOMException('Blocked', 'QuotaExceededError');
      return native.call(this, key, value);
    };
  });
  await page.getByRole('button', { name: 'Publish post' }).click();
  await expect(page.getByRole('alert')).toHaveText('Could not save in this browser. Your changes have not been saved.');
  await expect(page.getByLabel('Content', { exact: true })).toHaveValue('Keep these words');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts')))).toEqual([]);
  expect(browserErrors).toEqual([]);
});

for (const [width, columns] of [[390, 1], [768, 2], [1280, 3]]) {
  test(`blog grid has ${columns} columns at ${width}px`, async ({ page, browserErrors }) => {
    await page.setViewportSize({ width, height: 900 });
    await seedDiscovery(page, { posts: demoPosts, session: {
      userId: 'admin', username: 'admin', displayName: 'Demo Admin', role: 'admin',
    } });
    await page.goto('/blogs');
    await expect(page.locator('article').first()).toBeVisible();
    const count = await page.locator('article').first().evaluate(element =>
      getComputedStyle(element.parentElement).gridTemplateColumns.split(' ').length);
    expect(count).toBe(columns);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(browserErrors).toEqual([]);
  });
}
