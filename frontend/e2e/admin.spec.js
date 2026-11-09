/** Exercise fixed/stored Admin oversight and newly created account login through real UI. */
import { test, expect, seedDiscovery, demoSession, demoUsers } from './fixtures.js';

const storedAdmin = { ...demoUsers[0], username: 'editor', displayName: 'Stored Editor', role: 'admin' };
const recentPosts = [2, 6, 1, 4, 3, 5].map((day) => ({
  id: `53f2b35c-fc1a-4e66-9a42-2c2a2e4fb1a${day}`, title: `Admin story ${day}`,
  content: `Reader-owned words ${day}.`, createdAt: `2026-11-0${day}T08:00:00.000Z`,
  authorId: demoUsers[0].id, authorName: demoUsers[0].displayName,
}));

/** Fill and explicitly submit the existing login form. */
async function login(page, username, password) {
  await page.getByLabel('Username').fill(username);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
}

/** Create an account using labelled controls without bypassing its handler. */
async function create(page, username, role) {
  await page.getByLabel('Display name').fill('Created ' + role);
  await page.getByLabel('Username').fill(username);
  await page.getByLabel('Password', { exact: true }).fill('new-demo-password');
  await page.getByLabel('Confirm password').fill('new-demo-password');
  await page.getByLabel('Role').selectOption(role);
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
}

