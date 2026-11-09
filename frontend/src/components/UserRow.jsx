/** Present account identity without passwords or enabled account deletion. */
import PropTypes from 'prop-types';
import { accountDeletionReason } from '../utils/admin.js';

/** Show identity with a disabled action and associated protection reason.
 * Args:
 *   account: Public account fields; passwords are never rendered.
 *   session: Current identity for current-account protection.
 * Returns:
 *   A semantic list item with no deletion callback while policy is gated.
 */
export function UserRow({ account, session = null }) {
  const reasonId = 'account-protection-' + account.id;
  return (
    <li className="flex min-w-0 flex-col gap-4 border-b border-border py-6 sm:flex-row sm:justify-between">
      <div className="min-w-0">
        <h3 className="break-words font-medium">{account.displayName}</h3>
        <p className="mt-1 break-words text-sm text-foreground-muted">
          {account.username} · {account.role === 'admin' ? 'Admin' : 'User'}
        </p>
        <p id={reasonId} className="mt-2 max-w-prose text-sm text-foreground-muted">
          {accountDeletionReason(account, session)}
        </p>
      </div>
      <button type="button" disabled aria-describedby={reasonId}
        className="self-start rounded-control border border-border px-4 py-2 text-sm text-foreground-muted disabled:cursor-not-allowed">
        Delete {account.username}
      </button>
    </li>
  );
}

UserRow.propTypes = {
  account: PropTypes.shape({
    id: PropTypes.string.isRequired,
    displayName: PropTypes.string.isRequired,
    username: PropTypes.string.isRequired,
    role: PropTypes.oneOf(['user', 'admin']).isRequired,
  }).isRequired,
  session: PropTypes.shape({ userId: PropTypes.string.isRequired }),
};
