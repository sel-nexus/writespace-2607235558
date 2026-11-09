/** Capture browser errors before navigation and provide exact-schema local demo data. */
import { test as base, expect } from '@playwright/test';

export const demoSession = { userId: 'admin', username: 'admin', displayName: 'Demo Admin', role: 'admin' };
export const demoPosts = [1, 4, 2, 3].map((day) => ({
  id: `53f2b35c-fc1a-4e66-9a42-2c2a2e4fb1a${day}`, title: `Local story ${day}`,
  content: `Words saved locally on day ${day}.`, createdAt: `2026-11-0${day}T08:00:00.000Z`,
  authorId: 'admin', authorName: 'Demo Admin',
}));
export const demoUsers = [{
  id: '48dbb1d0-2150-40fb-a705-42a4202622cf', displayName: 'Demo Reader', username: 'reader',
  password: 'demo-only', role: 'user', createdAt: '2026-11-01T08:00:00.000Z',
}];

export const test = base.extend({
  browserErrors: [async ({ page }, use) => {
    const errors = [];
    page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('pageerror', (error) => errors.push(error.message));
    await use(errors);
    expect(errors, 'Browser console and uncaught page errors').toEqual([]);
  }, { auto: true }],
});
export { expect };

/** Seed exact browser keys before first entry; reloads retain subsequent user changes.
 * Args:
 *   page: Browser page to initialize.
 *   data: Optional initial collections and session.
 * Returns:
 *   Completion of the browser's initialization registration.
 */
export async function seedDiscovery(page, { posts = [], users = [], session = null } = {}) {
  await page.addInitScript((data) => {
    if (localStorage.length !== 0) return;
    localStorage.setItem('writespace_posts', JSON.stringify(data.posts));
    localStorage.setItem('writespace_users', JSON.stringify(data.users));
    if (data.session) localStorage.setItem('writespace_session', JSON.stringify(data.session));
  }, { posts, users, session });
}
