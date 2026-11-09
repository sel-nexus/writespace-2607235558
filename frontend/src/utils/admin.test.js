/** Verify inclusive counts, gated deletion and exact session-checked account writes. */
import { describe, it, expect, vi } from 'vitest';
import { adminCounts, accountDeletionReason, createAdminAccount } from './admin.js';
import { getUsers, saveUsers } from './storage.js';
import { getSession, setSession, clearSession } from './auth.js';
import { SAVE_ERROR } from './accounts.js';

const fixed = { userId: 'admin', username: 'admin', displayName: 'Demo Admin', role: 'admin' };
const existing = {
  id: '48dbb1d0-2150-40fb-a705-42a4202622cf', displayName: 'Reader', username: 'reader',
  password: 'old-secret', role: 'user', createdAt: '2026-11-01T08:00:00.000Z',
};
const form = { displayName: 'New Reader', username: 'NewReader', password: 'demo', confirmPassword: 'demo', role: 'user' };

describe('approved Admin counts and deletion gates', () => {
  it('counts fixed Admin even with empty collections', () => {
    expect(adminCounts()).toEqual({ totalPosts: 0, totalUsers: 1, totalAdmins: 1 });
  });
  it('includes stored Users and Admins but does not double count reserved Admin identities', () => {
    const users = [existing, { ...existing, role: 'admin', username: 'editor' },
      { ...existing, role: 'admin', username: ' ADMIN ' }, { ...existing, username: 'admin' }];
    expect(adminCounts(users, [{}, {}])).toEqual({ totalPosts: 2, totalUsers: 5, totalAdmins: 2 });
    expect(users).toHaveLength(4);
  });
  it('uses the latest default collection reads', () => {
    saveUsers([existing]);
    expect(adminCounts()).toEqual({ totalPosts: 0, totalUsers: 2, totalAdmins: 1 });
  });
  it.each([{ id: 'admin', username: 'other' }, { id: existing.id, username: ' ADMIN ' }])(
    'protects fixed and reserved Admin identity before current account', (account) => {
      expect(accountDeletionReason(account, { userId: account.id })).toMatch(/fixed default Admin/);
    });
  it('protects the current stored account', () => {
    expect(accountDeletionReason(existing, { userId: existing.id })).toMatch(/current account/);
  });
  it('gates every other account regardless of role or session', () => {
    expect(accountDeletionReason(existing, null)).toMatch(/post disposition/);
    expect(accountDeletionReason({ ...existing, role: 'admin' }, fixed)).toMatch(/post disposition/);
    expect(getUsers()).toEqual([]);
  });
});

describe('Admin account creation', () => {
  it.each(['user', 'admin'])('persists an exact %s record and preserves current session and prior accounts', (role) => {
    setSession(fixed);
    saveUsers([existing]);
    const id = '53f2b35c-fc1a-4e66-9a42-2c2a2e4fb1aa';
    vi.spyOn(crypto, 'randomUUID').mockReturnValue(id);
    const result = createAdminAccount({ ...form, role, extra: 'ignored', id: 'forged' });
    expect(result.ok).toBe(true);
    const [old, account] = getUsers();
    expect(old).toEqual(existing);
    expect(account).toEqual({ id, displayName: form.displayName, username: form.username,
      password: form.password, role, createdAt: expect.any(String) });
    expect(new Date(account.createdAt).toISOString()).toBe(account.createdAt);
    expect(result.account).toEqual(account);
    expect(getSession()).toEqual(fixed);
  });
  it.each([null, { ...fixed, role: 'user' }])('rejects guest and User sessions without writing', (session) => {
    if (session) setSession(session);
    expect(createAdminAccount(form)).toMatchObject({ ok: false, message: expect.stringMatching(/Only an Admin/) });
    expect(getUsers()).toEqual([]);
  });
  it('rechecks a session removed after previous access', () => {
    setSession(fixed);
    clearSession();
    expect(createAdminAccount(form).ok).toBe(false);
    expect(getUsers()).toEqual([]);
  });
  it.each(['displayName', 'username', 'password', 'confirmPassword', 'role'])(
    'rejects missing %s without writing', (field) => {
      setSession(fixed);
      expect(createAdminAccount({ ...form, [field]: '' })).toMatchObject({ ok: false, errors: { [field]: expect.any(String) } });
      expect(getUsers()).toEqual([]);
    });
  it.each([null, {}, { ...form, role: 'owner' }, { ...form, password: 123 }, { ...form, displayName: [] }])(
    'rejects invalid input types or unsupported roles', (input) => {
      setSession(fixed);
      expect(createAdminAccount(input).ok).toBe(false);
      expect(getUsers()).toEqual([]);
    });
  it('rejects mismatched confirmation', () => {
    setSession(fixed);
    expect(createAdminAccount({ ...form, confirmPassword: 'different' }).errors.confirmPassword).toMatch(/match/);
    expect(getUsers()).toEqual([]);
  });
  it('rejects reserved username without altering input', () => {
    setSession(fixed);
    const input = { ...form, username: ' ADMIN ' };
    expect(createAdminAccount(input).errors.username).toMatch(/reserved/);
    expect(input.username).toBe(' ADMIN ');
    expect(getUsers()).toEqual([]);
  });
  it('rejects duplicates from latest persisted arrays case-insensitively', () => {
    setSession(fixed);
    saveUsers([existing]);
    expect(createAdminAccount({ ...form, username: ' READER ' }).errors.username).toMatch(/taken/);
    expect(getUsers()).toEqual([existing]);
  });
  it('reports write failure preserving existing accounts and session', () => {
    setSession(fixed);
    saveUsers([existing]);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    expect(createAdminAccount(form)).toEqual({ ok: false, message: SAVE_ERROR });
    expect(getUsers()).toEqual([existing]);
    expect(getSession()).toEqual(fixed);
  });
  it('reports UUID generation failure without writing', () => {
    setSession(fixed);
    vi.spyOn(crypto, 'randomUUID').mockImplementation(() => { throw new Error('unavailable'); });
    expect(createAdminAccount(form)).toEqual({ ok: false, message: SAVE_ERROR });
    expect(getUsers()).toEqual([]);
  });
});
