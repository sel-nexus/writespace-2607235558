/** Verify exact collection schemas, fresh state and every browser fault boundary. */
import { describe, expect, it, vi } from 'vitest';
import { getPosts, savePosts, getUsers, saveUsers } from './storage.js';

const post = {
  id: '53f2b35c-fc1a-4e66-9a42-2c2a2e4fb1aa', title: 'Morning', content: 'First line\nSecond line',
  createdAt: '2026-11-09T08:00:00.000Z', authorId: 'admin', authorName: 'Admin',
};
const account = {
  id: '48dbb1d0-2150-40fb-a705-42a4202622cf', displayName: 'Reader', username: 'reader',
  password: 'demo-only', role: 'user', createdAt: '2026-11-09T08:00:00.000Z',
};

describe.each([
  ['posts', 'writespace_posts', getPosts, savePosts, post],
  ['users', 'writespace_users', getUsers, saveUsers, account],
])('%s collection adapter', (_name, key, read, save, record) => {
  it('reads absent and empty collections without initializing storage', () => {
    expect(read()).toEqual([]);
    expect(localStorage.length).toBe(0);
    localStorage.setItem(key, '[]');
    expect(read()).toEqual([]);
  });

  it('persists exact fields and re-reads independent current state', () => {
    expect(save([record])).toBe(true);
    expect(JSON.parse(localStorage.getItem(key))).toEqual([record]);
    expect(Object.keys(localStorage)).toEqual([key]);
    const firstRead = read();
    firstRead.pop();
    expect(read()).toEqual([record]);
    expect(save([])).toBe(true);
    expect(read()).toEqual([]);
  });

  it.each(['{', 'null', '{}', 'true', '12', '"text"', '[null]', '[[]]'])('returns empty for corrupt value %s without repairs', (raw) => {
    localStorage.setItem(key, raw);
    expect(read()).toEqual([]);
    expect(localStorage.getItem(key)).toBe(raw);
  });

  it.each(Object.keys(record))('rejects missing field %s on reads and writes', (field) => {
    const invalid = { ...record };
    delete invalid[field];
    localStorage.setItem(key, JSON.stringify([invalid]));
    expect(read()).toEqual([]);
    expect(save([invalid])).toBe(false);
    expect(JSON.parse(localStorage.getItem(key))).toEqual([invalid]);
  });

  it.each(Object.keys(record))('rejects wrong type for %s', (field) => {
    const invalid = { ...record, [field]: 1 };
    expect(save([invalid])).toBe(false);
    localStorage.setItem(key, JSON.stringify([record, invalid]));
    expect(read()).toEqual([]);
  });

  it.each(Object.keys(record))('rejects blank field %s', (field) => {
    expect(save([{ ...record, [field]: '  ' }])).toBe(false);
    expect(localStorage.getItem(key)).toBeNull();
  });

  it.each([null, {}, 'bad', 1, [null], [{ ...record, extra: 'unexpected' }]])('rejects invalid writes without overwriting saved records', (invalid) => {
    expect(save([record])).toBe(true);
    expect(save(invalid)).toBe(false);
    expect(read()).toEqual([record]);
  });

  it.each(['bad', '2026-02-30T08:00:00.000Z', '2026-11-09', '2026-11-09T08:00:00Z'])('rejects invalid timestamp %s', (createdAt) => {
    expect(save([{ ...record, createdAt }])).toBe(false);
  });

  it('rejects a non-UUID record identity', () => {
    expect(save([{ ...record, id: 'not-a-uuid' }])).toBe(false);
  });

  it('falls back on denied reads and preserves existing data', () => {
    save([record]);
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new DOMException('Denied', 'SecurityError'); });
    expect(read()).toEqual([]);
    spy.mockRestore();
    expect(read()).toEqual([record]);
  });

  it('returns false on denied writes and preserves the previous collection', () => {
    save([record]);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Full', 'QuotaExceededError'); });
    expect(save([])).toBe(false);
    expect(read()).toEqual([record]);
  });

  it('catches serialization errors without replacing data', () => {
    save([record]);
    vi.spyOn(JSON, 'stringify').mockImplementation(() => { throw new TypeError('Cannot serialize'); });
    expect(save([record])).toBe(false);
    expect(read()).toEqual([record]);
  });

  it('rejects sparse arrays rather than saving null records', () => {
    save([record]);
    expect(save(new Array(1))).toBe(false);
    expect(read()).toEqual([record]);
  });

  it('handles an unavailable native storage object', () => {
    vi.stubGlobal('localStorage', undefined);
    expect(read()).toEqual([]);
    expect(save([record])).toBe(false);
  });
});

it.each(['user', 'admin'])('accepts stored %s accounts', (role) => {
  expect(saveUsers([{ ...account, role }])).toBe(true);
  expect(getUsers()[0].role).toBe(role);
});

it('rejects unsupported account roles', () => {
  expect(saveUsers([{ ...account, role: 'owner' }])).toBe(false);
  localStorage.setItem('writespace_users', JSON.stringify([{ ...account, role: 'owner' }]));
  expect(getUsers()).toEqual([]);
});
