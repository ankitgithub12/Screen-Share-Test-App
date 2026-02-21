import { useState, useCallback, useRef, useEffect } from 'react';

/**
 * useScreenShare
 * Isolates all screen-sharing logic.
 *
 * Status values:
 *   idle        – ready, no stream
 *   requesting  – picker is open
 *   granted     – stream is live
 *   cancelled   – user dismissed picker without choosing
 *   denied      – OS/browser permission explicitly blocked
 *   ended       – stream stopped externally (browser UI / OS)
 *   error       – unexpected / unrecognised error
 */
const useScreenShare = () => {
  const [stream, setStream] = useState(null);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);
  const [displayType, setDisplayType] = useState(null);
  const [resolution, setResolution] = useState({ width: 0, height: 0 });
  const [frameRate, setFrameRate] = useState(null);

  // Feature: live session duration counter (seconds since stream was granted)
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Feature: live track readyState poll ('live' | 'ended' | null)
  const [trackReadyState, setTrackReadyState] = useState(null);

  // Ref holds the live stream so the onended closure always sees the
  // current stream without being re-created.
  const streamRef = useRef(null);

  // Interval refs — kept as refs so they survive renders without being deps
  const timerRef = useRef(null);
  const healthRef = useRef(null);

  /* ── startTimer / stopTimer ─────────────────────────────────── */
  const stopIntervals = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (healthRef.current) {
      clearInterval(healthRef.current);
      healthRef.current = null;
    }
  }, []);

  /* ── cleanup ---------------------------------------------------- */
  /**
   * Stop all tracks, clear refs/state.
   * @param {string} nextStatus – status to set after cleanup (default 'idle')
   */
  const cleanup = useCallback((nextStatus = 'idle') => {
    stopIntervals();
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.onended = null; // remove handler BEFORE stop to avoid re-entry
        track.stop();
      });
      streamRef.current = null;
    }
    setStream(null);
    setDisplayType(null);
    setResolution({ width: 0, height: 0 });
    setFrameRate(null);
    setError(null);
    setElapsedSeconds(0);
    setTrackReadyState(null);
    setStatus(nextStatus);
  }, [stopIntervals]);

  /* ── startScreenShare ------------------------------------------- */
  const startScreenShare = useCallback(async () => {
    // ── Guard: API support ──────────────────────────────────────────
    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.getDisplayMedia !== 'function'
    ) {
      setStatus('error');
      setError(
        'Your browser does not support navigator.mediaDevices.getDisplayMedia. ' +
        'Please use Chrome or Edge.'
      );
      return;
    }

    // ── Tear down any residual stream (no leaks) ────────────────────
    stopIntervals();
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.onended = null;
        track.stop();
      });
      streamRef.current = null;
    }

    setStatus('requesting');
    setError(null);
    setDisplayType(null);
    setResolution({ width: 0, height: 0 });
    setFrameRate(null);
    setStream(null);
    setElapsedSeconds(0);
    setTrackReadyState(null);

    try {
      // ── Request the stream ──────────────────────────────────────
      // NOTE: Do NOT set displaySurface in constraints — that restricts
      // what the picker can offer. Only set frameRate as instructed.
      const mediaStream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 30 } },
        audio: false,
      });

      // Safety: stream should have a video track, but guard anyway.
      const videoTracks = mediaStream.getVideoTracks();
      if (!videoTracks || videoTracks.length === 0) {
        mediaStream.getTracks().forEach(t => t.stop());
        setStatus('cancelled');
        return;
      }

      const videoTrack = videoTracks[0];

      // ── Read metadata from track.getSettings() ──────────────────
      const settings = videoTrack.getSettings();

      // displaySurface: 'browser' (tab) | 'window' | 'monitor' (screen)
      const SURFACE_LABELS = {
        browser: 'Browser Tab',
        window: 'Application Window',
        monitor: 'Entire Screen',
      };
      setDisplayType(
        settings.displaySurface
          ? SURFACE_LABELS[settings.displaySurface] ?? settings.displaySurface
          : 'Unknown'
      );

      setResolution({
        width: settings.width ?? 0,
        height: settings.height ?? 0,
      });

      setFrameRate(
        settings.frameRate != null ? Math.round(settings.frameRate) : null
      );

      // ── Feature: Session duration timer ─────────────────────────
      setElapsedSeconds(0);
      timerRef.current = setInterval(() => {
        setElapsedSeconds(s => s + 1);
      }, 1000);

      // ── Feature: Track health poll ───────────────────────────────
      setTrackReadyState(videoTrack.readyState);
      healthRef.current = setInterval(() => {
        // videoTrack is captured in closure — still valid reference
        setTrackReadyState(videoTrack.readyState);
      }, 1000);

      // ── Stream lifecycle — browser-native "Stop sharing" button ─
      videoTrack.onended = () => {
        // Transition from 'granted' → 'ended' only (guard against
        // double-firing if cleanup already ran).
        setStatus(prev => (prev === 'granted' ? 'ended' : prev));
        stopIntervals();

        if (streamRef.current) {
          streamRef.current.getTracks().forEach(t => {
            t.onended = null;
            t.stop();
          });
          streamRef.current = null;
        }
        setStream(null);
        setDisplayType(null);
        setResolution({ width: 0, height: 0 });
        setFrameRate(null);
        setTrackReadyState('ended');
      };

      streamRef.current = mediaStream;
      setStream(mediaStream);
      setStatus('granted');

    } catch (err) {
      console.error('[useScreenShare]', err.name, err.message);

      /**
       * Error classification (Chrome / Edge):
       *
       * AbortError       – user dismissed the picker (most common "cancel")
       * NotAllowedError  – permission denied OR picker cancelled (older Chrome)
       *                    We inspect err.message to distinguish the two.
       * NotFoundError    – no capture source available
       * InvalidStateError– HTTPS required / document not active
       * TypeError         – bad constraints passed (shouldn't happen here)
       * Everything else  – unknown error with raw message
       */
      switch (err.name) {
        case 'AbortError':
          // User closed the picker without selecting
          setStatus('cancelled');
          break;

        case 'NotAllowedError': {
          // Chrome: message === "Permission denied" when OS blocks it
          // Chrome: throws NotAllowedError even for picker cancel in some versions
          const msg = (err.message || '').toLowerCase();
          const isHardDeny =
            msg.includes('permission denied') ||
            msg.includes('not allowed') ||
            msg === '';                        // empty message = hard deny
          if (isHardDeny) {
            setStatus('denied');
            setError(
              'Screen sharing permission was denied. ' +
              'Check your browser or OS settings and try again.'
            );
          } else {
            // Picker was dismissed (cancel from picker)
            setStatus('cancelled');
          }
          break;
        }

        case 'NotFoundError':
          setStatus('error');
          setError('No screen capture source was found on this device.');
          break;

        case 'InvalidStateError':
          setStatus('error');
          setError(
            'Screen sharing failed — the page must be served over HTTPS ' +
            'and must be the active document.'
          );
          break;

        case 'TypeError':
          setStatus('error');
          setError('Invalid screen sharing constraints. Please reload and try again.');
          break;

        default:
          setStatus('error');
          setError(err.message || 'An unexpected error occurred. Please try again.');
      }
    }
  }, [stopIntervals]);

  /* ── Unmount cleanup ──────────────────────────────────────────── */
  useEffect(() => {
    return () => {
      stopIntervals();
      // Release tracks when component unmounts — no state update needed
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => {
          track.onended = null;
          track.stop();
        });
        streamRef.current = null;
      }
    };
  }, [stopIntervals]);

  return {
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
  };
};

export default useScreenShare;
