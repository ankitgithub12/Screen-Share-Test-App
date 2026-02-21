import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../components/Button';
import UnsupportedBrowser from '../components/UnsupportedBrowser';

/* One-time capability check at module load (sync) */
const isBrowserSupported =
  typeof navigator !== 'undefined' &&
  !!navigator.mediaDevices &&
  typeof navigator.mediaDevices.getDisplayMedia === 'function';

/* Detect Chromium-based browsers (Chrome / Edge) — they provide full metadata */
const isChromiumBased =
  typeof navigator !== 'undefined' &&
  /Chrome\//.test(navigator.userAgent) &&
  !/Chromium\//.test(navigator.userAgent);

const FEATURES = [
  { icon: '🔐', label: 'Permission handling' },
  { icon: '📺', label: 'Live preview' },
  { icon: '📊', label: 'Stream metadata' },
  { icon: '🔄', label: 'Lifecycle detection' },
  { icon: '🛡️', label: 'No recording' },
  { icon: '⚡', label: 'Chrome · Edge' },
];

const Home = () => {
  const navigate = useNavigate();
  const [navigating, setNavigating] = useState(false);

  const handleStartTest = useCallback(() => {
    // Re-check at click time
    const supported =
      typeof navigator !== 'undefined' &&
      !!navigator.mediaDevices &&
      typeof navigator.mediaDevices.getDisplayMedia === 'function';

    if (!supported) {
      // Force a re-render to show unsupported state
      window.location.reload();
      return;
    }

    setNavigating(true);
    // Tiny delay for the button animation to feel snappy
    setTimeout(() => navigate('/screen-test'), 200);
  }, [navigate]);

  return (
    <>
      {/* Animated mesh background */}
      <div className="mesh-bg" aria-hidden="true" />
      <div className="noise" aria-hidden="true" />

      <main className="home-page">
        <div className="home-inner">

          {/* Badge */}
          <div className="home-badge">
            <span className="home-badge-dot" />
            Browser Screen Sharing Test
          </div>

          {/* Icon */}
          <div className="home-icon-wrap">
            <span className="home-icon" role="img" aria-label="Monitor">🖥️</span>
            <span className="home-icon-ring" aria-hidden="true" />
          </div>

          {/* Title */}
          <div className="home-heading">
            <h1 className="home-title">Screen Share<br />Test App</h1>
            <p className="home-subtitle">
              A complete browser screen-sharing validation tool — permissions,
              live preview, stream lifecycle, and clean resource management.
            </p>
          </div>

          {/* Feature pills */}
          <div className="home-features" role="list">
            {FEATURES.map(f => (
              <div key={f.label} className="feature-pill" role="listitem">
                <span className="feature-pill-icon">{f.icon}</span>
                {f.label}
              </div>
            ))}
          </div>

          {/* CTA or unsupported message */}
          <div className="home-cta">
            {!isBrowserSupported ? (
              <UnsupportedBrowser />
            ) : (
              <>
                {/* Partial-support notice for non-Chrome/Edge browsers */}
                {!isChromiumBased && (
                  <div className="partial-support-banner" role="note" aria-live="polite">
                    <span className="partial-support-icon" aria-hidden="true">⚠️</span>
                    <div className="partial-support-body">
                      <strong className="partial-support-title">Limited Browser Support</strong>
                      <p className="partial-support-msg">
                        Your browser supports screen sharing, but stream metadata
                        (e.g. Display Type) may show as <em>Unknown</em>. For the
                        full experience, use <strong>Chrome</strong> or <strong>Edge</strong>.
                      </p>
                    </div>
                  </div>
                )}

                <Button
                  size="large"
                  onClick={handleStartTest}
                  disabled={navigating}
                  loading={navigating}
                >
                  {navigating ? 'Loading…' : 'Start Screen Test →'}
                </Button>
                <p className="home-note">
                  No recording · No streaming · Local preview only
                </p>
              </>
            )}
          </div>

        </div>
      </main>
    </>
  );
};

export default Home;
