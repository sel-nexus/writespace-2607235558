/** Provide inclusive local counts and Admin-only account creation without releasing deletion. */
import { getUsers, saveUsers, getPosts } from './storage.js';
import { getSession } from './auth.js';
import { normalizeUsername, validateRegistration, SAVE_ERROR } from './accounts.js';

/** Count stored accounts plus fixed Admin; exclude reserved identities only from Admins.
 * Args:
 *   users: Latest stored accounts, including reserved legacy identities.
 *   posts: Latest stored posts.
 * Returns:
 *   Exactly three approved metrics, without a guessed fourth statistic.
 * @param {Array<object>} users
 * @param {Array<object>} posts
 * @returns {object}
 */
export function adminCounts(users = getUsers(), posts = getPosts()) {
  return {
    totalPosts: posts.length,
    totalUsers: users.length + 1,
    totalAdmins: 1 + users.filter((user) => user.role === 'admin'
      && normalizeUsername(user.username) !== 'admin').length,
  };
}

/** Explain deletion protection without reading or mutating storage.
 * Args:
 *   account: Stored account or fixed Admin presentation identity.
 *   session: Current identity to protect.
 * Returns:
 *   An explicit protection or unresolved post-disposition reason.
 * @param {object} account
 * @param {object|null} session
 * @returns {string}
 */
export function accountDeletionReason(account, session) {
  if (account.id === 'admin' || normalizeUsername(account.username) === 'admin') {
    return 'The fixed default Admin identity cannot be deleted.';
  }
  if (account.id === session?.userId) return 'You cannot delete your current account.';
  return 'Account deletion is disabled pending a decision on post disposition (retain, delete or reassign).';
}

/** Create either role only while the current persisted session remains Admin.
 * Args:
 *   form: Required identity, demo password, confirmation and selected role.
 * Returns:
 *   Field errors, truthful failure, or the exact saved account; never change session.
 * Notes:
 *   Explicit resubmission reads latest accounts; never retry or roll back automatically.
 * @param {object} form
 * @returns {object}
 */
export function createAdminAccount(form = {}) {
  if (getSession()?.role !== 'admin') {
    return { ok: false, message: 'Only an Admin can create accounts. Please log in as an Admin.' };
  }
  const users = getUsers();
  const errors = validateRegistration(form, users);
  if (!['user', 'admin'].includes(form?.role)) errors.role = 'Choose User or Admin.';
  if (Object.keys(errors).length) return { ok: false, errors };
  let account;
  try {
    account = {
      id: crypto.randomUUID(),
      displayName: form.displayName,
      username: form.username,
      password: form.password,
      role: form.role,
      createdAt: new Date().toISOString(),
    };
  } catch {
    return { ok: false, message: SAVE_ERROR };
  }
  if (!saveUsers([...users, account])) return { ok: false, message: SAVE_ERROR };
  return { ok: true, account };
}
