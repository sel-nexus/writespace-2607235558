/** Verify account decisions through real storage adapters and fault injection. */
import { expect, it, vi } from 'vitest';
import { loginAccount, registerAccount, validateLogin, validateRegistration, normalizeUsername, roleHome,
  SAVE_ERROR, PARTIAL_ERROR } from './accounts.js';
import { getUsers, saveUsers } from './storage.js';
import { getSession, setSession } from './auth.js';

const account = {
  id: '48dbb1d0-2150-40fb-a705-42a4202622cf', displayName: 'Reader', username: 'Reader',
  password: 'demo-only', role: 'user', createdAt: '2026-11-01T08:00:00.000Z',
};
const form = { displayName: ' New Writer ', username: ' NewWriter ', password: ' demo ', confirmPassword: ' demo ' };
const fixed = { userId: 'admin', username: 'admin', displayName: 'Demo Admin', role: 'admin' };

it.each([[' ADMIN ', 'admin'], ['Reader', 'reader'], ['', ''], [null, ''], [42, '']])(
  'normalizes %s for comparison only', (value, expected) => expect(normalizeUsername(value)).toBe(expected),
);
it.each(['user', 'admin'])('selects the %s role home', (role) => {
  expect(roleHome({ role })).toBe(role === 'admin' ? '/admin' : '/blogs');
});
it('accepts complete matching registration and login without writes', () => {
  expect(validateRegistration(form, [account])).toEqual({});
  expect(validateLogin(form)).toEqual({});
  expect(getUsers()).toEqual([]);
  expect(getSession()).toBeNull();
});
it.each(['displayName', 'username', 'password', 'confirmPassword'])(
  'rejects each missing or invalid registration field: %s', (field) => {
    for (const value of ['', '   ', null, 42, undefined]) {
      expect(registerAccount({ ...form, [field]: value }).errors[field]).toBeTruthy();
      expect(getUsers()).toEqual([]);
      expect(getSession()).toBeNull();
    }
  },
);
it.each([undefined, null, {}])('rejects absent form %s without writes', (value) => {
  expect(validateLogin(value)).toEqual({ username: 'Username is required.', password: 'Password is required.' });
  expect(registerAccount(value).ok).toBe(false);
  expect(loginAccount(value).ok).toBe(false);
  expect(getUsers()).toEqual([]);
  expect(getSession()).toBeNull();
});
it('rejects mismatched passwords without trimming their comparison', () => {
  expect(registerAccount({ ...form, confirmPassword: 'demo' }).errors.confirmPassword).toBe('Passwords must match.');
  expect(getUsers()).toEqual([]);
  expect(getSession()).toBeNull();
});
it.each(['admin', 'ADMIN', ' Admin '])('rejects reserved registration %s', (username) => {
  expect(registerAccount({ ...form, username }).errors.username).toBe('This username is reserved.');
  expect(getUsers()).toEqual([]);
  expect(getSession()).toBeNull();
});
it('re-reads duplicates on each explicit registration attempt', () => {
  expect(validateRegistration({ ...form, username: 'reader' })).toEqual({});
  saveUsers([account]);
  expect(registerAccount({ ...form, username: ' READER ' }).errors.username).toBe('This username is already taken.');
  expect(getUsers()).toEqual([account]);
  expect(getSession()).toBeNull();
});
it('creates UUID and ISO exact records preserving values and ignoring supplied role/extras', () => {
  saveUsers([account]);
  const id = '53f2b35c-fc1a-4e66-9a42-2c2a2e4fb1a1';
  vi.spyOn(crypto, 'randomUUID').mockReturnValue(id);
  const before = Date.now();
  expect(registerAccount({ ...form, role: 'admin', extra: true })).toEqual({ ok: true, destination: '/blogs' });
  const users = getUsers();
  expect(users).toHaveLength(2);
  expect(users[0]).toEqual(account);
  expect(users[1]).toEqual({ id, displayName: form.displayName, username: form.username,
    password: form.password, role: 'user', createdAt: expect.any(String) });
  expect(new Date(users[1].createdAt).toISOString()).toBe(users[1].createdAt);
  expect(Date.parse(users[1].createdAt)).toBeGreaterThanOrEqual(before);
  expect(getSession()).toEqual({ userId: id, displayName: form.displayName, username: form.username, role: 'user' });
  expect(Object.keys(localStorage).sort()).toEqual(['writespace_session', 'writespace_users']);
});
it('does not create a session when saving users fails, then explicit retry saves once', () => {
  saveUsers([account]);
  const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Quota'); });
  expect(registerAccount(form)).toEqual({ ok: false, message: SAVE_ERROR });
  expect(getUsers()).toEqual([account]);
  expect(getSession()).toBeNull();
  write.mockRestore();
  expect(registerAccount(form).ok).toBe(true);
  expect(getUsers()).toHaveLength(2);
  expect(getSession().username).toBe(form.username);
});
it('keeps saved account on failed session and rejects duplicate retry before later login', () => {
  const native = Storage.prototype.setItem;
  const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
    if (key === 'writespace_session') throw new DOMException('Denied');
    native.call(this, key, value);
  });
  expect(registerAccount(form)).toEqual({ ok: false, message: PARTIAL_ERROR });
  const saved = getUsers();
  expect(saved).toHaveLength(1);
  expect(getSession()).toBeNull();
  write.mockRestore();
  expect(registerAccount(form).errors.username).toBe('This username is already taken.');
  expect(getUsers()).toEqual(saved);
  expect(getSession()).toBeNull();
  expect(loginAccount(form).ok).toBe(true);
  expect(getSession().userId).toBe(saved[0].id);
});
it('handles unavailable UUID generation without any persistence', () => {
  vi.spyOn(crypto, 'randomUUID').mockImplementation(() => { throw new Error('Unavailable'); });
  expect(registerAccount(form)).toEqual({ ok: false, message: SAVE_ERROR });
  expect(getUsers()).toEqual([]);
  expect(getSession()).toBeNull();
});
it('checks fixed Admin before stored users and does not fall back to shadow credentials', () => {
  const shadow = { ...account, username: ' ADMIN ', password: 'shadow', role: 'user' };
  saveUsers([shadow]);
  expect(loginAccount({ username: 'ADMIN', password: 'shadow' })).toEqual({ ok: false, message: 'Invalid username or password.' });
  expect(getSession()).toBeNull();
  expect(loginAccount({ username: ' Admin ', password: 'admin' })).toEqual({ ok: true, destination: '/admin' });
  expect(getSession()).toEqual(fixed);
  expect(getUsers()).toEqual([shadow]);
});
it.each(['user', 'admin'])('logs in fresh stored %s with exact session projection', (role) => {
  saveUsers([{ ...account, role }]);
  expect(loginAccount({ username: ' reader ', password: account.password })).toEqual({ ok: true,
    destination: role === 'admin' ? '/admin' : '/blogs' });
  expect(getSession()).toEqual({ userId: account.id, username: account.username, displayName: account.displayName, role });
  expect(getUsers()).toEqual([{ ...account, role }]);
});
it.each([{ username: 'missing', password: 'demo-only' }, { username: 'reader', password: 'DEMO-ONLY' },
  { username: 'admin', password: ' admin ' }])('rejects invalid credentials %s without mutation', (credentials) => {
  saveUsers([account]);
  expect(loginAccount(credentials)).toEqual({ ok: false, message: 'Invalid username or password.' });
  expect(getSession()).toBeNull();
  expect(getUsers()).toEqual([account]);
});
it.each(['reader', 'admin'])('preserves previous identity on failed %s session write', (username) => {
  saveUsers([account]);
  setSession(fixed);
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Denied'); });
  expect(loginAccount({ username, password: username === 'admin' ? 'admin' : account.password })).toEqual({ ok: false, message: SAVE_ERROR });
  expect(getSession()).toEqual(fixed);
  expect(getUsers()).toEqual([account]);
});
it('uses current password rather than stale login data', () => {
  saveUsers([account]);
  saveUsers([{ ...account, password: 'changed' }]);
  expect(loginAccount({ username: 'reader', password: account.password }).ok).toBe(false);
  expect(getSession()).toBeNull();
  expect(loginAccount({ username: 'reader', password: 'changed' }).ok).toBe(true);
  expect(getUsers()[0].password).toBe('changed');
});
it.each(['{', '{}', '[null]'])('fails closed for corrupt users %s while fixed Admin still works', (raw) => {
  localStorage.setItem('writespace_users', raw);
  expect(loginAccount({ username: 'reader', password: account.password }).ok).toBe(false);
  expect(getSession()).toBeNull();
  expect(loginAccount({ username: 'admin', password: 'admin' }).ok).toBe(true);
  expect(getSession()).toEqual(fixed);
  expect(localStorage.getItem('writespace_users')).toBe(raw);
});
