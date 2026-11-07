'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { publicAsset } from '@/app/lib/publicAsset';
import { setRenderPaused } from '@/app/lib/renderPause';
import { useLoadingProgress } from './useLoadingProgress';
import Hud from './Hud';
import Terminal from './Terminal';
import './loading.css';

/**
 * Cinematic VKJ loading screen.
 *
 * Mounted once from the root layout as a fixed overlay ABOVE the real page, so
 * the portfolio renders and loads underneath it. When progress reaches 100% we
 * show PORTFOLIO READY, fade out, then unmount entirely — releasing the WebGL
 * context and every GPU resource. sessionStorage keeps it from replaying on
 * internal navigation or reloads within the same session.
 */

const LoadingScene = dynamic(() => import('./scene/LoadingScene'), {
  ssr: false,
  loading: () => null,
});

const STORAGE_KEY = 'vkj-loader-seen';
const READY_HOLD = 850;
const FADE_MS = 900;

/** Cheap WebGL probe; avoids mounting a Canvas that is guaranteed to fail. */
function detectWebGL() {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return false;
    const lose = gl.getExtension('WEBGL_lose_context');
    if (lose) lose.loseContext();
    return true;
  } catch {
    return false;
  }
}

function FallbackCube() {
  return (
    <div className="vkj-fallback" aria-hidden="true">
      <div className="vkj-fallback-stage">
        <div className="vkj-fallback-cube">
          <i /><i /><i /><i /><i /><i />
        </div>
        {/* Sibling of the rotating cube, not a child: stays upright, readable
            and in front of the translucent faces. */}
        <div className="vkj-fallback-logo">
          V<b>K</b>J
        </div>
      </div>
    </div>
  );
}

