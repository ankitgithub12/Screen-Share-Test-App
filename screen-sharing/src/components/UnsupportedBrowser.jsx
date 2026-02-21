const UnsupportedBrowser = () => (
  <div className="card unsupported-card" role="alert" aria-live="assertive">
    <div className="unsupported-icon-wrap" aria-hidden="true">⚠️</div>
    <h2 className="unsupported-title">Browser Not Supported</h2>
    <p className="unsupported-msg">
      Your browser doesn't support the screen sharing API required by this app.
    </p>
    <code className="unsupported-code">navigator.mediaDevices.getDisplayMedia</code>
    <p className="unsupported-msg" style={{ fontSize: '0.82rem', marginTop: 0 }}>
      Please switch to a supported browser:
    </p>
    <div className="unsupported-browsers">
      <span className="browser-pill">🌐 Chrome</span>
      <span className="browser-pill">🔷 Edge</span>
    </div>
  </div>
);

export default UnsupportedBrowser;