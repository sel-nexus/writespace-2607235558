/** Give unsupported routes a clear outcome and a real return link. */
import { Link } from 'react-router-dom';
import { PublicNavbar } from '../../components/PublicNavbar.jsx';

export default function NotFound() {
  return (
    <>
      <PublicNavbar />
      <main className="mx-auto max-w-6xl px-6 py-24">
        <h1 className="font-display text-4xl">Page not found</h1>
        <p className="mt-4 text-foreground-muted">This address does not have a page in WriteSpace.</p>
        <Link
          to="/"
          className="mt-8 inline-block rounded-control py-3 underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Back to WriteSpace
        </Link>
      </main>
    </>
  );
}
