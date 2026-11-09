/** Validate demo credentials and persist accounts before their session. */
import { getUsers, saveUsers } from './storage.js';
import { setSession } from './auth.js';

export const SAVE_ERROR = 'Could not save in this browser. Your changes have not been saved.';
export const PARTIAL_ERROR = 'Your account was saved, but sign-in failed. Please try logging in.';

/** Compare usernames consistently without changing their stored spelling.
 * Args:
 *   username: Submitted or stored username.
 * Returns:
 *   Trimmed case-insensitive comparison key, or empty for invalid input.
 * @param {string} username
 * @returns {string}
 */
export function normalizeUsername(username) {
  return typeof username === 'string' ? username.trim().toLowerCase() : '';
}

/** Require nonblank text while preserving the submitted value. */
function isRequired(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

/** Validate required login fields without reading or writing credentials.
 * Args:
 *   form: Username and plaintext demo password.
 * Returns:
 *   Field-specific errors; an empty object permits credential lookup.
 * @param {object} form
 * @returns {object}
 */
export function validateLogin(form = {}) {
  const errors = {};
  if (!isRequired(form?.username)) errors.username = 'Username is required.';
  if (!isRequired(form?.password)) errors.password = 'Password is required.';
  return errors;
}

/** Validate self-registration against the latest caller-supplied accounts.
 * Args:
 *   form: Display name, username, password and confirmation.
 *   users: Current persisted accounts for uniqueness comparison.
 * Returns:
 *   Field-specific errors without altering input or storage.
 * @param {object} form
 * @param {Array<object>} users
 * @returns {object}
 */
export function validateRegistration(form = {}, users = getUsers()) {
  const errors = validateLogin(form);
  if (!isRequired(form?.displayName)) errors.displayName = 'Display name is required.';
  if (!isRequired(form?.confirmPassword)) errors.confirmPassword = 'Confirm password is required.';
  else if (form.confirmPassword !== form.password) errors.confirmPassword = 'Passwords must match.';
  const username = normalizeUsername(form?.username);
  if (username === 'admin') errors.username = 'This username is reserved.';
  else if (username && users.some((user) => normalizeUsername(user.username) === username)) {
    errors.username = 'This username is already taken.';
  }
  return errors;
}

/** Project only the exact public identity fields into a demo session. */
function sessionFor(user) {
  return { userId: user.id, username: user.username, displayName: user.displayName, role: user.role };
}

/** Resolve the role home without introducing unfinished destination pages.
 * @param {object} session Demo identity with a supported role.
 * @returns {string} Existing route policy destination.
 */
export function roleHome(session) {
  return session.role === 'admin' ? '/admin' : '/blogs';
}

/** Sign in fixed Admin first; reserved stored identities never shadow it.
 * Args:
 *   form: Submitted username and exact plaintext demo password.
 * Returns:
 *   An outcome containing field errors, a truthful failure, or a saved destination.
 * @param {object} form
 * @returns {object}
 */
export function loginAccount(form = {}) {
  const errors = validateLogin(form);
  if (Object.keys(errors).length) return { ok: false, errors };
  const username = normalizeUsername(form.username);
  let session;
  if (username === 'admin') {
    if (form.password !== 'admin') return { ok: false, message: 'Invalid username or password.' };
    session = { userId: 'admin', username: 'admin', displayName: 'Demo Admin', role: 'admin' };
  } else {
    const user = getUsers().find((account) => normalizeUsername(account.username) === username
      && account.password === form.password);
    if (!user) return { ok: false, message: 'Invalid username or password.' };
    session = sessionFor(user);
  }
  if (!setSession(session)) return { ok: false, message: SAVE_ERROR };
  return { ok: true, destination: roleHome(session) };
}

/** Save one exact User record before attempting its independent session write.
 * Args:
 *   form: Controlled self-registration values; role and extra fields are ignored.
 * Returns:
 *   Validation, failed save, account-saved/session-failed, or saved-session outcome.
 * Notes:
 *   Explicit resubmission re-reads accounts. Never retry or roll back automatically.
 * @param {object} form
 * @returns {object}
 */
export function registerAccount(form = {}) {
  const users = getUsers();
  const errors = validateRegistration(form, users);
  if (Object.keys(errors).length) return { ok: false, errors };
  let user;
  try {
    user = {
      id: crypto.randomUUID(), displayName: form.displayName, username: form.username,
      password: form.password, role: 'user', createdAt: new Date().toISOString(),
    };
  } catch {
    return { ok: false, message: SAVE_ERROR };
  }
  if (!saveUsers([...users, user])) return { ok: false, message: SAVE_ERROR };
  if (!setSession(sessionFor(user))) return { ok: false, message: PARTIAL_ERROR };
  return { ok: true, destination: '/blogs' };
}
