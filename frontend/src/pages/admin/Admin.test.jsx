/** Exercise real Admin routes, explicit controls and persistence failures. */
import { StrictMode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import App from '../../App.jsx';
import { setSession, clearSession, getSession } from '../../utils/auth.js';
import { savePosts, getPosts, saveUsers, getUsers } from '../../utils/storage.js';
import { SAVE_ERROR } from '../../utils/accounts.js';

const admin = { userId: 'admin', username: 'admin', displayName: 'Demo Admin', role: 'admin' };
const account = {
  id: '48dbb1d0-2150-40fb-a705-42a4202622cf', displayName: 'Stored Admin', username: 'editor',
  password: 'never-show-me', role: 'admin', createdAt: '2026-11-01T08:00:00.000Z',
};
const posts = [2, 6, 1, 4, 3, 5].map((day) => ({
  id: `53f2b35c-fc1a-4e66-9a42-2c2a2e4fb1a${day}`, title: `Story ${day}`,
  content: `Local body ${day}`, createdAt: `2026-11-0${day}T08:00:00.000Z`,
  authorId: account.id, authorName: account.displayName,
}));

/** Mount actual route guards and pages under a single memory router. */
function mount(path = '/admin') {
  return render(
    <StrictMode>
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </StrictMode>
  );
}

/** Fill required fields as a user without bypassing form controls. */
async function fill(user, username = 'new-reader', role = 'user') {
  await user.type(screen.getByLabelText('Display name'), 'New Account');
  await user.type(screen.getByLabelText('Username'), username);
  await user.type(screen.getByLabelText('Password', { exact: true }), 'demo-password');
  await user.type(screen.getByLabelText('Confirm password'), 'demo-password');
  await user.selectOptions(screen.getByLabelText('Role'), role);
}

describe('Admin route policy and dashboard', () => {
  it.each(['/admin', '/users'])('denies guests at %s', (path) => {
    mount(path);
    expect(screen.getByRole('heading', { name: 'Log in to WriteSpace' })).toBeVisible();
    expect(getUsers()).toEqual([]);
  });
  it.each(['/admin', '/users'])('denies Users at %s', (path) => {
    setSession({ ...admin, role: 'user' });
    mount(path);
    expect(screen.queryByRole('heading', { name: 'Admin dashboard' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'User management' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Write a post' })).toBeVisible();
  });
  it('renders exactly three inclusive counts, newest five controls and no render mutation', () => {
    setSession(admin);
    saveUsers([account, { ...account, id: posts[0].id, username: 'ADMIN' }]);
    savePosts(posts);
    const write = vi.spyOn(Storage.prototype, 'setItem');
    const confirm = vi.spyOn(window, 'confirm');
    mount();
    const stats = screen.getAllByRole('definition')[0].parentElement.parentElement;
    expect(within(stats).getAllByRole('term')).toHaveLength(3);
    expect(screen.getByText('Total Posts').nextElementSibling).toHaveTextContent('6');
    expect(screen.getByText('Total Users').nextElementSibling).toHaveTextContent('3');
    expect(screen.getByText('Total Admins').nextElementSibling).toHaveTextContent('2');
    expect(screen.getByText(/fourth statistic awaits/)).toBeVisible();
    expect(screen.getAllByRole('article').map((article) => within(article).getByRole('heading').textContent))
      .toEqual(['Story 6', 'Story 5', 'Story 4', 'Story 3', 'Story 2']);
    expect(screen.getByRole('link', { name: 'Read Story 6' })).toHaveAttribute('href', '/blog/' + posts[1].id);
    expect(screen.getByRole('link', { name: 'Edit Story 6' })).toHaveAttribute('href', '/edit/' + posts[1].id);
    expect(screen.getByRole('button', { name: 'Delete Story 6' })).toBeEnabled();
    expect(write).not.toHaveBeenCalled();
    expect(confirm).not.toHaveBeenCalled();
  });
  it('shows empty posts and real quick actions', async () => {
    setSession(admin);
    mount();
    expect(screen.getByText(/No posts yet/)).toBeVisible();
    expect(screen.getByRole('link', { name: 'Write a new post' })).toHaveAttribute('href', '/write');
    const user = userEvent.setup();
    await user.click(screen.getByRole('link', { name: 'Manage accounts' }));
    expect(screen.getByRole('heading', { name: 'User management' })).toBeVisible();
  });
  it('reads and edits recent posts through real links', async () => {
    setSession(admin);
    savePosts(posts);
    mount();
    const user = userEvent.setup();
    await user.click(screen.getByRole('link', { name: 'Read Story 6' }));
    expect(screen.getByText('Local body 6')).toBeVisible();
    await user.click(screen.getByRole('link', { name: 'Admin dashboard' }));
    await user.click(screen.getByRole('link', { name: 'Edit Story 6' }));
    expect(screen.getByLabelText('Title')).toHaveValue('Story 6');
  });
  it('cancelled deletion leaves counts and collection unchanged', async () => {
    setSession(admin); savePosts(posts); mount();
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Delete Story 6' }));
    expect(getPosts()).toEqual(posts);
    expect(screen.getByText('Total Posts').nextElementSibling).toHaveTextContent('6');
  });
  it('successful deletion updates count and fills recent list from latest posts', async () => {
    setSession(admin); savePosts(posts); mount();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Delete Story 6' }));
    expect(getPosts()).toEqual(posts.filter((post) => post.title !== 'Story 6'));
    expect(screen.queryByRole('button', { name: 'Delete Story 6' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Read Story 1' })).toBeVisible();
    expect(screen.getByText('Total Posts').nextElementSibling).toHaveTextContent('5');
  });
  it('failed deletion retains count and list and reports approved failure', async () => {
    setSession(admin); savePosts(posts); mount();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    await userEvent.setup().click(screen.getByRole('button', { name: 'Delete Story 6' }));
    expect(screen.getByRole('alert')).toHaveTextContent(SAVE_ERROR);
    expect(screen.getByText('Total Posts').nextElementSibling).toHaveTextContent('6');
    expect(screen.getByRole('link', { name: 'Read Story 6' })).toBeVisible();
    expect(getPosts()).toEqual(posts);
  });
  it.each(['before', 'during'])('rejects stale Admin session %s confirmation', async (timing) => {
    setSession(admin); savePosts(posts); mount();
    const confirm = vi.spyOn(window, 'confirm').mockImplementation(() => {
      clearSession(); return true;
    });
    if (timing === 'before') clearSession();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Delete Story 6' }));
    expect(screen.getByRole('alert')).toHaveTextContent(/Only an Admin/);
    expect(getPosts()).toEqual(posts);
    if (timing === 'before') expect(confirm).not.toHaveBeenCalled();
  });
  it('rejects a post removed before confirmation', async () => {
    setSession(admin); savePosts(posts); mount();
    savePosts([]);
    const confirm = vi.spyOn(window, 'confirm');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Delete Story 6' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Post not found');
    expect(confirm).not.toHaveBeenCalled();
    expect(getPosts()).toEqual([]);
  });
  it('rejects a post removed during confirmation without false list success', async () => {
    setSession(admin); savePosts(posts); mount();
    vi.spyOn(window, 'confirm').mockImplementation(() => { savePosts([]); return true; });
    await userEvent.setup().click(screen.getByRole('button', { name: 'Delete Story 6' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Post not found');
    expect(screen.getByText('Total Posts').nextElementSibling).toHaveTextContent('6');
  });
});

describe('account management', () => {
  it('shows empty stored state and protected fixed Admin without render writes', () => {
    setSession(admin);
    const write = vi.spyOn(Storage.prototype, 'setItem');
    mount('/users');
    expect(screen.getByText(/No stored accounts yet/)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Delete admin' })).toBeDisabled();
    expect(write).not.toHaveBeenCalled();
  });
  it('protects current and other accounts of both roles and never displays passwords', async () => {
    saveUsers([account, { ...account, id: posts[0].id, username: 'reader', role: 'user' }]);
    setSession({ userId: account.id, username: account.username, displayName: account.displayName, role: 'admin' });
    mount('/users');
    expect(screen.getByText(/current account/)).toBeVisible();
    expect(screen.getByText(/post disposition \(retain/)).toBeVisible();
    const list = screen.getByRole('list', { name: 'Accounts' });
    expect(within(list).queryByText(account.password)).not.toBeInTheDocument();
    const before = getUsers();
    for (const button of within(list).getAllByRole('button')) {
      expect(button).toBeDisabled();
      expect(button).toHaveAttribute('aria-describedby');
      await userEvent.setup().click(button);
    }
    expect(getUsers()).toEqual(before);
  });
  it.each(['user', 'admin'])('creates a %s through controlled fields and updates list without changing session', async (role) => {
    setSession(admin); mount('/users');
    const user = userEvent.setup(); await fill(user, 'new-account', role);
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    expect(getUsers()).toHaveLength(1);
    expect(getUsers()[0].role).toBe(role);
    expect(screen.getByRole('status')).toHaveTextContent('Account created');
    expect(screen.getByRole('button', { name: 'Delete new-account' })).toBeDisabled();
    expect(screen.getByLabelText('Username')).toHaveValue('');
    expect(getSession()).toEqual(admin);
  });
  it('exposes accessible required errors without writes', async () => {
    setSession(admin); mount('/users');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Create account' }));
    for (const label of ['Display name', 'Username', 'Password', 'Confirm password']) {
      expect(screen.getByLabelText(label, { exact: true })).toHaveAttribute('aria-invalid', 'true');
    }
    expect(getUsers()).toEqual([]);
  });
  it.each(['reserved', 'duplicate', 'mismatch'])('preserves inputs for %s validation', async (kind) => {
    setSession(admin); mount('/users');
    if (kind === 'duplicate') saveUsers([account]);
    const user = userEvent.setup();
    const username = kind === 'reserved' ? 'ADMIN' : kind === 'duplicate' ? 'EDITOR' : 'new-reader';
    await fill(user, username);
    if (kind === 'mismatch') await user.type(screen.getByLabelText('Confirm password'), 'extra');
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    expect(screen.getByRole('alert')).toHaveTextContent(kind === 'mismatch' ? /match/ : kind === 'reserved' ? /reserved/ : /taken/);
    expect(screen.getByLabelText('Username')).toHaveValue(username);
    expect(getUsers()).toHaveLength(kind === 'duplicate' ? 1 : 0);
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });
  it('preserves all fields, selected role and prior list after write failure', async () => {
    setSession(admin); saveUsers([account]); mount('/users');
    const user = userEvent.setup(); await fill(user, 'new-account', 'admin');
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    expect(screen.getByRole('alert')).toHaveTextContent(SAVE_ERROR);
    expect(screen.getByLabelText('Display name')).toHaveValue('New Account');
    expect(screen.getByLabelText('Username')).toHaveValue('new-account');
    expect(screen.getByLabelText('Password', { exact: true })).toHaveValue('demo-password');
    expect(screen.getByLabelText('Confirm password')).toHaveValue('demo-password');
    expect(screen.getByLabelText('Role')).toHaveValue('admin');
    expect(getUsers()).toEqual([account]);
    expect(screen.queryByRole('button', { name: 'Delete new-account' })).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });
  it('appends to latest accounts added after mount and renders names as text', async () => {
    setSession(admin); mount('/users');
    saveUsers([account]);
    const user = userEvent.setup(); await fill(user);
    await user.clear(screen.getByLabelText('Display name'));
    await user.type(screen.getByLabelText('Display name'), '<script>alert(1)</script>');
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    expect(getUsers()).toHaveLength(2);
    expect(getUsers()[0]).toEqual(account);
    expect(screen.getByRole('heading', { name: '<script>alert(1)</script>' })).toBeVisible();
    expect(screen.getByRole('list', { name: 'Accounts' }).querySelector('script')).toBeNull();
  });
  it('explicit resubmission recovers from a write fault without automatic retries', async () => {
    setSession(admin); mount('/users');
    const user = userEvent.setup(); await fill(user);
    const fault = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    expect(getUsers()).toEqual([]);
    expect(screen.getByRole('alert')).toHaveTextContent(SAVE_ERROR);
    fault.mockRestore();
    saveUsers([account]);
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    expect(getUsers()).toHaveLength(2);
    expect(getUsers()[0]).toEqual(account);
    expect(screen.getByRole('status')).toHaveTextContent('Account created');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
  it('denies creation after Admin session becomes stale and preserves fields', async () => {
    setSession(admin); mount('/users');
    const user = userEvent.setup(); await fill(user);
    setSession({ ...admin, role: 'user' });
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    expect(screen.getByRole('alert')).toHaveTextContent(/Only an Admin/);
    expect(screen.getByLabelText('Username')).toHaveValue('new-reader');
    expect(getUsers()).toEqual([]);
  });
});
