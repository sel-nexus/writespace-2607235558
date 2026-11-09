/** Exercise real account journeys using schema-valid fixtures and automatic console capture. */
import { test, expect, seedDiscovery, demoUsers, demoSession } from './fixtures.js';

/** Read persisted account state rather than inferring saves from navigation. */
async function state(page) {
  return page.evaluate(() => ({
    users: JSON.parse(localStorage.getItem('writespace_users')),
    session: JSON.parse(localStorage.getItem('writespace_session')),
    posts: JSON.parse(localStorage.getItem('writespace_posts')),
    keys: Object.keys(localStorage).sort(),
  }));
}

/** Submit real login controls without a fabricated session. */
async function login(page, username, password) {
  await page.getByLabel('Username', { exact: true }).fill(username);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
}

/** Fill required self-registration fields with demo-only credentials. */
async function registration(page, username = 'Writer') {
  await page.getByLabel('Display name', { exact: true }).fill('Local Writer');
  await page.getByLabel('Username', { exact: true }).fill(username);
  await page.getByLabel('Password', { exact: true }).fill('demo-only');
  await page.getByLabel('Confirm password', { exact: true }).fill('demo-only');
}

test('register, reload, logout and login again through public links', async ({ page }) => {
  await seedDiscovery(page);
  await page.goto('/');
  await page.getByRole('link', { name: 'Get started', exact: true }).click();
  await expect(page).toHaveURL(/\/register$/);
  await registration(page);
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page).toHaveURL(/\/blogs$/);
  const saved = await state(page);
  expect(saved.users).toHaveLength(1);
  expect(saved.users[0]).toEqual({
    id: expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i),
    displayName: 'Local Writer', username: 'Writer', password: 'demo-only', role: 'user',
    createdAt: expect.any(String),
  });
  expect(new Date(saved.users[0].createdAt).toISOString()).toBe(saved.users[0].createdAt);
  expect(saved.session).toEqual({ userId: saved.users[0].id, username: 'Writer', displayName: 'Local Writer', role: 'user' });
  expect(saved.keys).toEqual(['writespace_posts', 'writespace_session', 'writespace_users']);
  await page.reload();
  expect(await state(page)).toEqual(saved);
  await page.getByRole('button', { name: 'Log out', exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  expect(await state(page)).toEqual({ ...saved, session: null, keys: ['writespace_posts', 'writespace_users'] });
  await page.getByRole('navigation').getByRole('link', { name: 'Log in', exact: true }).click();
  await login(page, ' writer ', 'demo-only');
  await expect(page).toHaveURL(/\/blogs$/);
  expect(await state(page)).toEqual(saved);
});

for (const role of ['user', 'admin']) {
  test(`stored ${role} signs in to its role home and logs out without removing users`, async ({ page }) => {
    const users = [{ ...demoUsers[0], role }];
    await seedDiscovery(page, { users });
    await page.goto('/');
    await page.getByRole('navigation').getByRole('link', { name: 'Log in', exact: true }).click();
    await login(page, 'READER', 'demo-only');
    await expect(page).toHaveURL(role === 'admin' ? /\/admin$/ : /\/blogs$/);
    expect((await state(page)).session).toEqual({ userId: users[0].id, username: 'reader', displayName: 'Demo Reader', role });
    await page.getByRole('button', { name: 'Log out', exact: true }).click();
    await expect(page).toHaveURL(/\/$/);
    expect((await state(page)).session).toBeNull();
    expect((await state(page)).users).toEqual(users);
  });
}

test('fixed Admin takes precedence over a reserved stored shadow', async ({ page }) => {
  const users = [{ ...demoUsers[0], username: 'ADMIN', password: 'shadow' }];
  await seedDiscovery(page, { users });
  await page.goto('/login');
  await login(page, 'admin', 'shadow');
  await expect(page.getByRole('alert')).toHaveText('Invalid username or password.');
  expect((await state(page)).session).toBeNull();
  await login(page, ' Admin ', 'admin');
  await expect(page).toHaveURL(/\/admin$/);
  expect((await state(page)).session).toEqual(demoSession);
  expect((await state(page)).users).toEqual(users);
});

test('login required and invalid credentials stay on the form with no session', async ({ page }) => {
  await seedDiscovery(page, { users: demoUsers });
  await page.goto('/login');
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
  await expect(page.getByText('Username is required.', { exact: true })).toBeVisible();
  await expect(page.getByText('Password is required.', { exact: true })).toBeVisible();
  expect((await state(page)).session).toBeNull();
  await login(page, 'reader', 'wrong');
  await expect(page.getByRole('alert')).toHaveText('Invalid username or password.');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByLabel('Password', { exact: true })).toHaveValue('wrong');
  expect((await state(page)).users).toEqual(demoUsers);
  expect((await state(page)).session).toBeNull();
});

