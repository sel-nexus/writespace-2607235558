/** Verify projections, exact metadata and every mutation outcome through real adapters. */
import { it, expect, vi } from 'vitest';
import { newestPosts, findPost, postExcerpt, postDate, canManagePost, validatePost, createPost, updatePost, deletePost } from './posts.js';
import { getPosts, savePosts } from './storage.js';
import { setSession, clearSession } from './auth.js';
import { SAVE_ERROR } from './accounts.js';

const owner = { userId: 'writer', username: 'writer', displayName: 'Writer', role: 'user' };
const post = { id: '53f2b35c-fc1a-4e66-9a42-2c2a2e4fb1aa', title: 'First', content: 'Line one\n  Line two', createdAt: '2026-11-01T08:00:00.000Z', authorId: 'writer', authorName: 'Writer' };
const other = { ...post, id: '53f2b35c-fc1a-4e66-9a42-2c2a2e4fb1ab', title: 'Newest', createdAt: '2026-11-02T08:00:00.000Z', authorId: 'other' };
const form = { title: ' New title ', content: ' First\n  second\n' };

it('sorts a copy newest-first with stable ties and optional caps without changing storage', () => {
  const source = [post, other, { ...post }];
  savePosts(source);
  expect(newestPosts()).toEqual([other, post, post]);
  expect(newestPosts(source, 1)).toEqual([other]);
  expect(newestPosts(source, 5)).toEqual([other, post, post]);
  expect(newestPosts(source, 0)).toEqual([]);
  expect(newestPosts(source, -1)).toEqual([]);
  expect(newestPosts(source, 1.9)).toEqual([other]);
  expect(newestPosts([])).toEqual([]);
  expect(getPosts()).toEqual(source);
});

it('selects only an exact ID, handles absent IDs and empty or corrupt storage', () => {
  savePosts([post, other]);
  expect(findPost(post.id)).toEqual(post);
  for (const id of [undefined, null, '', 'missing', 4]) expect(findPost(id)).toBeNull();
  expect(findPost(post.id, [])).toBeNull();
  localStorage.setItem('writespace_posts', '{');
  expect(newestPosts()).toEqual([]);
  expect(findPost(post.id)).toBeNull();
  expect(localStorage.getItem('writespace_posts')).toBe('{');
});

