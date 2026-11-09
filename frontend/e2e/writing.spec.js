/** Specify browser-local authoring journeys; shared fixture captures browser errors. */
import { test, expect, seedDiscovery, demoUsers, demoSession } from './fixtures.js';

const reader = {
  userId: demoUsers[0].id, username: demoUsers[0].username,
  displayName: demoUsers[0].displayName, role: 'user',
};
const post = {
  id: '53f2b35c-fc1a-4e66-9a42-2c2a2e4fb1aa', title: 'Existing story',
  content: 'Original text\n  Second line', createdAt: '2026-11-01T08:00:00.000Z',
  authorId: reader.userId, authorName: reader.displayName,
};

/** Read actual persisted records after each user-visible mutation. */
async function storedPosts(page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts')));
}

test('register, create, read, edit, reload, list, cancel and delete through actual links', async ({ page, browserErrors }) => {
  await seedDiscovery(page);
  await page.goto('/register');
  await page.getByLabel('Display name').fill('Journey Writer');
  await page.getByLabel('Username').fill('journey-writer');
  await page.getByLabel('Password', { exact: true }).fill('demo-only');
  await page.getByLabel('Confirm password').fill('demo-only');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/blogs$/);
  await expect(page.getByText(/No posts yet/)).toBeVisible();
  const accountState = await page.evaluate(() => ({
    users: JSON.parse(localStorage.getItem('writespace_users')),
    session: JSON.parse(localStorage.getItem('writespace_session')),
  }));
  expect(accountState.users).toHaveLength(1);
  expect(accountState.session).toEqual({
    userId: accountState.users[0].id, username: 'journey-writer',
    displayName: 'Journey Writer', role: 'user',
  });
  await page.getByRole('link', { name: 'Write a post' }).click();
  await page.getByRole('button', { name: 'Publish post' }).click();
  await expect(page.getByText('Title is required.', { exact: true })).toBeVisible();
  await expect(page.getByText('Content is required.', { exact: true })).toBeVisible();
  expect(await storedPosts(page)).toEqual([]);
  const title = '  Journey story  ';
  const content = '  First line\n\n<script>window.bad = true</script>  ';
  await page.getByLabel('Title').fill(title);
  await page.getByLabel('Content').fill(content);
  expect(await storedPosts(page)).toEqual([]);
  await page.getByRole('button', { name: 'Publish post' }).click();
  await expect(page).toHaveURL(/\/blog\/[^/]+$/);
  const createdPosts = await storedPosts(page);
  expect(createdPosts).toHaveLength(1);
  const created = createdPosts[0];
  expect(created).toEqual({
    id: expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i),
    title, content, createdAt: expect.any(String),
    authorId: accountState.session.userId, authorName: 'Journey Writer',
  });
  expect(new Date(created.createdAt).toISOString()).toBe(created.createdAt);
  expect(new URL(page.url()).pathname).toBe('/blog/' + created.id);
  expect(await page.getByRole('article').locator('p.whitespace-pre-wrap').textContent()).toBe(content);
  await expect(page.getByRole('article').locator('script')).toHaveCount(0);
  expect(await page.evaluate(() => window.bad)).toBeUndefined();
  await page.getByRole('link', { name: 'Edit post' }).click();
  await expect(page.getByLabel('Title')).toHaveValue(title);
  await expect(page.getByLabel('Content')).toHaveValue(content);
  await page.getByLabel('Title').fill('Cancelled draft');
  await page.getByRole('link', { name: 'Cancel' }).click();
  expect(await storedPosts(page)).toEqual([created]);
  await page.getByRole('link', { name: 'Edit post' }).click();
  await page.getByLabel('Title').fill('Edited journey');
  await page.getByLabel('Content').fill('  Edited body\n\nLast line  ');
  await page.getByRole('button', { name: 'Save changes' }).click();
  const edited = { ...created, title: 'Edited journey', content: '  Edited body\n\nLast line  ' };
  expect(await storedPosts(page)).toEqual([edited]);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Edited journey');
  expect(await page.getByRole('article').locator('p.whitespace-pre-wrap').textContent()).toBe(edited.content);
  expect(await storedPosts(page)).toEqual([edited]);
  await page.getByRole('link', { name: 'Back to blogs' }).click();
  await expect(page.getByRole('heading', { level: 2 })).toHaveText('Edited journey');
  await page.getByRole('link', { name: 'Edit Edited journey' }).click();
  await expect(page.getByLabel('Content')).toHaveValue(edited.content);
  await page.getByRole('link', { name: 'Cancel' }).click();
  page.once('dialog', (dialog) => dialog.dismiss());
  await page.getByRole('button', { name: 'Delete post' }).click();
  expect(await storedPosts(page)).toEqual([edited]);
  page.once('dialog', async (dialog) => {
    expect(dialog.message()).toBe('Delete this post? This cannot be undone.');
    await dialog.accept();
  });
  await page.getByRole('button', { name: 'Delete post' }).click();
  await expect(page).toHaveURL(/\/blogs$/);
  expect(await storedPosts(page)).toEqual([]);
  await page.reload();
  await expect(page.getByText(/No posts yet/)).toBeVisible();
  expect(await storedPosts(page)).toEqual([]);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_users')))).toEqual(accountState.users);
  expect(browserErrors).toEqual([]);
});

for (const path of ['/write', '/edit/' + post.id]) {
  test('guest initial entry ' + path + ' redirects without an authoring form', async ({ page, browserErrors }) => {
    await seedDiscovery(page, { posts: [post], users: demoUsers });
    await page.goto(path);
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByLabel('Title')).toHaveCount(0);
    expect(await storedPosts(page)).toEqual([post]);
    expect(browserErrors).toEqual([]);
  });
}

test('non-owner initial edit entry redirects to blogs without mutation', async ({ page, browserErrors }) => {
  await seedDiscovery(page, { posts: [post], users: demoUsers, session: { ...reader, userId: 'other' } });
  await page.goto('/edit/' + post.id);
  await expect(page).toHaveURL(/\/blogs$/);
  await expect(page.getByLabel('Title')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Edit Existing story' })).toHaveCount(0);
  expect(await storedPosts(page)).toEqual([post]);
  expect(browserErrors).toEqual([]);
});

test('missing initial edit entry offers feedback and a working back link', async ({ page, browserErrors }) => {
  await seedDiscovery(page, { posts: [post], session: reader });
  await page.goto('/edit/missing');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Post not found');
  await expect(page.getByLabel('Title')).toHaveCount(0);
  await page.getByRole('link', { name: 'Back to blogs' }).click();
  await expect(page).toHaveURL(/\/blogs$/);
  expect(await storedPosts(page)).toEqual([post]);
  expect(browserErrors).toEqual([]);
});

test('Admin direct edit and mobile authoring preserve another author metadata', async ({ page, browserErrors }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seedDiscovery(page, { posts: [post], session: demoSession });
  await page.goto('/edit/' + post.id);
  await expect(page.getByLabel('Title')).toHaveValue(post.title);
  await page.getByLabel('Title').fill('Admin revision');
  await page.getByLabel('Content').fill('Revised body');
  await page.screenshot({ path: testInfo.outputPath('writing-mobile.png'), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page).toHaveURL(new RegExp('/blog/' + post.id + '$'));
  expect(await storedPosts(page)).toEqual([{ ...post, title: 'Admin revision', content: 'Revised body' }]);
  await page.reload();
  await expect(page.getByRole('article')).toContainText(post.authorName);
  expect(browserErrors).toEqual([]);
});