for (const [identity, role] of [['fixed', 'user'], ['stored', 'admin']]) {
  test(`${identity} Admin creates ${role}, logs out and newly created account logs in`, async ({ page }) => {
    await seedDiscovery(page, { users: identity === 'stored' ? [storedAdmin] : [] });
    await page.goto('/login');
    await login(page, identity === 'fixed' ? 'admin' : storedAdmin.username,
      identity === 'fixed' ? 'admin' : storedAdmin.password);
    await expect(page.getByRole('heading', { name: 'Admin dashboard', exact: true })).toBeVisible();
    await expect(page.getByRole('term')).toHaveCount(3);
    await expect(page.getByText(/fourth statistic awaits/)).toBeVisible();
    await page.getByRole('link', { name: 'Manage accounts', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Delete admin', exact: true })).toBeDisabled();
    await expect(page.getByText(/fixed default Admin identity cannot/)).toBeVisible();
    if (identity === 'stored') await expect(page.getByText(/current account/)).toBeVisible();
    else await expect(page.getByText(/No stored accounts yet/)).toBeVisible();
    const username = 'created-' + role;
    await create(page, username, role);
    await expect(page.getByRole('status')).toContainText('Account created');
    await expect(page.getByRole('button', { name: 'Delete ' + username, exact: true })).toBeDisabled();
    await expect(page.getByRole('list', { name: 'Accounts' })).not.toContainText('new-demo-password');
    await expect(page.getByRole('list', { name: 'Accounts' })).toContainText(/post disposition/);
    const accounts = await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_users')));
    const account = accounts.find((item) => item.username === username);
    expect(Object.keys(account).sort()).toEqual(['createdAt', 'displayName', 'id', 'password', 'role', 'username']);
    expect(account.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    expect(new Date(account.createdAt).toISOString()).toBe(account.createdAt);
    expect(account.role).toBe(role);
    await page.getByRole('button', { name: 'Log out', exact: true }).click();
    await page.getByRole('link', { name: 'Log in', exact: true }).click();
    await login(page, username, 'new-demo-password');
    await expect(page).toHaveURL(role === 'admin' ? /\/admin$/ : /\/blogs$/);
    if (role === 'admin') {
      await page.getByRole('link', { name: 'User management', exact: true }).click();
      await expect(page.getByText(/current account/)).toBeVisible();
      await expect(page.getByRole('button', { name: 'Delete ' + username })).toBeDisabled();
    } else {
      await expect(page.getByRole('link', { name: 'Admin dashboard', exact: true })).toHaveCount(0);
      await expect(page.getByRole('link', { name: 'User management', exact: true })).toHaveCount(0);
    }
  });
}

test('Admin recent five read/edit/delete controls and alternate quick/nav entry links', async ({ page }) => {
  await seedDiscovery(page, { posts: recentPosts, users: demoUsers, session: demoSession });
  await page.goto('/admin');
  await expect(page.getByRole('article')).toHaveCount(5);
  await expect(page.getByRole('article').first()).toContainText('Admin story 6');
  await expect(page.getByRole('link', { name: 'Read Admin story 1', exact: true })).toHaveCount(0);
  await page.getByRole('link', { name: 'Read Admin story 6', exact: true }).click();
  await expect(page.getByText('Reader-owned words 6.')).toBeVisible();
  await page.getByRole('link', { name: 'Admin dashboard', exact: true }).click();
  await page.getByRole('link', { name: 'Edit Admin story 6', exact: true }).click();
  await expect(page.getByLabel('Title')).toHaveValue('Admin story 6');
  await page.getByLabel('Title').fill('Admin revision');
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Admin revision', exact: true })).toBeVisible();
  const originalPost = recentPosts.find((post) => post.title === 'Admin story 6');
  const editedPosts = recentPosts.map((post) => post.id === originalPost.id
    ? { ...post, title: 'Admin revision' } : post);
  // Exact collection equality preserves the original author/timestamp and unrelated posts.
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts')))).toEqual(editedPosts);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Admin revision', exact: true })).toBeVisible();
  await expect(page.getByText('Reader-owned words 6.')).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts')))).toEqual(editedPosts);
  await page.getByRole('link', { name: 'Admin dashboard', exact: true }).click();
  page.once('dialog', (dialog) => dialog.dismiss());
  await page.getByRole('button', { name: 'Delete Admin revision', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Read Admin revision', exact: true })).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts')))).toEqual(editedPosts);
  await page.reload();
  await expect(page.getByRole('link', { name: 'Read Admin revision', exact: true })).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts')))).toEqual(editedPosts);
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Delete Admin revision', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Read Admin revision', exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Read Admin story 1', exact: true })).toBeVisible();
  await expect(page.getByText('Total Posts').locator('..')).toContainText('5');
  const remainingPosts = recentPosts.filter((post) => post.id !== originalPost.id);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts')))).toEqual(remainingPosts);
  await page.reload();
  await expect(page.getByRole('link', { name: 'Read Admin revision', exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Read Admin story 1', exact: true })).toBeVisible();
  await expect(page.getByText('Total Posts').locator('..')).toContainText('5');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts')))).toEqual(remainingPosts);
  await page.getByRole('link', { name: 'Write a new post', exact: true }).click();
  await page.getByLabel('Title').fill('Quick-action post');
  await page.getByLabel('Content').fill('Created using the quick action.');
  await page.getByRole('button', { name: 'Publish post', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Quick-action post', exact: true })).toBeVisible();
  const createdPosts = await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts')));
  expect(createdPosts).toHaveLength(remainingPosts.length + 1);
  const createdPost = createdPosts.find((post) => post.title === 'Quick-action post');
  expect(createdPost).toEqual({
    id: expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i),
    title: 'Quick-action post', content: 'Created using the quick action.',
    authorId: demoSession.userId, authorName: demoSession.displayName,
    createdAt: expect.any(String),
  });
  expect(new Date(createdPost.createdAt).toISOString()).toBe(createdPost.createdAt);
  expect(recentPosts.map((post) => post.id)).not.toContain(createdPost.id);
  expect(createdPosts.filter((post) => post.id !== createdPost.id)).toEqual(remainingPosts);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Quick-action post', exact: true })).toBeVisible();
  await expect(page.getByText('Created using the quick action.')).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts')))).toEqual(createdPosts);
  await page.getByRole('link', { name: 'Admin dashboard', exact: true }).click();
  await page.getByRole('link', { name: 'User management', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'User management', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Write a post', exact: true }).click();
  await expect(page.getByLabel('Title')).toHaveValue('');
});

test('account required/reserved/duplicate errors and failed write preserve controlled inputs', async ({ page }) => {
  await seedDiscovery(page, { users: demoUsers, session: demoSession });
  await page.goto('/users');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page.getByLabel('Username')).toHaveAttribute('aria-invalid', 'true');
  await create(page, 'ADMIN', 'user');
  await expect(page.getByRole('alert')).toContainText('reserved');
  await create(page, 'READER', 'admin');
  await expect(page.getByRole('alert')).toContainText('already taken');
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === 'writespace_users') throw new DOMException('Full', 'QuotaExceededError');
      return original.call(this, key, value);
    };
  });
  await create(page, 'failed-account', 'admin');
  await expect(page.getByRole('alert')).toContainText('Could not save in this browser. Your changes have not been saved.');
  await expect(page.getByLabel('Username')).toHaveValue('failed-account');
  await expect(page.getByLabel('Role')).toHaveValue('admin');
  await expect(page.getByRole('button', { name: 'Delete failed-account', exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_users')))).toEqual(demoUsers);
});

test('failed recent post deletion leaves list and count unchanged', async ({ page }) => {
  await seedDiscovery(page, { posts: recentPosts, session: demoSession });
  await page.goto('/admin');
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === 'writespace_posts') throw new DOMException('Full', 'QuotaExceededError');
      return original.call(this, key, value);
    };
  });
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Delete Admin story 6', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Could not save in this browser');
  await expect(page.getByRole('link', { name: 'Read Admin story 6', exact: true })).toBeVisible();
  await expect(page.getByText('Total Posts').locator('..')).toContainText('6');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts')))).toEqual(recentPosts);
});

for (const path of ['/admin', '/users']) {
  test(`guest denied direct ${path} entry`, async ({ page }) => {
    await seedDiscovery(page);
    await page.goto(path);
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('heading', { name: 'Log in to WriteSpace', exact: true })).toBeVisible();
  });
  test(`User denied direct ${path} entry`, async ({ page }) => {
    await seedDiscovery(page, { users: demoUsers, session: {
      userId: demoUsers[0].id, username: 'reader', displayName: 'Demo Reader', role: 'user',
    } });
    await page.goto(path);
    await expect(page).toHaveURL(/\/blogs$/);
    await expect(page.getByRole('link', { name: 'User management', exact: true })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Admin dashboard', exact: true })).toHaveCount(0);
  });
}

test('mobile Admin navigation reaches account gates without overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seedDiscovery(page, { session: demoSession });
  await page.goto('/admin');
  await expect(page.getByText(/No posts yet/)).toBeVisible();
  await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
  await page.getByRole('link', { name: 'User management', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Delete admin', exact: true })).toBeDisabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