it.each([0, 1, 119, 120, 121, 10000])('projects exactly the first 120 of %s characters and indicates truncation', (length) => {
  const content = 'a'.repeat(length);
  expect(postExcerpt(content)).toBe('a'.repeat(Math.min(length, 120)) + (length > 120 ? '…' : ''));
});
it.each([null, undefined, 1, {}])('returns empty excerpt for non-text %s', (content) => expect(postExcerpt(content)).toBe(''));
it('formats UTC dates and fails gracefully on invalid date types', () => {
  expect(postDate(post.createdAt)).toBe('Nov 1, 2026');
  expect(postDate('2026-11-01T00:00:00.000Z')).toBe('Nov 1, 2026');
  for (const value of [null, undefined, 4, '', 'bad']) expect(postDate(value)).toBe('');
});
it('permits only complete owner and Admin identities with an existing record', () => {
  expect(canManagePost(owner, post)).toBe(true);
  expect(canManagePost({ ...owner, role: 'admin' }, other)).toBe(true);
  expect(canManagePost(owner, other)).toBe(false);
  for (const identity of [null, {}, { ...owner, role: 'root' }, { ...owner, userId: '' }, { ...owner, username: 1 }, { ...owner, displayName: ' ' }, { ...owner, extra: true }]) {
    expect(canManagePost(identity, post)).toBe(false);
  }
  expect(canManagePost(owner, null)).toBe(false);
});
it('accepts original nonblank text and reports each invalid field independently', () => {
  expect(validatePost(form)).toEqual({});
  expect(validatePost()).toEqual({ title: 'Title is required.', content: 'Content is required.' });
  expect(validatePost(null)).toEqual({ title: 'Title is required.', content: 'Content is required.' });
  for (const value of ['', ' \n', null, 4, {}]) {
    expect(validatePost({ ...form, title: value })).toEqual({ title: 'Title is required.' });
    expect(validatePost({ ...form, content: value })).toEqual({ content: 'Content is required.' });
  }
});
it('creates exact UUID/ISO/session fields, ignores forged metadata and retains latest posts', () => {
  setSession(owner);
  savePosts([post]);
  vi.spyOn(crypto, 'randomUUID').mockImplementation(() => {
    savePosts([post, other]);
    return '53f2b35c-fc1a-4e66-9a42-2c2a2e4fb1ac';
  });
  const before = Date.now();
  const result = createPost({ ...form, authorId: 'forged', authorName: 'Fake', role: 'admin', id: 'fake', createdAt: 'fake' });
  expect(result.ok).toBe(true);
  expect(result.destination).toBe('/blog/' + result.post.id);
  expect(result.post).toEqual({ id: '53f2b35c-fc1a-4e66-9a42-2c2a2e4fb1ac', ...form, createdAt: expect.any(String), authorId: owner.userId, authorName: owner.displayName });
  expect(new Date(result.post.createdAt).toISOString()).toBe(result.post.createdAt);
  expect(Date.parse(result.post.createdAt)).toBeGreaterThanOrEqual(before);
  expect(getPosts()).toEqual([post, other, result.post]);
});
it.each(['create', 'update', 'delete'])('rejects %s without a real valid stored session and never trusts extra arguments', (operation) => {
  savePosts([post]);
  localStorage.setItem('writespace_session', JSON.stringify({ ...owner, role: 'root' }));
  const result = operation === 'create' ? createPost(form, owner) : operation === 'update' ? updatePost(post.id, form, owner) : deletePost(post.id, true, owner);
  expect(result).toEqual({ ok: false, message: 'Please log in to manage posts.' });
  expect(getPosts()).toEqual([post]);
  clearSession();
});
it.each(['create', 'update'])('rejects invalid %s text without saving', (operation) => {
  setSession(owner); savePosts([post]);
  const result = operation === 'create' ? createPost({ ...form, title: '' }) : updatePost(post.id, { ...form, content: 4 });
  expect(result.ok).toBe(false); expect(result.errors).toBeDefined(); expect(getPosts()).toEqual([post]);
});
it.each(['user', 'admin'])('updates as %s while preserving current immutable metadata and unrelated records', (role) => {
  setSession({ ...owner, role }); savePosts([post, other]);
  const changed = { ...post, createdAt: '2026-11-03T08:00:00.000Z', authorName: 'Original name' };
  savePosts([changed, other]);
  const result = updatePost(post.id, { ...form, id: 'forged', createdAt: 'fake', authorName: 'Fake', authorId: 'forged' });
  expect(result).toEqual({ ok: true, post: { ...changed, ...form }, destination: '/blog/' + post.id });
  expect(getPosts()).toEqual([{ ...changed, ...form }, other]);
});
it('allows an Admin to edit another author without replacing their identity', () => {
  setSession({ ...owner, role: 'admin' }); savePosts([other]);
  expect(updatePost(other.id, form).ok).toBe(true);
  expect(getPosts()).toEqual([{ ...other, ...form }]);
});
it.each(['update', 'delete'])('rejects missing and currently unauthorized %s targets without a write', (operation) => {
  setSession(owner); savePosts([other]);
  const run = (id) => operation === 'update' ? updatePost(id, form) : deletePost(id, true);
  expect(run('missing')).toEqual({ ok: false, message: 'Post not found' });
  expect(run(other.id).message).toBe('You cannot manage this post.');
  expect(getPosts()).toEqual([other]);
});
it.each(['user', 'admin'])('deletes only the selected authorized post as %s', (role) => {
  setSession({ ...owner, role }); savePosts([post, other]);
  const target = role === 'admin' ? other : post;
  expect(deletePost(target.id, true)).toEqual({ ok: true, destination: '/blogs' });
  expect(getPosts()).toEqual(role === 'admin' ? [post] : [other]);
});
it.each([undefined, false, 'true', 1])('cancels deletion without explicit true confirmation (%s)', (confirmed) => {
  setSession(owner); savePosts([post]);
  expect(deletePost(post.id, confirmed)).toEqual({ ok: false, cancelled: true });
  expect(getPosts()).toEqual([post]);
});
it.each(['create', 'update', 'delete'])('retains persisted state and reports a failed %s write without destination', (operation) => {
  setSession(owner); savePosts([post, other]);
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Quota'); });
  const result = operation === 'create' ? createPost(form) : operation === 'update' ? updatePost(post.id, form) : deletePost(post.id, true);
  expect(result).toEqual({ ok: false, message: SAVE_ERROR });
  expect(getPosts()).toEqual([post, other]);
});
it('reports unavailable UUID generation without writing', () => {
  setSession(owner); savePosts([post]);
  vi.spyOn(crypto, 'randomUUID').mockImplementation(() => { throw new Error('Unavailable'); });
  expect(createPost(form)).toEqual({ ok: false, message: SAVE_ERROR });
  expect(getPosts()).toEqual([post]);
});
it('rechecks changed session and latest ownership on each explicit operation', () => {
  setSession(owner); savePosts([post]);
  setSession({ ...owner, userId: 'someone-else' });
  expect(updatePost(post.id, form).ok).toBe(false);
  expect(deletePost(post.id, true).ok).toBe(false);
  savePosts([{ ...post, authorId: 'someone-else' }, other]);
  expect(deletePost(post.id, true).ok).toBe(true);
  expect(getPosts()).toEqual([other]);
});

it('creates as current Admin without changing roles or introducing extra post fields', () => {
  setSession({ ...owner, role: 'admin', userId: 'admin', displayName: 'Demo Admin' });
  const result = createPost({ title: '<b>Plain title</b>', content: 'a'.repeat(10000) });
  expect(result.ok).toBe(true);
  expect(result.post.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  expect(Object.keys(result.post).sort()).toEqual(['authorId', 'authorName', 'content', 'createdAt', 'id', 'title']);
  expect(result.post.authorId).toBe('admin');
  expect(result.post.authorName).toBe('Demo Admin');
  expect(getPosts()).toEqual([result.post]);
});

it.each(['create', 'update', 'delete'])('rejects absent session for %s without altering collections', (operation) => {
  savePosts([post]);
  const result = operation === 'create' ? createPost(form) : operation === 'update' ? updatePost(post.id, form) : deletePost(post.id, true);
  expect(result).toEqual({ ok: false, message: 'Please log in to manage posts.' });
  expect(getPosts()).toEqual([post]);
});
