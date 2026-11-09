/** Present stable native fields with associated accessible validation. */
import PropTypes from 'prop-types';

/** Render a labelled input, textarea or select without owning its value.
 * Args:
 *   id: Stable field identity shared by label and error association.
 *   label: Visible field name.
 *   as: Native control to render.
 *   error: Current validation feedback.
 *   children: Select options when applicable.
 * Returns:
 *   A controlled native field with required and invalid semantics.
 */
export function FormField({ id, label, as: Control = 'input', error = '', children, required = true, ...props }) {
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm font-medium">
        {label}
      </label>
      <Control
        {...props}
        id={id}
        required={required}
        aria-required={required}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`w-full rounded-control border bg-surface px-3 py-3 text-foreground
          focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60
          ${error ? 'border-error' : 'border-border'}`}
      >
        {children}
      </Control>
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-2 text-sm text-error">
          {error}
        </p>
      )}
    </div>
  );
}

FormField.propTypes = {
  id: PropTypes.string.isRequired,
  label: PropTypes.string.isRequired,
  as: PropTypes.oneOf(['input', 'textarea', 'select']),
  error: PropTypes.string,
  children: PropTypes.node,
  required: PropTypes.bool,
  value: PropTypes.string,
  onChange: PropTypes.func,
};
