/** Show approved local metrics, recent posts and explicit Admin actions. */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Navbar } from '../../components/Navbar.jsx';
import { StatCard } from '../../components/StatCard.jsx';
import { BlogCard } from '../../components/BlogCard.jsx';
import { getUsers, getPosts } from '../../utils/storage.js';
import { getSession } from '../../utils/auth.js';
import { adminCounts } from '../../utils/admin.js';
import { newestPosts, findPost, deletePost } from '../../utils/posts.js';

const action = 'rounded-control py-2 underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

/** Render three counts and five newest posts without performing render-time writes. */
export default function AdminDashboard() {
  const [posts, setPosts] = useState(getPosts);
  const [error, setError] = useState('');
  const session = getSession();
  const counts = adminCounts(getUsers(), posts);

  /** Recheck Admin before confirmation and again afterward, then use shared deletion. */
  function remove(id) {
    if (getSession()?.role !== 'admin') {
      setError('Only an Admin can manage recent posts.');
      return;
    }
    if (!findPost(id)) {
      setError('Post not found');
      return;
    }
    if (!window.confirm('Delete this post? This cannot be undone.')) return;
    if (getSession()?.role !== 'admin') {
      setError('Only an Admin can manage recent posts.');
      return;
    }
    const result = deletePost(id, true);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setError('');
    setPosts(getPosts());
  }

  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:z-30 focus:bg-surface focus:p-4">
        Skip to content
      </a>
      <Navbar />
      <main id="main" className="mx-auto max-w-6xl px-6 py-16">
        <p className="text-sm text-foreground-muted">Browser-local oversight</p>
        <h1 className="mt-3 font-display text-4xl">Admin dashboard</h1>
        <dl aria-label="Approved statistics" className="mt-10 grid gap-6 md:grid-cols-3">
          <StatCard label="Total Posts" value={counts.totalPosts} />
          <StatCard label="Total Users" value={counts.totalUsers} />
          <StatCard label="Total Admins" value={counts.totalAdmins} />
        </dl>
        <p className="mt-4 text-sm text-foreground-muted">
          Total Users includes every stored account plus the fixed Admin. Total Admins includes
          stored Admins plus the fixed Admin, without double-counting reserved admin identities.
        </p>
        <p className="mt-3 text-sm text-foreground-muted">
          Release gate: the fourth statistic awaits a product decision. Only three approved metrics are shown.
        </p>
        <section aria-labelledby="quick-actions" className="mt-12">
          <h2 id="quick-actions" className="font-display text-2xl">Quick actions</h2>
          <div className="mt-4 flex flex-wrap gap-6">
            <Link to="/write" className={action}>Write a new post</Link>
            <Link to="/users" className={action}>Manage accounts</Link>
          </div>
        </section>
        <section aria-labelledby="recent-posts" className="mt-16">
          <h2 id="recent-posts" className="font-display text-2xl">Recent posts</h2>
          <p className="mt-2 text-sm text-foreground-muted">The five newest posts in this browser.</p>
          {error && (
            <p role="alert" className="mt-4 text-sm text-error">{error}</p>
          )}
          {posts.length ? (
            <div className="mt-6 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {newestPosts(posts, 5).map((post) => (
                <BlogCard key={post.id} post={post} session={session} onDelete={remove} />
              ))}
            </div>
          ) : (
            <p className="mt-6 text-foreground-muted">No posts yet. Write a new post to begin.</p>
          )}
        </section>
      </main>
    </>
  );
}
