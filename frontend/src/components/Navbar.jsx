/** Present responsive authenticated navigation and truthful logout outcomes. */
import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { getSession, clearSession } from '../utils/auth.js';
import { SAVE_ERROR } from '../utils/accounts.js';
import { Avatar } from './Avatar.jsx';

const linkStyle = 'rounded-control px-3 py-2 text-sm hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

/** Re-read current role for links and retain workflow on failed removal. */
export function Navbar() {
  const session = getSession();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  /** Remove only session; navigate only after a successful adapter result. */
  function logout() {
    if (!clearSession()) {
      setError(SAVE_ERROR + ' You are still signed in.');
      return;
    }
    setError('');
    setOpen(false);
    navigate('/');
  }

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-6 py-4">
        <Link to="/" className="rounded-control font-display text-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          WriteSpace
        </Link>
        <button type="button" aria-expanded={open} aria-controls="blog-navigation"
          aria-label={open ? 'Close navigation' : 'Open navigation'}
          onClick={() => setOpen(!open)} className={linkStyle + ' md:hidden'}>
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d={open ? 'M6 6l12 12M6 18L18 6' : 'M4 6h16M4 12h16M4 18h16'} />
          </svg>
        </button>
        <nav id="blog-navigation" aria-label="Blog navigation"
          onClick={(event) => { if (event.target.closest('a')) setOpen(false); }}
          onKeyDown={(event) => { if (event.key === 'Escape') setOpen(false); }}
          className={(open ? 'flex' : 'hidden') + ' w-full flex-col gap-2 md:flex md:w-auto md:flex-row md:items-center'}>
          {session ? (
            <>
              <div className="flex items-center gap-2 px-3 py-2 text-sm text-foreground-muted">
                <Avatar role={session.role} />
                <span>{session.displayName}</span>
              </div>
              <NavLink to="/blogs" className={linkStyle}>Blogs</NavLink>
              <NavLink to="/write" className={linkStyle}>Write a post</NavLink>
              {session.role === 'admin' && (
                <>
                  <NavLink to="/admin" className={linkStyle}>Admin dashboard</NavLink>
                  <NavLink to="/users" className={linkStyle}>User management</NavLink>
                </>
              )}
              <button type="button" onClick={logout} className={linkStyle}>Log out</button>
            </>
          ) : (
            <Link to="/login" className={linkStyle}>Log in</Link>
          )}
        </nav>
      </div>
      {error && (
        <p role="alert" className="mx-auto max-w-6xl px-6 pb-4 text-sm text-error">{error}</p>
      )}
    </header>
  );
}
