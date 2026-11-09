/** Present an approved metric without interactive or speculative statistics. */
import PropTypes from 'prop-types';

/** Render a labelled count in a flat definition list.
 * Args:
 *   label: Approved metric name.
 *   value: Browser-local count.
 * Returns:
 *   A readable count with tabular numerals.
 */
export function StatCard({ label, value }) {
  return (
    <div className="rounded-control border border-border bg-surface p-6">
      <dt className="text-sm text-foreground-muted">{label}</dt>
      <dd className="mt-3 font-display text-4xl tabular-nums">{value}</dd>
    </div>
  );
}

StatCard.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.number.isRequired,
};
