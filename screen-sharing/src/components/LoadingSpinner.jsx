/**
 * Premium CSS ring spinner
 * size: 'small' | 'medium' | 'large'
 */
const LoadingSpinner = ({ size = 'medium' }) => {
  const sizeClass = {
    small: 'spinner-sm',
    medium: 'spinner-md',
    large: 'spinner-lg',
  }[size] ?? 'spinner-md';

  return (
    <div className="spinner-wrap" role="status" aria-label="Loading">
      <div className={`spinner-ring ${sizeClass}`} />
    </div>
  );
};

export default LoadingSpinner;
