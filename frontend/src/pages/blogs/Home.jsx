/** Read the current collection and manage explicit confirmed list deletions. */
import { useState } from 'react';
import { getSession } from '../../utils/auth.js';
import { newestPosts, findPost, canManagePost, deletePost } from '../../utils/posts.js';
import { Navbar } from '../../components/Navbar.jsx';
import { BlogCard } from '../../components/BlogCard.jsx';

/** Render a responsive newest-first list without persistence side effects. */
export default function Home() {
  const [, setRevision] = useState(0);
  const [error, setError] = useState('');
  const session = getSession();
  const posts = newestPosts();

  /** Recheck latest identity/record before confirmation and again before saving. */
  function remove(id) {
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
    setError('');
    setRevision((value) => value + 1);
  }

  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:z-30 focus:bg-surface focus:p-4">Skip to content</a>
      <Navbar />
      <main id="main" className="mx-auto max-w-6xl px-6 py-16">
        <h1 className="font-display text-4xl">Stories in this browser</h1>
        <p className="mb-10 mt-4 text-foreground-muted">The latest words, with room to read.</p>
        {error && (
          <p role="alert" className="mb-6 text-sm text-error">{error}</p>
        )}
        {posts.length ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <BlogCard key={post.id} post={post} session={session} onDelete={remove} />
            ))}
          </div>
        ) : (
          <p className="rounded-control border border-border p-6 text-foreground-muted">No posts yet. Your first story can start here.</p>
        )}
      </main>
    </>
  );
}
