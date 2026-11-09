/** Verify fail-closed identity reads and truthful session state transitions. */
import { expect, it, vi } from 'vitest';
import { getSession, setSession, clearSession } from './auth.js';

const session = { userId: 'admin', username: 'admin', displayName: 'Admin', role: 'admin' };

it('treats an absent session as guest without creating keys', () => {
  expect(getSession()).toBeNull();
  expect(localStorage.length).toBe(0);
});

it.each(['admin', 'user'])('roundtrips the exact %s session and re-reads changed state', (role) => {
  const identity = { ...session, role };
  expect(setSession(identity)).toBe(true);
  expect(getSession()).toEqual(identity);
  expect(JSON.parse(localStorage.getItem('writespace_session'))).toEqual(identity);
  expect(Object.keys(localStorage)).toEqual(['writespace_session']);
  getSession().displayName = 'Changed locally';
  expect(getSession()).toEqual(identity);
  expect(setSession({ ...identity, displayName: 'Latest' })).toBe(true);
  expect(getSession().displayName).toBe('Latest');
});

it.each(['{', 'null', '[]', '{}', 'true', '12', '"text"'])('fails closed on corrupt raw session %s without repair', (raw) => {
  localStorage.setItem('writespace_session', raw);
  expect(getSession()).toBeNull();
  expect(localStorage.getItem('writespace_session')).toBe(raw);
});

it.each(Object.keys(session))('rejects missing identity field %s', (field) => {
  const invalid = { ...session };
  delete invalid[field];
  expect(setSession(invalid)).toBe(false);
  localStorage.setItem('writespace_session', JSON.stringify(invalid));
  expect(getSession()).toBeNull();
});

it.each(Object.keys(session))('rejects blank and wrongly typed field %s', (field) => {
  for (const value of ['', '  ', null, 3, {}]) {
    const invalid = { ...session, [field]: value };
    expect(setSession(invalid)).toBe(false);
    localStorage.setItem('writespace_session', JSON.stringify(invalid));
    expect(getSession()).toBeNull();
  }
});

it.each([null, [], {}, { ...session, role: 'owner' }, { ...session, password: 'extra' }])('rejects invalid sessions without replacing the existing identity', (invalid) => {
  setSession(session);
  expect(setSession(invalid)).toBe(false);
  expect(getSession()).toEqual(session);
});

it('fails closed on denied reads without removing the stored session', () => {
  setSession(session);
  const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new DOMException('Denied'); });
  expect(getSession()).toBeNull();
  spy.mockRestore();
  expect(getSession()).toEqual(session);
});

it('preserves the current session on a failed browser write', () => {
  setSession(session);
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Full'); });
  expect(setSession({ ...session, displayName: 'Next' })).toBe(false);
  expect(getSession()).toEqual(session);
});

it('reports serialization failure and preserves the current session', () => {
  setSession(session);
  vi.spyOn(JSON, 'stringify').mockImplementation(() => { throw new TypeError('Cannot serialize'); });
  expect(setSession(session)).toBe(false);
  expect(getSession()).toEqual(session);
});

it('clears only the session and succeeds idempotently', () => {
  localStorage.setItem('writespace_posts', '[]');
  localStorage.setItem('writespace_users', '[]');
  setSession(session);
  expect(clearSession()).toBe(true);
  expect(getSession()).toBeNull();
  expect(clearSession()).toBe(true);
  expect(Object.keys(localStorage).sort()).toEqual(['writespace_posts', 'writespace_users']);
});

it('preserves identity on failed logout', () => {
  setSession(session);
  vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new DOMException('Denied'); });
  expect(clearSession()).toBe(false);
  expect(getSession()).toEqual(session);
});

it('handles unavailable native storage for every operation', () => {
  vi.stubGlobal('localStorage', undefined);
  expect(getSession()).toBeNull();
  expect(setSession(session)).toBe(false);
  expect(clearSession()).toBe(false);
});
