import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import useScreenShare from '../hooks/useScreenShare';
import Button from '../components/Button';
import LoadingSpinner from '../components/LoadingSpinner';

/* ─────────────────────────────────────────────────────────────────── */
/* Status configuration — single source of truth for all 7 states      */
/* ─────────────────────────────────────────────────────────────────── */
const STATUS_CONFIG = {
  idle: {
    icon: '🎯',
    label: 'Standby',
    title: 'Ready to Share',
    message: "Click the button below to begin. You'll be asked to select a screen, window, or browser tab to share locally.",
    cardClass: '',
  },
  requesting: {
    icon: null, // replaced by LoadingSpinner
    label: 'Awaiting Permission',
    title: 'Opening Screen Picker…',
    message: "The screen selection dialog should now be open. Choose what you'd like to share and click \"Share\".",
    cardClass: 'card--glow-blue',
  },
  granted: {
    icon: '✅',
    label: 'Active',
    title: 'Screen Sharing Active',
    message: 'Your screen is being previewed locally in real time. No data is recorded or transmitted.',
    cardClass: 'card--glow-green',
  },
  cancelled: {
    icon: '🚫',
    label: 'Cancelled',
    title: 'Selection Cancelled',
    message: "You closed the screen picker without choosing a source. That's completely fine — hit Retry anytime.",
    cardClass: 'card--glow-yellow',
  },
  denied: {
    icon: '🔒',
    label: 'Blocked',
    title: 'Permission Denied',
    message: null, // filled from hook error state
    cardClass: 'card--glow-red',
  },
  ended: {
    icon: '⏹',
    label: 'Ended',
    title: 'Screen Sharing Stopped',
    message: 'The sharing session has ended — you stopped it from the browser toolbar, or it ended automatically.',
    cardClass: 'card--glow-orange',
  },
  error: {
    icon: '⚠️',
    label: 'Error',
    title: 'Something Went Wrong',
    message: null, // filled from hook error state
    cardClass: 'card--glow-red',
  },
};

/* Step indicator */
const STEPS = [
  { id: 1, label: 'Permission' },
  { id: 2, label: 'Preview' },
  { id: 3, label: 'Lifecycle' },
];

function getStepIndex(status) {
  if (status === 'idle' || status === 'requesting') return 0;
  if (status === 'granted') return 1;
  return 2; // cancelled | denied | ended | error
}

/** Format elapsed seconds as MM:SS */
function formatDuration(seconds) {
  const m = String(Math.floor(seconds / 60)).padStart(2, '0');
  const s = String(seconds % 60).padStart(2, '0');
  return `${m}:${s}`;
}

