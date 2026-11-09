/** Present the required role icon without adding role fields to post records. */
import PropTypes from 'prop-types';

// These two role colors are the narrow upstream exception to the single accent.
const roles = {
  admin: { label: 'Admin', style: 'bg-violet-100 text-violet-800', path: 'M3 6l4 4 5-6 5 6 4-4-2 13H5L3 6zM5 16h14' },
  user: { label: 'User', style: 'bg-indigo-100 text-indigo-800', path: 'M12 5v15M12 5C8 3 5 3 3 4v15c3-1 6-1 9 1 3-2 6-2 9-1V4c-2-1-5-1-9 1z' },
};

/** Render an accessible role label and decorative outline SVG.
 * Args:
 *   role: Supported identity role; unknown roles never default to Admin.
 * Returns:
 *   Compact role identity.
 */
export function Avatar({ role }) {
  const visual = roles[role] ?? roles.user;
  return (
    <span
      role="img"
      aria-label={visual.label + ' avatar'}
      className={'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-control ' + visual.style}
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d={visual.path} strokeLinejoin="round" strokeLinecap="round" />
      </svg>
    </span>
  );
}

Avatar.propTypes = { role: PropTypes.oneOf(['admin', 'user']) };
