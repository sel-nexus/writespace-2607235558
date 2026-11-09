/** Present one plain-text preview with explicit role-authorized controls. */
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import { canManagePost, postDate, postExcerpt } from '../utils/posts.js';

const action = 'rounded-control py-2 underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

/** Render text, date and optional management actions; never mutate during render.
 * Args:
 *   post: Exact post record.
 *   session: Current identity for UI eligibility.
 *   onDelete: Page-owned confirmed deletion handler.
 * Returns:
 *   A semantic article with navigation and explicit action button.
 */
export function BlogCard({ post, session = null, onDelete }) {
  const manageable = canManagePost(session, post);
  return (
    <article aria-labelledby={'post-' + post.id} className="flex min-w-0 flex-col rounded-control border border-border bg-surface p-6">
      <p className="mb-4 text-sm text-foreground-muted">
        {post.authorName} ·{' '}
        <time dateTime={post.createdAt}>{postDate(post.createdAt)}</time>
      </p>
      <h2 id={'post-' + post.id} className="break-words font-display text-2xl">{post.title}</h2>
      <p className="mb-6 mt-3 break-words leading-relaxed text-foreground-muted">{postExcerpt(post.content)}</p>
      <div className="mt-auto flex flex-wrap items-center gap-4 text-sm">
        <Link to={'/blog/' + post.id} className={action}>Read {post.title}</Link>
        {manageable && (
          <>
            <Link to={'/edit/' + post.id} className={action}>Edit {post.title}</Link>
            {onDelete && (
              <button type="button" onClick={() => onDelete(post.id)} className={action + ' text-error'}>
                Delete {post.title}
              </button>
            )}
          </>
        )}
      </div>
    </article>
  );
}

BlogCard.propTypes = {
  post: PropTypes.shape({
    id: PropTypes.string.isRequired, title: PropTypes.string.isRequired, content: PropTypes.string.isRequired,
    createdAt: PropTypes.string.isRequired, authorId: PropTypes.string.isRequired, authorName: PropTypes.string.isRequired,
  }).isRequired,
  session: PropTypes.shape({
    userId: PropTypes.string.isRequired, username: PropTypes.string.isRequired,
    displayName: PropTypes.string.isRequired, role: PropTypes.oneOf(['user', 'admin']).isRequired,
  }),
  onDelete: PropTypes.func,
};
