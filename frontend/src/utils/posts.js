/** Select plain-text posts and perform explicit, session-checked local mutations. */
import { getPosts, savePosts } from './storage.js';
import { getSession } from './auth.js';
import { SAVE_ERROR } from './accounts.js';

/** Sort a copy newest first and optionally cap the result.
 * Args:
 *   posts: Valid records supplied by the collection adapter.
 *   limit: Optional nonnegative integer cap.
 * Returns:
 *   Ordered records without changing the supplied array.
 * @param {Array<object>} posts
 * @param {number} [limit]
 * @returns {Array<object>}
 */
export function newestPosts(posts = getPosts(), limit) {
  const sorted = [...posts].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  return limit === undefined ? sorted : sorted.slice(0, Math.max(0, Math.floor(limit)));
}

/** Find only the exact requested identity in a fresh collection.
 * @param {string} id Requested post identity.
 * @param {Array<object>} posts Current records.
 * @returns {object|null} Matching post or explicit absence.
 */
export function findPost(id, posts = getPosts()) {
  return posts.find((post) => post.id === id) ?? null;
}

/** Project the first 120 characters with an ellipsis only when truncated.
 * @param {string} content Original plain-text body.
 * @returns {string} Text-safe preview; invalid text becomes empty.
 */
export function postExcerpt(content) {
  return typeof content === 'string' ? content.slice(0, 120) + (content.length > 120 ? '…' : '') : '';
}

/** Format a stored timestamp consistently in UTC, never store a display date.
 * @param {string} createdAt Stored creation timestamp.
 * @returns {string} English display date or empty for invalid input.
 */
export function postDate(createdAt) {
  if (typeof createdAt !== 'string' || !Number.isFinite(Date.parse(createdAt))) return '';
  return new Date(createdAt).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC',
  });
}

/** Check a complete demo identity before applying owner or Admin UI policy.
 * Args:
 *   session: Caller identity; incomplete identities fail closed.
 *   post: Existing post whose author is compared.
 * Returns:
 *   Whether this identity may manage this record in the demo UI.
 * @param {object|null} session
 * @param {object|null} post
 * @returns {boolean}
 */
export function canManagePost(session, post) {
  return Boolean(session && post
    && Object.keys(session).length === 4
    && ['userId', 'username', 'displayName'].every((field) =>
      typeof session[field] === 'string' && session[field].trim().length > 0)
    && ['admin', 'user'].includes(session.role)
    && (session.role === 'admin' || post.authorId === session.userId));
}

/** Validate nonblank fields without trimming away original text or whitespace.
 * @param {object} form Submitted title and content.
 * @returns {object} Field errors, empty when valid.
 */
export function validatePost(form = {}) {
  const errors = {};
  for (const field of ['title', 'content']) {
    if (typeof form?.[field] !== 'string' || !form[field].trim()) {
      errors[field] = field === 'title' ? 'Title is required.' : 'Content is required.';
    }
  }
  return errors;
}

/** Create one exact record from the current persisted session, not supplied metadata.
 * Args:
 *   form: Title and original plain-text content; all extra fields are ignored.
 * Returns:
 *   Validation/failure outcome or the saved post and reader destination.
 * Notes:
 *   Read the latest collection immediately before one checked write; never retry.
 * @param {object} form
 * @returns {object}
 */
export function createPost(form = {}) {
  const session = getSession();
  if (!session) return { ok: false, message: 'Please log in to manage posts.' };
  const errors = validatePost(form);
  if (Object.keys(errors).length) return { ok: false, errors };
  let post;
  try {
    post = {
      id: crypto.randomUUID(), title: form.title, content: form.content,
      createdAt: new Date().toISOString(), authorId: session.userId, authorName: session.displayName,
    };
  } catch {
    return { ok: false, message: SAVE_ERROR };
  }
  if (!savePosts([...getPosts(), post])) return { ok: false, message: SAVE_ERROR };
  return { ok: true, post, destination: '/blog/' + post.id };
}

/** Replace only title/content on the current authorized record.
 * Args:
 *   id: Exact post to update.
 *   form: Submitted text; immutable metadata and extra fields are ignored.
 * Returns:
 *   Validation/failure outcome or saved record and destination.
 * @param {string} id
 * @param {object} form
 * @returns {object}
 */
export function updatePost(id, form = {}) {
  const session = getSession();
  if (!session) return { ok: false, message: 'Please log in to manage posts.' };
  const errors = validatePost(form);
  if (Object.keys(errors).length) return { ok: false, errors };
  const posts = getPosts();
  const current = findPost(id, posts);
  if (!current) return { ok: false, message: 'Post not found' };
  if (!canManagePost(session, current)) return { ok: false, message: 'You cannot manage this post.', destination: '/blogs' };
  const post = { ...current, title: form.title, content: form.content };
  if (!savePosts(posts.map((item) => item.id === id ? post : item))) return { ok: false, message: SAVE_ERROR };
  return { ok: true, post, destination: '/blog/' + id };
}

/** Delete an explicitly confirmed post after re-reading session and record.
 * Args:
 *   id: Exact post identity.
 *   confirmed: Explicit confirmation from the click handler; cancellation never writes.
 * Returns:
 *   Failure/cancel outcome or successful list destination.
 * @param {string} id
 * @param {boolean} confirmed
 * @returns {object}
 */
export function deletePost(id, confirmed = false) {
  if (confirmed !== true) return { ok: false, cancelled: true };
  const session = getSession();
  if (!session) return { ok: false, message: 'Please log in to manage posts.' };
  const posts = getPosts();
  const current = findPost(id, posts);
  if (!current) return { ok: false, message: 'Post not found' };
  if (!canManagePost(session, current)) return { ok: false, message: 'You cannot manage this post.' };
  if (!savePosts(posts.filter((post) => post.id !== id))) return { ok: false, message: SAVE_ERROR };
  return { ok: true, destination: '/blogs' };
}
