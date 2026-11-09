/** Exercise role-aware reading journeys with schema-valid browser-local seeds. */
import { test, expect, seedDiscovery, demoUsers, demoSession } from './fixtures.js';

const reader = { userId: demoUsers[0].id, username: 'reader', displayName: 'Demo Reader', role: 'user' };
const storedAdmin = { ...demoUsers[0], id: '48dbb1d0-2150-40fb-a705-42a4202622ca', username: 'editor', displayName: 'Demo Editor', role: 'admin' };
const posts = [1, 2].map((day) => ({
  id: '53f2b35c-fc1a-4e66-9a42-2c2a2e4fb1a' + day,
  title: day === 1 ? 'Reader story' : 'Another author',
  content: day === 1 ? '<script>window.bad = true</script>' + String.fromCharCode(10) + '  Second line' + String.fromCharCode(10, 10) + 'Last line' : 'a'.repeat(121),
  createdAt: '2026-11-0' + day + 'T08:00:00.000Z',
  authorId: day === 1 ? reader.userId : 'admin', authorName: day === 1 ? reader.displayName : 'Demo Admin',
}));

/** Read persisted posts to prove mutations rather than just view changes. */
async function storedPosts(page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts')));
}

for (const identity of [reader, { userId: storedAdmin.id, username: storedAdmin.username, displayName: storedAdmin.displayName, role: 'admin' }, demoSession]) {
  test(identity.username + ' follows discovery into list/reader, cancels and confirms eligible deletion', async ({ page, browserErrors }) => {
    await seedDiscovery(page, { posts, users: [...demoUsers, storedAdmin], session: identity });
    await page.goto('/');
    await page.getByRole('link', { name: 'Explore blogs' }).click();
    await expect(page.getByRole('heading', { level: 2 })).toHaveText(['Another author', 'Reader story']);
    await expect(page.getByText('a'.repeat(120) + '…')).toBeVisible();
    await expect(page.getByText(/Nov 2, 2026/)).toBeVisible();
    await expect(page.getByRole('img', { name: identity.role === 'admin' ? 'Admin avatar' : 'User avatar' })).toBeVisible();
    const target = identity.role === 'admin' ? posts[1] : posts[0];
    if (identity.role === 'user') {
      await expect(page.getByRole('link', { name: 'Edit Another author' })).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Delete Another author' })).toHaveCount(0);
      await expect(page.getByRole('link', { name: 'User management' })).toHaveCount(0);
    }
    await page.getByRole('link', { name: 'Read ' + target.title }).click();
    await expect(page).toHaveURL(new RegExp('/blog/' + target.id + '$'));
    await expect(page.getByRole('article')).toContainText(target.content);
    await expect(page.getByRole('link', { name: 'Edit post' })).toHaveAttribute('href', '/edit/' + target.id);
    page.once('dialog', (dialog) => dialog.dismiss());
    await page.getByRole('button', { name: 'Delete post' }).click();
    expect(await storedPosts(page)).toEqual(posts);
    await page.reload();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(target.title);
    page.once('dialog', async (dialog) => {
      expect(dialog.message()).toBe('Delete this post? This cannot be undone.');
      await dialog.accept();
    });
    await page.getByRole('button', { name: 'Delete post' }).click();
    await expect(page).toHaveURL(/\/blogs$/);
    const remaining = posts.filter((post) => post.id !== target.id);
    expect(await storedPosts(page)).toEqual(remaining);
    await page.reload();
    await expect(page.getByRole('heading', { level: 2 })).toHaveText(remaining[0].title);
    await page.getByRole('button', { name: 'Log out' }).click();
    await expect(page).toHaveURL(/\/$/);
    expect(await storedPosts(page)).toEqual(remaining);
    expect(browserErrors).toEqual([]);
  });
}

