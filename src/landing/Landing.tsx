import { Component, lazy, Suspense, useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowUpRight, Move, Radar, Radio, ScanEye } from 'lucide-react';
import { Site, type Theme } from './Site';

const DopplerRadarScene = lazy(() => import('../DopplerRadarScene'));

class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div className="lp-stage-loading">
        <Radar size={44} strokeWidth={1} />
        <span>3D view unavailable on this device</span>
      </div>
    ) : (
      this.props.children
    );
  }
}

function RadarStage({ theme }: { theme: Theme }) {
  const [still, setStill] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce), (max-width: 700px)').matches,
  );
  const [xray, setXray] = useState(false);
  const [scanEl, setScanEl] = useState<number | null>(null);
  const [stageVisible, setStageVisible] = useState(false);
  const stage = useRef<HTMLDivElement>(null);
  const rotation = useRef(0),
    pulse = useRef(-10000),
    drag = useRef<number | null>(null);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce), (max-width: 700px)');
    const change = () => setStill(media.matches);
    media.addEventListener('change', change);
    return () => media.removeEventListener('change', change);
  }, []);

  // Pause the 3D scene while it is off screen.
  useEffect(() => {
    const el = stage.current;
    if (!el || !('IntersectionObserver' in window)) {
      setStageVisible(true);
      return;
    }
    const io = new IntersectionObserver(([entry]) => setStageVisible(entry.isIntersecting), {
      rootMargin: '120px',
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={stage}
      className="lp-stage"
      onPointerDown={(e) => {
        // Capturing the pointer would retarget the click away from controls inside the stage.
        if ((e.target as HTMLElement).closest('button, a')) return;
        if (!still) {
          drag.current = e.clientX;
          e.currentTarget.setPointerCapture(e.pointerId);
        }
      }}
      onPointerMove={(e) => {
        if (drag.current !== null && !still) {
          rotation.current += (e.clientX - drag.current) * 0.006;
          drag.current = e.clientX;
        }
      }}
      onPointerUp={() => (drag.current = null)}
      onPointerCancel={() => (drag.current = null)}
      role="img"
      aria-label="Representative model of a radome-housed X-band Doppler weather radar. Drag to rotate."
    >
      <SceneBoundary>
        <Suspense
          fallback={
            <div className="lp-stage-loading">
              <Radar size={44} strokeWidth={1} />
            </div>
          }
        >
          <DopplerRadarScene
            rotation={rotation}
            pulse={pulse}
            xray={xray}
            still={still}
            paused={!stageVisible}
            dark={theme === 'dark'}
            onElevation={setScanEl}
          />
        </Suspense>
      </SceneBoundary>
      <div className="lp-stage-top">
        <span className="lp-stage-note">Representative model ·</span>
        {!still && scanEl !== null && (
          <span className="lp-chip live" aria-live="off">
            <i /> Scanning {scanEl.toFixed(1)}°
          </span>
        )}
      </div>
      <div className="lp-stage-controls">
        {!still && (
          <span>
            <Move size={14} /> Drag to rotate
          </span>
        )}
        <div className="lp-stage-buttons">
          <button className="lp-btn lp-btn-ghost lp-btn-sm" aria-pressed={xray} onClick={() => setXray(!xray)}>
            <ScanEye size={14} /> {xray ? 'Show radome' : 'Look inside'}
          </button>
          {!still && (
            <button className="lp-btn lp-btn-ghost lp-btn-sm" onClick={() => (pulse.current = performance.now())}>
              <Radio size={14} /> Send a pulse
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Landing() {
  const [rippleKey, setRippleKey] = useState(0);
  const triggerRipple = () => setRippleKey((k) => k + 1);

  return (
    <Site showDashboard={false}>
      {(theme) => (
        <section className="lp-hero">
          <div className="lp-aurora" aria-hidden="true" />
          <div className="lp-wrap lp-hero-grid">
            <div className="lp-hero-copy">
              <h1>Mahabaleshwar X&#8209;band Weather Radar</h1>
              <p>Radar data viewing and analysis for the Doppler Weather Radar at Mahabaleshwar.</p>
              <div className="lp-cta">
                <a
                  className="lp-btn lp-btn-primary lp-btn-radar"
                  href="#/login"
                  onMouseEnter={triggerRipple}
                  onClick={triggerRipple}
                >
                  {rippleKey > 0 && (
                    <span key={rippleKey} className="lp-radar-ripples" aria-hidden="true">
                      <span className="lp-radar-ring" />
                      <span className="lp-radar-ring" />
                      <span className="lp-radar-ring" />
                    </span>
                  )}
                  Dashboard <ArrowUpRight size={17} />
                </a>
              </div>
            </div>
            <RadarStage theme={theme} />
          </div>
        </section>
      )}
    </Site>
  );
}
