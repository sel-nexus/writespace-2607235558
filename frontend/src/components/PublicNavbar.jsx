/** Present sticky public navigation and truthful explicit session removal. */
import { useState } from 'react';
import PropTypes from 'prop-types';
import { Link, useNavigate } from 'react-router-dom';
import { clearSession, getSession } from '../utils/auth.js';

const navLink = 'rounded-control px-3 py-2 text-sm hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

/** Render current identity and a mobile disclosure without global state.
 * Args:
 *   onLogout: Optional notification after successful session removal.
 * Returns:
 *   Sticky navigation with role-aware destinations.
 */
export function PublicNavbar({ onLogout }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const session = getSession();
  const navigate = useNavigate();

  /** Keep the current workflow and identity intact when removal is denied. */
  function logout() {
    if (!clearSession()) {
      setError('Could not save in this browser. Your changes have not been saved. You are still signed in.');
      return;
    }
    setError('');
    setOpen(false);
    onLogout?.();
    navigate('/');
  }

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-6 py-4">
        <Link to="/" className="rounded-control font-display text-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          WriteSpace
        </Link>
        <button
          type="button"
          aria-expanded={open}
          aria-controls="public-navigation"
          aria-label={open ? 'Close navigation' : 'Open navigation'}
          onClick={() => setOpen(!open)}
          className={`${navLink} md:hidden`}
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d={open ? 'M6 6l12 12M6 18L18 6' : 'M4 6h16M4 12h16M4 18h16'} />
          </svg>
        </button>
        <nav
          id="public-navigation"
          aria-label="Public navigation"
          onClick={(event) => { if (event.target.closest('a')) setOpen(false); }}
          onKeyDown={(event) => { if (event.key === 'Escape') setOpen(false); }}
          className={`${open ? 'flex' : 'hidden'} w-full flex-col gap-2 md:flex md:w-auto md:flex-row md:items-center`}
        >
          {session ? (
            <>
              <span className="px-3 py-2 text-sm text-foreground-muted">{session.displayName}</span>
              <Link className={navLink} to="/blogs">Blogs</Link>
              {session.role === 'admin' && <Link className={navLink} to="/admin">Admin dashboard</Link>}
              <button type="button" className={navLink} onClick={logout}>Log out</button>
            </>
          ) : (
            <>
              <Link className={navLink} to="/login">Log in</Link>
              <Link className={navLink} to="/register">Register</Link>
            </>
          )}
        </nav>
      </div>
      {error && <p role="alert" className="mx-auto max-w-6xl px-6 pb-4 text-sm text-error">{error}</p>}
    </header>
  );
}

PublicNavbar.propTypes = { onLogout: PropTypes.func };
