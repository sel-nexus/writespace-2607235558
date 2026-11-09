/** Exercise real account forms and guards with router destinations confined to tests. */
import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Link, MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { expect, it, vi } from 'vitest';
import App from '../../App.jsx';
import LoginPage from './LoginPage.jsx';
import RegisterPage from './RegisterPage.jsx';
import { ProtectedRoute } from '../../components/ProtectedRoute.jsx';
import { FormField } from '../../components/FormField.jsx';
import { getSession, setSession } from '../../utils/auth.js';
import { getUsers, saveUsers } from '../../utils/storage.js';
import { SAVE_ERROR, PARTIAL_ERROR } from '../../utils/accounts.js';

const account = { id: '48dbb1d0-2150-40fb-a705-42a4202622cf', displayName: 'Reader', username: 'reader',
  password: 'demo-only', role: 'user', createdAt: '2026-11-01T08:00:00.000Z' };
const fixed = { userId: 'admin', username: 'admin', displayName: 'Demo Admin', role: 'admin' };

/** Expose the router's actual destination for policy assertions. */
function Destination() {
  const location = useLocation();
  return (
    <>
      <h1>{location.pathname}</h1>
      <Link to="/">Return to public site</Link>
    </>
  );
}

/** Mount real forms and guards with test-only role destinations. */
function mount(path = '/login') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/" element={<Destination />} />
        <Route element={<ProtectedRoute guestOnly />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
        </Route>
        <Route element={<ProtectedRoute />}>
          <Route path="/blogs" element={<Destination />} />
        </Route>
        <Route element={<ProtectedRoute adminOnly />}>
          <Route path="/admin" element={<Destination />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

/** Fill registration through stable labelled controls. */
async function fillRegistration(user, username = 'writer') {
  await user.type(screen.getByLabelText('Display name'), 'Writer');
  await user.type(screen.getByLabelText('Username'), username);
  await user.type(screen.getByLabelText('Password'), 'demo-only');
  await user.type(screen.getByLabelText('Confirm password'), 'demo-only');
}

it.each(['/login', '/register'])('mounts %s without writes or implicit navigation and discloses demo limitations', (path) => {
  const writes = vi.spyOn(Storage.prototype, 'setItem');
  mount(path);
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(path === '/login' ? 'Log in to WriteSpace' : 'Create your account');
  expect(screen.getByRole('complementary', { name: 'Demo limitations' })).toHaveTextContent('plaintext in localStorage');
  expect(writes).not.toHaveBeenCalled();
  expect(getSession()).toBeNull();
  expect(getUsers()).toEqual([]);
});
it.each(['/login', '/register'])('shows associated required field errors on %s without writes', async (path) => {
  const user = userEvent.setup();
  mount(path);
  await user.click(screen.getByRole('button', { name: path === '/login' ? 'Log in' : 'Create account' }));
  for (const label of path === '/login' ? ['Username', 'Password'] : ['Display name', 'Username', 'Password', 'Confirm password']) {
    const field = screen.getByLabelText(label);
    expect(field).toHaveAttribute('aria-required', 'true');
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(document.getElementById(field.getAttribute('aria-describedby'))).toHaveAttribute('role', 'alert');
  }
  expect(getUsers()).toEqual([]);
  expect(getSession()).toBeNull();
});
it.each(['user', 'admin'])('logs stored %s in and redirects only after exact session save', async (role) => {
  saveUsers([{ ...account, role }]);
  const user = userEvent.setup();
  mount();
  await user.type(screen.getByLabelText('Username'), ' READER ');
  await user.type(screen.getByLabelText('Password'), account.password);
  await user.click(screen.getByRole('button', { name: 'Log in' }));
  expect(screen.getByRole('heading')).toHaveTextContent(role === 'admin' ? '/admin' : '/blogs');
  expect(getSession()).toEqual({ userId: account.id, username: account.username, displayName: account.displayName, role });
  expect(getUsers()).toEqual([{ ...account, role }]);
});
it('signs fixed Admin in ahead of a stored shadow identity', async () => {
  saveUsers([{ ...account, username: 'admin' }]);
  const user = userEvent.setup();
  mount();
  expect(screen.getByText(/Fixed demo Admin/)).toHaveTextContent('username admin, password admin');
  await user.type(screen.getByLabelText('Username'), 'admin');
  await user.type(screen.getByLabelText('Password'), 'admin');
  await user.click(screen.getByRole('button', { name: 'Log in' }));
  expect(screen.getByRole('heading')).toHaveTextContent('/admin');
  expect(getSession()).toEqual(fixed);
  expect(getUsers()[0].id).toBe(account.id);
});
it('preserves invalid credentials and clears feedback after explicit correction', async () => {
  saveUsers([account]);
  const user = userEvent.setup();
  mount();
  await user.type(screen.getByLabelText('Username'), 'reader');
  await user.type(screen.getByLabelText('Password'), 'wrong');
  await user.click(screen.getByRole('button', { name: 'Log in' }));
  expect(screen.getByRole('alert')).toHaveTextContent('Invalid username or password.');
  expect(screen.getByLabelText('Password')).toHaveValue('wrong');
  expect(getSession()).toBeNull();
  expect(getUsers()).toEqual([account]);
  await user.clear(screen.getByLabelText('Password'));
  await user.type(screen.getByLabelText('Password'), account.password);
  await user.click(screen.getByRole('button', { name: 'Log in' }));
  expect(screen.getByRole('heading')).toHaveTextContent('/blogs');
  expect(getSession().userId).toBe(account.id);
});
it('stays on login and retains inputs on session failure, allowing explicit retry', async () => {
  const user = userEvent.setup();
  mount();
  await user.type(screen.getByLabelText('Username'), 'admin');
  await user.type(screen.getByLabelText('Password'), 'admin');
  const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Denied'); });
  await user.click(screen.getByRole('button', { name: 'Log in' }));
  expect(screen.getByRole('alert')).toHaveTextContent(SAVE_ERROR);
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Log in to WriteSpace');
  expect(screen.getByLabelText('Username')).toHaveValue('admin');
  expect(screen.getByLabelText('Password')).toHaveValue('admin');
  expect(getSession()).toBeNull();
  write.mockRestore();
  await user.click(screen.getByRole('button', { name: 'Log in' }));
  expect(getSession()).toEqual(fixed);
  expect(screen.getByRole('heading')).toHaveTextContent('/admin');
});
it('registers through account links and saves exact account and session before routing', async () => {
  const user = userEvent.setup();
  mount();
  await user.click(within(screen.getByRole('main')).getByRole('link', { name: 'Register' }));
  await fillRegistration(user);
  await user.click(screen.getByRole('button', { name: 'Create account' }));
  const saved = getUsers()[0];
  expect(saved).toEqual({ id: expect.stringMatching(/^[0-9a-f-]{36}$/), displayName: 'Writer', username: 'writer',
    password: 'demo-only', role: 'user', createdAt: expect.any(String) });
  expect(new Date(saved.createdAt).toISOString()).toBe(saved.createdAt);
  expect(getSession()).toEqual({ userId: saved.id, username: 'writer', displayName: 'Writer', role: 'user' });
  expect(screen.getByRole('heading')).toHaveTextContent('/blogs');
});
it.each(['reserved', 'duplicate', 'mismatch'])('rejects %s registration with field-level feedback and no mutation', async (reason) => {
  saveUsers([account]);
  const user = userEvent.setup();
  mount('/register');
  await fillRegistration(user, reason === 'reserved' ? ' AdMiN ' : reason === 'duplicate' ? ' READER ' : 'writer');
  if (reason === 'mismatch') await user.type(screen.getByLabelText('Confirm password'), 'different');
  await user.click(screen.getByRole('button', { name: 'Create account' }));
  expect(screen.getByRole('alert')).toHaveTextContent(reason === 'reserved' ? 'This username is reserved.'
    : reason === 'duplicate' ? 'This username is already taken.' : 'Passwords must match.');
  expect(getUsers()).toEqual([account]);
  expect(getSession()).toBeNull();
  expect(screen.getByLabelText('Display name')).toHaveValue('Writer');
});
it('revalidates a duplicate introduced while the registration form is open', async () => {
  const user = userEvent.setup();
  mount('/register');
  await fillRegistration(user, 'reader');
  saveUsers([account]);
  await user.click(screen.getByRole('button', { name: 'Create account' }));
  expect(screen.getByRole('alert')).toHaveTextContent('This username is already taken.');
  expect(getUsers()).toEqual([account]);
  expect(getSession()).toBeNull();
});
it('keeps registration values on failed account save and succeeds only on explicit retry', async () => {
  const user = userEvent.setup();
  mount('/register');
  await fillRegistration(user);
  const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Quota'); });
  await user.click(screen.getByRole('button', { name: 'Create account' }));
  expect(screen.getByRole('alert')).toHaveTextContent(SAVE_ERROR);
  expect(screen.getByLabelText('Display name')).toHaveValue('Writer');
  expect(screen.getByLabelText('Username')).toHaveValue('writer');
  expect(screen.getByLabelText('Password')).toHaveValue('demo-only');
  expect(screen.getByLabelText('Confirm password')).toHaveValue('demo-only');
  expect(getUsers()).toEqual([]);
  expect(getSession()).toBeNull();
  write.mockRestore();
  await user.click(screen.getByRole('button', { name: 'Create account' }));
  expect(getUsers()).toHaveLength(1);
  expect(getSession().username).toBe('writer');
  expect(screen.getByRole('heading')).toHaveTextContent('/blogs');
});
it('reports partial failure, rejects duplicate resubmission and permits saved-account login', async () => {
  const user = userEvent.setup();
  mount('/register');
  await fillRegistration(user);
  const native = Storage.prototype.setItem;
  const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
    if (key === 'writespace_session') throw new DOMException('Denied');
    native.call(this, key, value);
  });
  await user.click(screen.getByRole('button', { name: 'Create account' }));
  expect(screen.getByRole('alert')).toHaveTextContent(PARTIAL_ERROR);
  const saved = getUsers();
  expect(saved).toHaveLength(1);
  expect(getSession()).toBeNull();
  expect(screen.getByLabelText('Password')).toHaveValue('demo-only');
  write.mockRestore();
  await user.click(screen.getByRole('button', { name: 'Create account' }));
  expect(screen.getByRole('alert')).toHaveTextContent('This username is already taken.');
  expect(getUsers()).toEqual(saved);
  expect(getSession()).toBeNull();
  await user.click(within(screen.getByRole('main')).getByRole('link', { name: 'Log in' }));
  await user.type(screen.getByLabelText('Username'), 'writer');
  await user.type(screen.getByLabelText('Password'), 'demo-only');
  await user.click(screen.getByRole('button', { name: 'Log in' }));
  expect(getSession().userId).toBe(saved[0].id);
  expect(screen.getByRole('heading')).toHaveTextContent('/blogs');
});
it.each(['/login', '/register'])('redirects authenticated visitors away from %s by role', (path) => {
  for (const role of ['user', 'admin']) {
    setSession({ ...fixed, role });
    const view = mount(path);
    expect(screen.getByRole('heading')).toHaveTextContent(role === 'admin' ? '/admin' : '/blogs');
    expect(getSession()).toEqual({ ...fixed, role });
    view.unmount();
  }
});
it.each(['/blogs', '/admin'])('redirects guests from %s to login without writes', (path) => {
  mount(path);
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Log in to WriteSpace');
  expect(getSession()).toBeNull();
  expect(getUsers()).toEqual([]);
});
it('denies User Admin access and allows Admin without changing either session', () => {
  setSession({ ...fixed, role: 'user' });
  const view = mount('/admin');
  expect(screen.getByRole('heading')).toHaveTextContent('/blogs');
  expect(getSession().role).toBe('user');
  view.unmount();
  setSession(fixed);
  mount('/admin');
  expect(screen.getByRole('heading')).toHaveTextContent('/admin');
  expect(getSession()).toEqual(fixed);
});
it.each(['{', '{"role":"admin"}'])('fails closed for malformed session %s', (raw) => {
  localStorage.setItem('writespace_session', raw);
  mount('/admin');
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Log in to WriteSpace');
  expect(getSession()).toBeNull();
  expect(localStorage.getItem('writespace_session')).toBe(raw);
});
it('re-reads guards on rerender and supports wrapped children without nested routes', () => {
  const tree = (
    <MemoryRouter>
      <ProtectedRoute guestOnly>
        <p>Guest content</p>
      </ProtectedRoute>
    </MemoryRouter>
  );
  const view = render(tree);
  expect(screen.getByText('Guest content')).toBeInTheDocument();
  setSession(fixed);
  view.rerender(
    <MemoryRouter>
      <ProtectedRoute guestOnly>
        <p>Guest content</p>
      </ProtectedRoute>
    </MemoryRouter>,
  );
  expect(screen.queryByText('Guest content')).not.toBeInTheDocument();
  expect(getSession()).toEqual(fixed);
});
it('wires real App guest routes but adds no production destination placeholders', async () => {
  const user = userEvent.setup();
  render(
    <MemoryRouter initialEntries={['/login']}>
      <App />
    </MemoryRouter>,
  );
  await user.type(screen.getByLabelText('Username'), 'admin');
  await user.type(screen.getByLabelText('Password'), 'admin');
  await user.click(screen.getByRole('button', { name: 'Log in' }));
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Page not found');
  expect(getSession()).toEqual(fixed);
  await user.click(screen.getByRole('button', { name: 'Log out' }));
  expect(getSession()).toBeNull();
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Room for your words.');
});
it('supports native select and textarea, optional fields and stable error associations', async () => {
  const user = userEvent.setup();
  const change = vi.fn();
  const view = render(
    <>
      <FormField as="select" id="role" label="Role" defaultValue="user" onChange={change}>
        <option value="user">User</option>
        <option value="admin">Admin</option>
      </FormField>
      <FormField as="textarea" id="note" label="Note" required={false} defaultValue="Text" error="Invalid note" />
    </>,
  );
  await user.selectOptions(screen.getByRole('combobox', { name: 'Role' }), 'admin');
  expect(screen.getByLabelText('Role')).toHaveValue('admin');
  expect(screen.getByLabelText('Note')).toHaveAttribute('aria-required', 'false');
  expect(screen.getByLabelText('Note')).toHaveAttribute('aria-describedby', 'note-error');
  expect(screen.getByRole('alert')).toHaveTextContent('Invalid note');
  view.rerender(<FormField as="textarea" id="note" label="Note" required={false} defaultValue="Text" />);
  expect(screen.getByLabelText('Note')).toHaveAttribute('aria-invalid', 'false');
  expect(screen.getByLabelText('Note')).not.toHaveAttribute('aria-describedby');
});
