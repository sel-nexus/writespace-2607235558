/** Compose controlled plain-text authoring with fresh demo access checks. */
import { useState } from 'react';
import PropTypes from 'prop-types';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { Navbar } from '../../components/Navbar.jsx';
import { FormField } from '../../components/FormField.jsx';
import { getSession } from '../../utils/auth.js';
import { findPost, canManagePost, createPost, updatePost } from '../../utils/posts.js';

const linkStyle = 'rounded-control underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

/** Reset transient input when the navigable post identity changes. */
export default function WriteBlog() {
  const { id } = useParams();
  return <PostForm key={id ?? 'create'} id={id} />;
}

/** Preserve drafts until an explicit submit succeeds.
 * Args:
 *   id: Exact edit identity, or absent for a new post.
 * Returns:
 *   An eligible form, missing-record feedback, or an access redirect.
 */
function PostForm({ id }) {
  const session = getSession();
  const post = id ? findPost(id) : null;
  const [form, setForm] = useState(() => ({ title: post?.title ?? '', content: post?.content ?? '' }));
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  const navigate = useNavigate();

  /** Recheck current session and record before asking the shared operation to save.
   * Args:
   *   event: Explicit native form submission to prevent page reload.
   */
  function submit(event) {
    event.preventDefault();
    const currentSession = getSession();
    if (!currentSession) {
      navigate('/login', { replace: true });
      return;
    }
    if (id) {
      const current = findPost(id);
      if (!current) {
        setMessage('Post not found');
        return;
      }
      if (!canManagePost(currentSession, current)) {
        navigate('/blogs', { replace: true });
        return;
      }
    }
    const result = id ? updatePost(id, form) : createPost(form);
    setErrors(result.errors ?? {});
    setMessage(result.message ?? '');
    if (result.ok || result.destination === '/blogs') navigate(result.destination);
  }

  /** Update only transient text, keeping field identity and focus stable.
   * Args:
   *   event: Changed title or content control.
   */
  function change(event) {
    setForm({ ...form, [event.target.name]: event.target.value });
  }

  if (!session) return <Navigate to="/login" replace />;
  if (id && post && !canManagePost(session, post)) return <Navigate to="/blogs" replace />;

  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:z-30 focus:bg-surface focus:p-4"
      >
        Skip to content
      </a>
      <Navbar />
      <main id="main" className="mx-auto max-w-3xl px-6 py-16">
        <Link to="/blogs" className={linkStyle}>
          Back to blogs
        </Link>
        {id && !post ? (
          <h1 className="mt-10 font-display text-4xl">
            Post not found
          </h1>
        ) : (
          <>
            <h1 className="mt-10 font-display text-4xl">
              {id ? 'Edit post' : 'Write a post'}
            </h1>
            <p className="mt-4 text-foreground-muted">
              Plain text, with room for your words. Changes stay in this browser.
            </p>
            <form noValidate onSubmit={submit} className="mt-8 space-y-6">
              <FormField
                id="title"
                name="title"
                label="Title"
                type="text"
                value={form.title}
                onChange={change}
                error={errors.title}
              />
              <FormField
                id="content"
                name="content"
                label="Content"
                as="textarea"
                rows={12}
                value={form.content}
                onChange={change}
                error={errors.content}
              />
              {message && (
                <p role="alert" className="text-sm text-error">
                  {message}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-6">
                <button
                  type="submit"
                  className="rounded-control bg-primary-600 px-5 py-3 font-medium text-surface
                    hover:bg-primary-700 focus-visible:outline-none focus-visible:ring-2
                    focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  {id ? 'Save changes' : 'Publish post'}
                </button>
                <Link to={id ? '/blog/' + id : '/blogs'} className={linkStyle}>
                  Cancel
                </Link>
              </div>
            </form>
          </>
        )}
      </main>
    </>
  );
}

PostForm.propTypes = { id: PropTypes.string };