for (const reason of ['required', 'reserved', 'duplicate', 'mismatch']) {
  test(`registration rejects ${reason} without changing persisted accounts`, async ({ page }) => {
    await seedDiscovery(page, { users: demoUsers });
    await page.goto('/register');
    if (reason !== 'required') await registration(page, reason === 'reserved' ? ' ADMIN ' : reason === 'duplicate' ? ' Reader ' : 'writer');
    if (reason === 'mismatch') await page.getByLabel('Confirm password', { exact: true }).fill('different');
    await page.getByRole('button', { name: 'Create account', exact: true }).click();
    const message = { required: 'Display name is required.', reserved: 'This username is reserved.',
      duplicate: 'This username is already taken.', mismatch: 'Passwords must match.' }[reason];
    await expect(page.getByText(message, { exact: true })).toBeVisible();
    await expect(page).toHaveURL(/\/register$/);
    expect((await state(page)).users).toEqual(demoUsers);
    expect((await state(page)).session).toBeNull();
  });
}

for (const path of ['/login', '/register']) {
  for (const role of ['user', 'admin']) {
    test(`${role} direct entry to ${path} redirects by role without mutation`, async ({ page }) => {
      const session = { ...demoSession, role };
      await seedDiscovery(page, { session });
      await page.goto(path);
      await expect(page).toHaveURL(role === 'admin' ? /\/admin$/ : /\/blogs$/);
      expect((await state(page)).session).toEqual(session);
      expect((await state(page)).users).toEqual([]);
    });
  }
}

for (const path of ['/blogs', '/admin']) {
  test(`guest direct entry to ${path} redirects to login`, async ({ page }) => {
    await seedDiscovery(page);
    await page.goto(path);
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Log in to WriteSpace');
    expect((await state(page)).session).toBeNull();
  });
}

test('User direct Admin entry is denied without changing identity', async ({ page }) => {
  const session = { userId: demoUsers[0].id, username: 'reader', displayName: 'Demo Reader', role: 'user' };
  await seedDiscovery(page, { users: demoUsers, session });
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/blogs$/);
  expect((await state(page)).session).toEqual(session);
  expect((await state(page)).users).toEqual(demoUsers);
});

/** Inject a browser storage fault after fixture initialization, retaining native reads. */
async function denyWrites(page, key) {
  await page.evaluate((deniedKey) => {
    const native = Storage.prototype.setItem;
    Storage.prototype.setItem = function (name, value) {
      if (name === deniedKey) throw new DOMException('Denied', 'SecurityError');
      native.call(this, name, value);
    };
  }, key);
}

for (const key of ['writespace_users', 'writespace_session']) {
  test(`registration reports ${key} write failure without false navigation`, async ({ page }) => {
    await seedDiscovery(page);
    await page.goto('/register');
    await registration(page);
    await denyWrites(page, key);
    await page.getByRole('button', { name: 'Create account', exact: true }).click();
    await expect(page).toHaveURL(/\/register$/);
    await expect(page.getByRole('alert')).toHaveText(key === 'writespace_users'
      ? 'Could not save in this browser. Your changes have not been saved.'
      : 'Your account was saved, but sign-in failed. Please try logging in.');
    await expect(page.getByLabel('Username', { exact: true })).toHaveValue('Writer');
    await expect(page.getByLabel('Password', { exact: true })).toHaveValue('demo-only');
    const result = await state(page);
    expect(result.session).toBeNull();
    expect(result.users).toHaveLength(key === 'writespace_users' ? 0 : 1);
    if (key === 'writespace_session') {
      expect(result.users[0].username).toBe('Writer');
      await page.getByRole('button', { name: 'Create account', exact: true }).click();
      await expect(page.getByRole('alert')).toHaveText('This username is already taken.');
      expect((await state(page)).users).toEqual(result.users);
      expect((await state(page)).session).toBeNull();
    }
  });
}

test('login storage failure keeps credentials and does not claim authentication', async ({ page }) => {
  await seedDiscovery(page, { users: demoUsers });
  await page.goto('/login');
  await denyWrites(page, 'writespace_session');
  await login(page, 'reader', 'demo-only');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('alert')).toHaveText('Could not save in this browser. Your changes have not been saved.');
  await expect(page.getByLabel('Username', { exact: true })).toHaveValue('reader');
  expect((await state(page)).session).toBeNull();
  expect((await state(page)).users).toEqual(demoUsers);
});

test('mobile public navigation reaches both account forms through links', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seedDiscovery(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await page.getByRole('navigation').getByRole('link', { name: 'Register', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Create your account');
  await page.getByRole('main').getByRole('link', { name: 'Log in', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Log in to WriteSpace');
  await expect(page.getByLabel('Username', { exact: true })).toBeVisible();
  expect((await state(page)).session).toBeNull();
});
