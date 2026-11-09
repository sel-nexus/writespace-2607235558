/** Adapt the two exact browser collections without repairing or mutating reads. */

/** Check required nonblank text while preserving the original value. */
function isText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

/** Accept only complete, real UTC timestamps produced by the demo. */
function isTimestamp(value) {
  return typeof value === 'string'
    && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
    && Number.isFinite(Date.parse(value))
    && new Date(value).toISOString() === value;
}

/** Check an exact record shape; never add fields at the persistence boundary. */
function hasFields(value, fields) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).length === fields.length
    && fields.every((field) => Object.hasOwn(value, field));
}

/** Validate post identity and plain-text content without creating a post. */
function isPost(value) {
  return hasFields(value, ['id', 'title', 'content', 'createdAt', 'authorId', 'authorName'])
    && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.id)
    && ['id', 'title', 'content', 'authorId', 'authorName'].every((field) => isText(value[field]))
    && isTimestamp(value.createdAt);
}

/** Validate stored accounts, including either supported demonstration role. */
function isUser(value) {
  return hasFields(value, ['id', 'displayName', 'username', 'password', 'role', 'createdAt'])
    && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.id)
    && ['id', 'displayName', 'username', 'password'].every((field) => isText(value[field]))
    && ['user', 'admin'].includes(value.role) && isTimestamp(value.createdAt);
}

/** Read a collection or return empty when any record is corrupt or access is denied. */
function readCollection(key, validate) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return Array.isArray(value) && value.every(validate) ? value : [];
  } catch {
    return [];
  }
}

/** Persist one validated collection once and report failure without retries.
 * Args:
 *   key: Exact collection key.
 *   value: Complete proposed collection.
 *   validate: Record schema predicate.
 * Returns:
 *   Whether serialization and the browser write succeeded.
 */
function writeCollection(key, value, validate) {
  try {
    if (!Array.isArray(value) || !Array.from(value).every(validate)) return false;
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

/** Read fresh posts; corrupt or unavailable data returns an empty collection.
 * @returns {Array<object>} Valid posts, never a cached authoritative copy.
 */
export function getPosts() {
  return readCollection('writespace_posts', isPost);
}

/** Save complete posts without claiming that a failed write succeeded.
 * @param {Array<object>} posts Complete proposed post collection.
 * @returns {boolean} Whether the browser saved the collection.
 */
export function savePosts(posts) {
  return writeCollection('writespace_posts', posts, isPost);
}

/** Read fresh demo accounts; never repair malformed records.
 * @returns {Array<object>} Valid accounts or an empty collection.
 */
export function getUsers() {
  return readCollection('writespace_users', isUser);
}

/** Save complete demo accounts without changing another storage key.
 * @param {Array<object>} users Complete proposed account collection.
 * @returns {boolean} Whether the browser saved the collection.
 */
export function saveUsers(users) {
  return writeCollection('writespace_users', users, isUser);
}