/* ─────────────────────────────────────────────────────────────────── */
/* ScreenTest — /screen-test                                            */
/* ─────────────────────────────────────────────────────────────────── */
const ScreenTest = () => {
  const navigate = useNavigate();

  /*
   * Keep videoRef alive for the full lifetime of the component.
   * We always render the <video> element but hide it when there is no
   * active stream, so srcObject can always be cleared properly (avoids
   * frozen last-frame artefact if the element were unmounted).
   */
  const videoRef = useRef(null);

  // Feature: clipboard copy confirmation
  const [copied, setCopied] = useState(false);
  const copyTimeoutRef = useRef(null);

  const {
    stream,
    status,
    error,
    displayType,
    resolution,
    frameRate,
    elapsedSeconds,
    trackReadyState,
    startScreenShare,
    cleanup,
  } = useScreenShare();

  /* ── Attach / detach stream to <video> ──────────────────────────── */
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (stream) {
      video.srcObject = stream;
      // play() is safe — video is muted so autoplay policy won't block it
      video.play().catch(e => console.warn('[ScreenTest] video.play():', e));
    } else {
      // Explicitly clear srcObject so no frozen last-frame is shown
      video.pause();
      video.srcObject = null;
    }
  }, [stream]);

  /* ── Cleanup on unmount ─────────────────────────────────────────── */
  useEffect(() => {
    return () => {
      cleanup();
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    };
  }, [cleanup]); // eslint-disable-line react-hooks/exhaustive-deps


  /* ── Keyboard shortcuts ─────────────────────────────────────────── */
  useEffect(() => {
    const onKeyDown = (e) => {
      // Don't fire if user is typing in an input
      if (e.target !== document.body) return;

      if (e.key === 's' || e.key === 'S') {
        if (status === 'idle') {
          startScreenShare();
        } else if (status === 'cancelled' || status === 'ended' || status === 'error') {
          cleanup();
          queueMicrotask(() => startScreenShare());
        }
      }

      if (e.key === 'Escape') {
        if (status === 'granted') {
          cleanup('ended');
        } else if (status !== 'requesting') {
          cleanup();
          navigate('/');
        }
      }

    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [status, startScreenShare, cleanup, navigate]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Handlers ───────────────────────────────────────────────────── */

  /** Initial start */
  const handleStart = () => startScreenShare();

  /**
   * Retry: clean up existing stream then request a new one.
   * cleanup() synchronously clears streamRef (the ref, not state), so
   * startScreenShare() immediately sees a clean slate.
   * We use queueMicrotask to ensure any pending React batch flushes
   * before the new picker opens.
   */
  const handleRetry = () => {
    cleanup();
    queueMicrotask(() => startScreenShare());
  };

  /**
   * In-app "Stop Sharing" button.
   * Use 'ended' so Retry / Back buttons appear (not 'idle').
   */
  const handleStop = () => cleanup('ended');

  /** Navigate back — always clean up first */
  const handleBack = () => {
    cleanup();
    navigate('/');
  };


  /** Copy stream metadata to clipboard */
  const handleCopyInfo = useCallback(() => {
    const text = [
      `Screen Share Session — ${new Date().toLocaleString()}`,
      `─────────────────────────────`,
      `Status:       Stream active`,
      `Display Type: ${displayType ?? 'Unknown'}`,
      `Resolution:   ${resolution.width > 0 ? `${resolution.width} × ${resolution.height} px` : 'Detecting…'}`,
      `Frame Rate:   ${frameRate != null ? `${frameRate} fps` : '—'}`,
      `Duration:     ${formatDuration(elapsedSeconds)}`,
      `Track Health: ${trackReadyState ?? '—'}`,
    ].join('\n');

    navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = setTimeout(() => setCopied(false), 2000);
    });
  }, [displayType, resolution, frameRate, elapsedSeconds, trackReadyState]);

  /* ── Derived ────────────────────────────────────────────────────── */
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.idle;
  const message = config.message ?? error ?? 'An unexpected error occurred.';
  const stepIndex = getStepIndex(status);
  const isLocked = status === 'requesting';
  const isActive = status === 'granted' && !!stream;

  return (
    <>
      {/* Animated mesh + grain */}
      <div className="mesh-bg" aria-hidden="true" />
      <div className="noise" aria-hidden="true" />

      <main className="screen-test-page">
        <div className="screen-test-wrap">

          {/* ── Header ─────────────────────────────────────────────── */}
          <header className="st-header">
            <div className="st-header-left">
              <span className="st-breadcrumb">Screen Share Test App</span>
              <h1 className="st-title">Screen Test</h1>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
              {/* Step progress bar */}
              <nav
                className="step-bar"
                aria-label="Test progress"
                aria-valuemin={1}
                aria-valuemax={3}
                aria-valuenow={stepIndex + 1}
                aria-valuetext={STEPS[stepIndex]?.label}
                role="progressbar"
              >
                {STEPS.map((step, i) => {
                  const done = i < stepIndex;
                  const active = i === stepIndex;
                  return (
                    <div key={step.id} style={{ display: 'flex', alignItems: 'center' }}>
                      <div
                        className={`step-item${done ? ' done' : active ? ' active' : ''}`}
                        title={step.label}
                      >
                        <div className="step-num" aria-hidden="true">
                          {done ? '✓' : step.id}
                        </div>
                        {/* Visually hidden but readable by screen readers */}
                        <span className="sr-only">{step.label}</span>
                      </div>
                      {i < STEPS.length - 1 && (
                        <div
                          className={`step-line${done ? ' done' : ''}`}
                          aria-hidden="true"
                        />
                      )}
                    </div>
                  );
                })}
              </nav>

              <Button
                variant="secondary"
                onClick={handleBack}
                disabled={isLocked}
                aria-label="Back to Home"
              >
                ← Home
              </Button>
            </div>
          </header>

          {/* ── Status card ─────────────────────────────────────────── */}
          <div
            className={`card status-card s-${status} ${config.cardClass}`}
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            <div className="status-card-shimmer" aria-hidden="true" />

            {/* Icon / spinner */}
            <div className="status-icon-wrap" aria-hidden="true">
              {status === 'requesting'
                ? <LoadingSpinner size="medium" />
                : <span style={{ lineHeight: 1 }}>{config.icon}</span>
              }
              {status === 'granted' && <span className="icon-pulse" />}
            </div>

            {/* Text */}
            <div className="status-body">
              <div className="status-label">{config.label}</div>
              <h2 className="status-title">{config.title}</h2>
              <p className="status-message">{message}</p>
            </div>
          </div>

          {/* ── Video Preview ────────────────────────────────────────── */}
          {/*
            The video element is ALWAYS in the DOM so the useEffect that
            calls `video.srcObject = null` always has a target element.
            We toggle visibility via CSS to avoid frozen frames.
          */}
          <div
            className={`preview-section${isActive ? '' : ' preview-section--hidden'}`}
            aria-hidden={!isActive}
          >
            <div className="card preview-card">
              <div className="preview-header">
                <div className="preview-title">Live Preview</div>
                <div className="live-badge">
                  <span className="live-dot" aria-hidden="true" />
                  Live
                </div>
              </div>
              <div className="video-wrapper">
                <div className="video-corner tl" aria-hidden="true" />
                <div className="video-corner tr" aria-hidden="true" />
                <div className="video-corner bl" aria-hidden="true" />
                <div className="video-corner br" aria-hidden="true" />
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="preview-video"
                  aria-label="Live screen share preview"
                />
                {/* Mirror warning — shown when sharing the current browser tab */}
                {displayType === 'Browser Tab' && (
                  <div className="mirror-warning" role="note">
                    <span className="mirror-warning-icon" aria-hidden="true">🪞</span>
                    <span>
                      <strong>Hall-of-mirrors effect</strong> — you're sharing this tab.
                      Share a <em>different tab, window, or screen</em> for a clean preview.
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* ── Stream metadata ─────────────────────────────────────── */}
            <div className="card metadata-card">
              <div className="metadata-header">
                <div className="metadata-heading">Stream Metadata</div>
                {/* Feature: Copy to clipboard */}
                <button
                  className={`copy-btn${copied ? ' copy-btn--copied' : ''}`}
                  onClick={handleCopyInfo}
                  aria-label="Copy stream metadata to clipboard"
                  title="Copy metadata to clipboard"
                >
                  {copied ? '✅ Copied!' : '📋 Copy Info'}
                </button>
              </div>
              <div className="metadata-grid">

                {/* Status */}
                <MetaTile
                  label="Status"
                  value={
                    <span className="active">
                      <span className="pulse-dot" aria-hidden="true" />
                      Stream active
                    </span>
                  }
                  active
                />

                {/* Display type (tab / window / entire screen) */}
                <MetaTile
                  label="Display Type"
                  value={displayType ?? 'Unknown'}
                  tooltip="Chromium browsers (Chrome, Edge) provide detailed display categories. Others may show 'Unknown'."
                />

                {/* Actual resolution from track.getSettings() */}
                <MetaTile
                  label="Resolution"
                  value={
                    resolution.width > 0 && resolution.height > 0
                      ? `${resolution.width} × ${resolution.height} px`
                      : 'Detecting…'
                  }
                />

                {/* Actual frame rate from track.getSettings() */}
                <MetaTile
                  label="Frame Rate"
                  value={frameRate != null ? `${frameRate} fps` : '—'}
                  tooltip="Actual captured frame rate. May vary depending on browser and content."
                />

                {/* Feature: Session Duration */}
                <MetaTile
                  label="Session Duration"
                  value={
                    <span className="duration-value">
                      ⏱ {formatDuration(elapsedSeconds)}
                    </span>
                  }
                  tooltip="Time elapsed since screen sharing started."
                />

                {/* Feature: Track Health */}
                <MetaTile
                  label="Track Health"
                  value={
                    trackReadyState === 'live'
                      ? <span className="health-badge health-live">● live</span>
                      : trackReadyState === 'ended'
                        ? <span className="health-badge health-ended">● ended</span>
                        : <span className="health-badge">—</span>
                  }
                  tooltip="Real-time readyState of the video MediaStreamTrack."
                />

              </div>
            </div>
          </div>

          {/* ── Action buttons ──────────────────────────────────────── */}
          <div className="action-row" role="group" aria-label="Screen share controls">

            {/* IDLE — start button, enabled */}
            {status === 'idle' && (
              <Button onClick={handleStart} aria-label="Start screen share test">
                🚀 Start Screen Share
              </Button>
            )}

            {/* REQUESTING — button disabled with spinner, no other controls */}
            {status === 'requesting' && (
              <Button disabled loading aria-label="Waiting for screen picker">
                Waiting for picker…
              </Button>
            )}

            {/* GRANTED — only Stop button */}
            {status === 'granted' && (
              <Button
                variant="danger"
                onClick={handleStop}
                aria-label="Stop screen sharing"
              >
                ⏹ Stop Sharing
              </Button>
            )}

            {/* TERMINAL states — Retry + Back to Home */}
            {(status === 'cancelled' ||
              status === 'denied' ||
              status === 'ended' ||
              status === 'error') && (
                <>
                  <Button
                    onClick={handleRetry}
                    aria-label="Start a fresh screen share test"
                  >
                    🔄 Retry Screen Test
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={handleBack}
                    aria-label="Go back to Home page"
                  >
                    ← Back to Home
                  </Button>
                </>
              )}

          </div>

          {/* Keyboard shortcut hints */}
          <div className="kbd-hints" aria-label="Keyboard shortcuts">
            <span className="kbd-hint">
              <kbd>S</kbd> Start / Retry
            </span>
            <span className="kbd-hint-sep" aria-hidden="true">·</span>
            <span className="kbd-hint">
              <kbd>Esc</kbd> Stop / Back
            </span>
          </div>

          {/* ── Footer note ─────────────────────────────────────────── */}
          <p className="footer-note" aria-label="Notes">
            <span>Chrome or Edge recommended</span>
            <span className="footer-note-sep" aria-hidden="true">·</span>
            <span>Local preview only</span>
            <span className="footer-note-sep" aria-hidden="true">·</span>
            <span>No recording or streaming</span>
          </p>

        </div>
      </main >
    </>
  );
};

/* ─────────────────────────────────────────────────────────────────── */
/* Stateless MetaTile — pure presentational component                   */
/* ─────────────────────────────────────────────────────────────────── */
const MetaTile = ({ label, value, active = false, tooltip = null }) => (
  <div className="meta-tile">
    <div className="meta-tile-label-wrap">
      <span className="meta-tile-label">{label}</span>
      {tooltip && (
        <span className="info-icon" data-tooltip={tooltip}>i</span>
      )}
    </div>
    <span className={`meta-tile-value${active ? ' active' : ''}`}>
      {value}
    </span>
  </div>
);


export default ScreenTest;