/** Render full plain text and perform owner/Admin confirmed deletion. */
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getSession } from '../../utils/auth.js';
import { findPost, canManagePost, postDate, deletePost } from '../../utils/posts.js';
import { Navbar } from '../../components/Navbar.jsx';

const action = 'rounded-control py-2 underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

/** Read the exact route identity and show explicit absence rather than another post. */
export default function ReadBlog() {
  const { id } = useParams();
  const post = findPost(id);
  const session = getSession();
  const [error, setError] = useState('');
  const navigate = useNavigate();

  /** Confirm only current eligibility and recheck after the blocking dialog closes. */
  function remove() {
    const current = findPost(id);
    if (!current) {
      setError('Post not found');
      return;
    }
    if (!canManagePost(getSession(), current)) {
      setError('You cannot manage this post.');
      return;
    }
    if (!window.confirm('Delete this post? This cannot be undone.')) return;
    const result = deletePost(id, true);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    navigate(result.destination);
  }

  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:z-30 focus:bg-surface focus:p-4">Skip to content</a>
      <Navbar />
      <main id="main" className="mx-auto max-w-3xl px-6 py-16">
        <Link to="/blogs" className={action}>Back to blogs</Link>
        {error && (
          <p role="alert" className="mt-6 text-sm text-error">{error}</p>
        )}
        {post ? (
          <article className="mt-10">
            <h1 className="break-words font-display text-4xl leading-tight">{post.title}</h1>
            <p className="mt-6 text-sm text-foreground-muted">
              {post.authorName} ·{' '}
              <time dateTime={post.createdAt}>{postDate(post.createdAt)}</time>
            </p>
            <p className="mt-10 whitespace-pre-wrap break-words text-lg leading-relaxed">{post.content}</p>
            {canManagePost(session, post) && (
              <div className="mt-10 flex flex-wrap gap-6 border-t border-border pt-6 text-sm">
                <Link to={'/edit/' + post.id} className={action}>Edit post</Link>
                <button type="button" onClick={remove} className={action + ' text-error'}>Delete post</button>
              </div>
            )}
          </article>
        ) : (
          <h1 className="mt-10 font-display text-4xl">Post not found</h1>
        )}
      </main>
    </>
  );
}
