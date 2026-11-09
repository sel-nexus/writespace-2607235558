/** Apply browser-local guest, authenticated and Admin navigation policies. */
import PropTypes from 'prop-types';
import { Navigate, Outlet } from 'react-router-dom';
import { getSession } from '../utils/auth.js';
import { roleHome } from '../utils/accounts.js';

/** Re-read identity on render and fail closed without changing persistence.
 * Args:
 *   guestOnly: Redirect authenticated visitors to their role home.
 *   adminOnly: Restrict authenticated content to Admin identities.
 *   children: Optional wrapped content; otherwise render nested routes.
 * Returns:
 *   Allowed content or a replacing redirect from the current route policy.
 */
export function ProtectedRoute({ guestOnly = false, adminOnly = false, children }) {
  const session = getSession();
  if (guestOnly) {
    if (session) return <Navigate to={roleHome(session)} replace />;
  } else {
    if (!session) return <Navigate to="/login" replace />;
    if (adminOnly && session.role !== 'admin') return <Navigate to="/blogs" replace />;
  }
  return children ?? <Outlet />;
}

ProtectedRoute.propTypes = {
  guestOnly: PropTypes.bool,
  adminOnly: PropTypes.bool,
  children: PropTypes.node,
};
