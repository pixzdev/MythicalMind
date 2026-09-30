// Aurora Night ambient background.
// Pre-blurred radial gradients (no filter:blur cost), extremely slow drift,
// deep base + veil + faint stars + noise. Respects prefers-reduced-motion
// (CSS) and the workspace atmosphere setting (--aurora-opacity, 0 = off).

export function AuroraBackground() {
  return (
    <>
      <div className="aurora-stage" aria-hidden="true">
        <div className="aurora-blob aurora-blob-1" />
        <div className="aurora-blob aurora-blob-2" />
        <div className="aurora-blob aurora-blob-3" />
        <div className="aurora-blob aurora-blob-4" />
        <div className="aurora-stars" />
        <div className="aurora-veil" />
      </div>
      <div className="aurora-noise" aria-hidden="true" />
    </>
  );
}
