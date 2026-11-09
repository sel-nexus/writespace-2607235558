/** Introduce the local demo and read its latest stories without render mutations. */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PublicNavbar } from '../../components/PublicNavbar.jsx';
import { DemoWarning } from '../../components/DemoWarning.jsx';
import { newestPosts, postDate, postExcerpt } from '../../utils/posts.js';
import { getSession } from '../../utils/auth.js';

const features = [
  { title: 'Words come first', text: 'A simple plain-text space for ideas, reflections, and the stories you want to tell.' },
  { title: 'Read at your own pace', text: 'Discover the latest stories saved in this browser, with room to focus on each one.' },
  { title: 'A place to practice', text: 'Try User and Admin workflows in a small local demo, without a backend or cloud account.' },
];
const linkFocus = 'rounded-control focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

/** Render the hero, three feature cards, previews and honest empty state. */
export default function LandingPage() {
  const [, setRevision] = useState(0);
  const session = getSession();
  const posts = newestPosts(undefined, 3);
  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:z-30 focus:bg-surface focus:p-4">Skip to content</a>
      <PublicNavbar onLogout={() => setRevision((value) => value + 1)} />
      <main id="main" className="mx-auto max-w-6xl px-6">
        <section aria-labelledby="hero-title" className="py-16 md:py-24">
          <p className="mb-6 text-sm font-medium uppercase tracking-widest text-foreground-muted">A browser-local writing demo</p>
          <h1 id="hero-title" className="max-w-3xl font-display text-hero font-normal">Room for your words.</h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-foreground-muted">
            A quiet place to write, read, and explore. Start with an idea, give it space, and discover the stories in your browser.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-6">
            <Link
              to={session ? '/blogs' : '/register'}
              className={`${linkFocus} bg-primary-600 px-5 py-3 font-medium text-surface transition-colors duration-quick hover:bg-primary-700 motion-reduce:transition-none`}
            >
              {session ? 'Explore blogs' : 'Get started'}
            </Link>
            {!session && <Link to="/login" className={`${linkFocus} py-3 underline underline-offset-4`}>Already have an account? Log in</Link>}
          </div>
        </section>
        <section aria-labelledby="features-title" className="pb-section">
          <h2 id="features-title" className="mb-8 font-display text-3xl">Less noise. More story.</h2>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <article key={feature.title} className="rounded-control border border-border p-6">
                <h3 className="mb-3 font-display text-2xl">{feature.title}</h3>
                <p className="leading-relaxed text-foreground-muted">{feature.text}</p>
              </article>
            ))}
          </div>
        </section>
        <section aria-labelledby="latest-title" className="pb-section">
          <h2 id="latest-title" className="font-display text-3xl">Latest stories</h2>
          <p className="mb-8 mt-3 text-foreground-muted">A glimpse of what is saved in this browser.</p>
          {posts.length ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {posts.map((post) => (
                <article key={post.id} className="flex min-w-0 flex-col rounded-control border border-border bg-surface p-6">
                  <p className="mb-4 text-sm text-foreground-muted">
                    {post.authorName} ·{' '}
                    <time dateTime={post.createdAt}>
                      {postDate(post.createdAt)}
                    </time>
                  </p>
                  <h3 className="break-words font-display text-2xl">{post.title}</h3>
                  <p className="mb-6 mt-3 break-words leading-relaxed text-foreground-muted">
                    {postExcerpt(post.content)}
                  </p>
                  <Link to={session ? `/blog/${post.id}` : '/login'} className={`${linkFocus} mt-auto self-start py-2 underline underline-offset-4`}>
                    Read {post.title}
                  </Link>
                </article>
              ))}
            </div>
          ) : (
            <p className="rounded-control border border-border p-6 text-foreground-muted">No stories yet. Your first story can start here.</p>
          )}
        </section>
        <DemoWarning />
      </main>
      <footer className="mx-auto mt-16 flex max-w-6xl flex-wrap justify-between gap-4 border-t border-border px-6 py-8 text-sm text-foreground-muted">
        <p>WriteSpace — Room for your words.</p>
        <p>A local demo, not a shared publishing service.</p>
      </footer>
    </>
  );
}