export default function LoadingScreen() {
  // Null until mounted: the server always renders the overlay markup so the
  // first paint is never a flash of unstyled portfolio, and hydration matches.
  const [enabled, setEnabled] = useState(true);
  const [resolved, setResolved] = useState(false);
  const [webgl, setWebgl] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [gone, setGone] = useState(false);
  const [tabVisible, setTabVisible] = useState(true);
  const [mountScene, setMountScene] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const sceneReady = useRef(false);

  // Track the tab directly — usePageVisible also reports the loader's own pause.
  useEffect(() => {
    const update = () => setTabVisible(document.visibilityState !== 'hidden');
    update();
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);

  const assets = useMemo(
    () => [publicAsset('bg/bg.webp'), publicAsset('og.jpg')],
    []
  );

  // Decide whether to show at all, before the progress loop starts.
  useEffect(() => {
    // Opt-in preview: `?vkjPreview=1` always shows the loader and holds it on
    // screen so the animation can be demoed or reviewed. Normal visits never
    // set this, so the session gate and auto-dismiss behave as usual.
    const preview = new URLSearchParams(window.location.search).get('vkjPreview') === '1';
    setPreviewMode(preview);

    let seen = false;
    try {
      seen = !preview && sessionStorage.getItem(STORAGE_KEY) === '1';
    } catch {
      seen = false; // private mode / blocked storage → just show it
    }
    if (seen) {
      setEnabled(false);
      setGone(true);
      setResolved(true);
      return;
    }

    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mq.matches);
    const hasWebGL = detectWebGL();
    setWebgl(hasWebGL);
    setResolved(true);

    const onChange = (e) => setReducedMotion(e.matches);
    if (mq.addEventListener) mq.addEventListener('change', onChange);
    else mq.addListener(onChange);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', onChange);
      else mq.removeListener(onChange);
    };
  }, []);

  const active = enabled && resolved && !gone;

  // Let the HUD paint and the progress loop start BEFORE the WebGL scene boots.
  // Compiling the scene's shaders blocks the main thread briefly; deferring it
  // past the first paint keeps the bar moving instead of freezing at 0%.
  useEffect(() => {
    if (!active || !webgl) return undefined;
    let timer = 0;
    const raf = requestAnimationFrame(() => {
      timer = setTimeout(() => setMountScene(true), 60);
    });
    return () => { cancelAnimationFrame(raf); clearTimeout(timer); };
  }, [active, webgl]);

  const { percent, complete, markSceneReady } = useLoadingProgress({
    minDuration: reducedMotion ? 900 : 2600,
    assets,
    enabled: active,
  });

  // No WebGL → the CSS fallback is "ready" as soon as it mounts.
  useEffect(() => {
    if (active && !webgl) markSceneReady();
  }, [active, webgl, markSceneReady]);

  const handleSceneReady = useCallback(() => {
    if (sceneReady.current) return;
    sceneReady.current = true;
    markSceneReady();
  }, [markSceneReady]);

  // Lock scroll while the overlay is up; restore exactly on exit.
  useEffect(() => {
    if (!active) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [active]);

  // Pause the portfolio's own canvases/particles behind the opaque overlay so
  // only one 3D scene is drawing. Released when the loader unmounts (`active`
  // flips false) — not at fade-start, which would let the portfolio's canvases
  // spin up mid-fade and starve the fade itself on weak GPUs.
  useEffect(() => {
    if (!active) return undefined;
    return setRenderPaused(true);
  }, [active]);

  // 100% → hold on PORTFOLIO READY → fade → unmount.
  useEffect(() => {
    if (!complete || !active) return undefined;
    // Preview mode holds the finished loader on screen for review.
    if (previewMode) return undefined;
    try { sessionStorage.setItem(STORAGE_KEY, '1'); } catch { /* ignore */ }

    const hold = setTimeout(() => setLeaving(true), reducedMotion ? 260 : READY_HOLD);
    const remove = setTimeout(() => setGone(true), (reducedMotion ? 260 : READY_HOLD) + (reducedMotion ? 60 : FADE_MS));
    return () => { clearTimeout(hold); clearTimeout(remove); };
  }, [complete, active, reducedMotion, previewMode]);

  if (gone) return null;

  // Preview mode holds a representative mid-load frame so the screen can be
  // reviewed/demoed deterministically. Real visits use the live values.
  const shownPercent = previewMode ? 68 : percent;
  const shownComplete = previewMode ? false : complete;
  const status = shownComplete ? 'Portfolio ready' : 'Initializing experience...';

  return (
    <div
      className={`vkj-root${shownComplete ? ' vkj-ready' : ''}`}
      data-leaving={leaving ? 'true' : 'false'}
      role="progressbar"
      aria-label="Loading portfolio"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={shownPercent}
      aria-busy={!shownComplete}
    >
      {resolved && webgl && mountScene ? (
        <LoadingScene
          onReady={handleSceneReady}
          reducedMotion={reducedMotion}
          // Pause once loading finishes so the ready-hold and fade timers aren't
          // starved by render work on weak GPUs. The last frame survives because
          // the renderer uses preserveDrawingBuffer. Preview mode keeps drawing
          // so the animation can be reviewed indefinitely.
          visible={tabVisible && !gone && (!complete || previewMode)}
        />
      ) : (
        <FallbackCube />
      )}

      <div className="vkj-atmos" />
      <div className="vkj-vignette" />
      <Hud />
      <Terminal reducedMotion={reducedMotion} />

      <div className="vkj-load">
        <h2 className="vkj-title">
          {shownComplete ? <>Portfolio <b>Ready</b></> : <>Loading <b>Portfolio</b></>}
        </h2>

        <div className="vkj-bar-row">
          <div className="vkj-track">
            <div className="vkj-fill" style={{ width: `calc(${shownPercent}% - 2px)` }} />
            <div className="vkj-head" style={{ left: `${shownPercent}%`, opacity: shownPercent > 1 && shownPercent < 100 ? 1 : 0 }} />
          </div>
          <div className="vkj-pct">{shownPercent}%</div>
        </div>

        <div className="vkj-status">
          <hr />
          <span>{status}</span>
          <hr />
        </div>
      </div>
    </div>
  );
}
