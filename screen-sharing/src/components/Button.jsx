/**
 * Reusable Button — primary | secondary | danger variants
 * size: 'normal' | 'large'
 * loading: shows spinner + disables
 */
const Button = ({
  children,
  onClick,
  variant = 'primary',
  size = 'normal',
  disabled = false,
  loading = false,
  type = 'button',
  className = '',
}) => {
  const cls = [
    'btn',
    `btn-${variant}`,
    size === 'large' ? 'btn-large' : '',
    loading ? 'btn-requesting' : '',
    className,
  ].filter(Boolean).join(' ');

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={cls}
      aria-busy={loading}
    >
      {loading && (
        <svg className="btn-spinner" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      )}
      {children}
    </button>
  );
};

export default Button;