test('direct reader preserves plain text and whitespace, returns to list and follows a public preview', async ({ page, browserErrors }) => {
  await seedDiscovery(page, { posts, users: demoUsers, session: reader });
  await page.goto('/blog/' + posts[0].id);
  const body = page.getByRole('article').locator('p.whitespace-pre-wrap');
  expect(await body.textContent()).toBe(posts[0].content);
  expect(await body.evaluate((element) => getComputedStyle(element).whiteSpace)).toBe('pre-wrap');
  expect(await page.evaluate(() => window.bad)).toBeUndefined();
  await expect(page.getByRole('article').locator('script')).toHaveCount(0);
  await page.getByRole('link', { name: 'Back to blogs' }).click();
  await page.getByRole('link', { name: 'Read Another author' }).click();
  await expect(page.getByRole('link', { name: 'Edit post' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Delete post' })).toHaveCount(0);
  await page.getByRole('link', { name: 'WriteSpace', exact: true }).click();
  await page.getByRole('link', { name: 'Read Reader story' }).click();
  await expect(page).toHaveURL(new RegExp('/blog/' + posts[0].id + '$'));
  expect(await storedPosts(page)).toEqual(posts);
  expect(browserErrors).toEqual([]);
});

test('mobile navigation and card deletion remain usable with a one-column collection', async ({ page, browserErrors }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seedDiscovery(page, { posts, users: demoUsers, session: reader });
  await page.goto('/blogs');
  const nav = page.getByRole('navigation', { name: 'Blog navigation' });
  await expect(nav).toBeHidden();
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await expect(nav).toBeVisible();
  await expect(page.getByRole('link', { name: 'Write a post' })).toHaveAttribute('href', '/write');
  await page.getByRole('link', { name: 'Blogs', exact: true }).focus();
  await page.keyboard.press('Escape');
  await expect(nav).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const columns = await page.getByRole('main').locator('.grid').evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(' ').length);
  expect(columns).toBe(1);
  await page.screenshot({ path: testInfo.outputPath('reading-mobile.png'), fullPage: true });
  page.once('dialog', (dialog) => dialog.dismiss());
  await page.getByRole('button', { name: 'Delete Reader story' }).click();
  expect(await storedPosts(page)).toEqual(posts);
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Delete Reader story' }).click();
  await expect(page.getByRole('heading', { level: 2 })).toHaveText('Another author');
  expect(await storedPosts(page)).toEqual([posts[1]]);
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await page.getByRole('button', { name: 'Log out' }).click();
  await expect(page).toHaveURL(/\/$/);
  expect(browserErrors).toEqual([]);
});

for (const path of ['/blogs', '/blog/' + posts[0].id]) {
  test('guest direct entry ' + path + ' is denied, then real login reaches reading', async ({ page, browserErrors }) => {
    await seedDiscovery(page, { posts, users: demoUsers });
    await page.goto(path);
    await expect(page).toHaveURL(/\/login$/);
    await page.getByLabel('Username').fill('reader');
    await page.getByLabel('Password', { exact: true }).fill('demo-only');
    await page.getByRole('button', { name: 'Log in', exact: true }).click();
    await expect(page).toHaveURL(/\/blogs$/);
    await page.getByRole('link', { name: 'Read Reader story' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Reader story');
    expect(await storedPosts(page)).toEqual(posts);
    expect(browserErrors).toEqual([]);
  });
}

test('missing direct ID has feedback and a working list destination', async ({ page, browserErrors }) => {
  await seedDiscovery(page, { posts, session: reader });
  await page.goto('/blog/missing');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Post not found');
  await page.getByRole('link', { name: 'Back to blogs' }).click();
  await expect(page.getByRole('heading', { level: 2 })).toHaveText(['Another author', 'Reader story']);
  expect(await storedPosts(page)).toEqual(posts);
  expect(browserErrors).toEqual([]);
});

test('empty direct list is operational and mobile logout clears only session', async ({ page, browserErrors }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seedDiscovery(page, { users: demoUsers, session: reader });
  await page.goto('/blogs');
  await expect(page.getByText(/No posts yet/)).toBeVisible();
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await page.getByRole('button', { name: 'Log out' }).click();
  await expect(page).toHaveURL(/\/$/);
  expect(await page.evaluate(() => localStorage.getItem('writespace_session'))).toBeNull();
  expect(await storedPosts(page)).toEqual([]);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_users')))).toEqual(demoUsers);
  expect(browserErrors).toEqual([]);
});

for (const initial of ['/blogs', '/blog/' + posts[0].id]) {
  test('failed confirmed deletion stays at ' + initial + ' without changing records', async ({ page, browserErrors }) => {
    await seedDiscovery(page, { posts, session: reader });
    await page.goto(initial);
    await page.evaluate(() => {
      Storage.prototype.setItem = () => { throw new DOMException('Denied', 'QuotaExceededError'); };
    });
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: initial === '/blogs' ? 'Delete Reader story' : 'Delete post' }).click();
    await expect(page.getByRole('alert')).toContainText('Could not save in this browser. Your changes have not been saved.');
    expect(new URL(page.url()).pathname).toBe(initial);
    expect(await storedPosts(page)).toEqual(posts);
    expect(browserErrors).toEqual([]);
  });
}

test('changed persisted session rejects stale reader delete control before confirmation', async ({ page, browserErrors }) => {
  await seedDiscovery(page, { posts, session: reader });
  await page.goto('/blog/' + posts[0].id);
  await page.evaluate((identity) => localStorage.setItem('writespace_session', JSON.stringify(identity)), { ...reader, userId: 'other' });
  const dialogs = [];
  page.on('dialog', async (dialog) => { dialogs.push(dialog.message()); await dialog.dismiss(); });
  await page.getByRole('button', { name: 'Delete post' }).click();
  await expect(page.getByRole('alert')).toContainText('You cannot manage this post.');
  expect(dialogs).toEqual([]);
  expect(await storedPosts(page)).toEqual(posts);
  expect(browserErrors).toEqual([]);
});

test('failed mobile reader logout preserves route, menu, identity and posts', async ({ page, browserErrors }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seedDiscovery(page, { posts, session: reader });
  await page.goto('/blog/' + posts[0].id);
  await page.evaluate(() => { Storage.prototype.removeItem = () => { throw new DOMException('Denied'); }; });
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await page.getByRole('button', { name: 'Log out' }).click();
  await expect(page.getByRole('alert')).toContainText('You are still signed in.');
  await expect(page.getByRole('button', { name: 'Close navigation' })).toHaveAttribute('aria-expanded', 'true');
  expect(new URL(page.url()).pathname).toBe('/blog/' + posts[0].id);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_session')))).toEqual(reader);
  expect(await storedPosts(page)).toEqual(posts);
  expect(browserErrors).toEqual([]);
});
