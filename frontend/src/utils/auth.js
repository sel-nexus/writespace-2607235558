/** Adapt the exact local session; these client-side identities are not security. */

/** Validate all session fields and reject unsupported roles and extra fields. */
function isSession(value) {
  const fields = ['userId', 'username', 'displayName', 'role'];
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).length === fields.length
    && fields.every((field) => Object.hasOwn(value, field))
    && ['userId', 'username', 'displayName'].every((field) =>
      typeof value[field] === 'string' && value[field].trim().length > 0)
    && ['user', 'admin'].includes(value.role);
}

/** Read the latest session and fail closed on absent, corrupt or denied storage.
 * @returns {object|null} Complete demo identity or guest state.
 */
export function getSession() {
  try {
    const value = JSON.parse(localStorage.getItem('writespace_session'));
    return isSession(value) ? value : null;
  } catch {
    return null;
  }
}

/** Persist a validated session once; leave the previous session on failure.
 * @param {object} session Complete demo identity with a supported role.
 * @returns {boolean} Whether the browser saved the identity.
 */
export function setSession(session) {
  try {
    if (!isSession(session)) return false;
    localStorage.setItem('writespace_session', JSON.stringify(session));
    return true;
  } catch {
    return false;
  }
}

/** Remove only the session on explicit logout, never accounts or posts.
 * @returns {boolean} Whether removal succeeded, including an absent session.
 */
export function clearSession() {
  try {
    localStorage.removeItem('writespace_session');
    return true;
  } catch {
    return false;
  }
}
