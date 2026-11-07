'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import VkjCube from './VkjCube';
import OrbitalRings from './OrbitalRings';
import Platform from './Platform';
import SceneEnvironment from './SceneEnvironment';
import { PALETTE } from '../palette';

/**
 * The loading screen's WebGL stage.
 *
 * Isolated in its own <Canvas> so it can be torn down completely once loading
 * finishes — every geometry, material and the GL context itself are released,
 * leaving the portfolio's own canvases with the full GPU budget.
 */

/** Signals readiness after the first genuinely rendered frame. */
function ReadySignal({ onReady }) {
  const done = useRef(false);
  const frames = useRef(0);
  useFrame(() => {
    if (done.current) return;
    frames.current += 1;
    // One presented frame is enough: shaders are compiled by then. Waiting for
    // more needlessly delays readiness on weak GPUs.
    if (frames.current >= 1) {
      done.current = true;
      onReady();
    }
  });
  return null;
}

/** Gentle camera parallax that follows the pointer without moving the layout. */
function CameraRig({ reducedMotion, target, fitHalfWidth }) {
  const { camera, size } = useThree();
  const pointer = useRef({ x: 0, y: 0 });
  const current = useRef({ x: 0, y: 0 });

  // Pull back on narrow/portrait viewports so the platform and rings stay inside
  // the frame. A fixed distance crops them badly on tablets.
  //
  // Width alone is not enough: the cube is rotated, so its screen diagonal is
  // ~1.7x its edge and on a tall viewport that diagonal grew until the rings swept
  // across the terminal text. Fitting the vertical extent too, with headroom for
  // the HUD, keeps the centrepiece clear of the corners at every aspect.
  const distance = useMemo(() => {
    const vFov = (camera.fov * Math.PI) / 180;
    const aspect = size.width / Math.max(size.height, 1);
    const tanV = Math.tan(vFov / 2);
    const byWidth = fitHalfWidth / Math.max(tanV * aspect, 0.05);
    // Rotated-cube diagonal plus ring sweep, as a fraction of viewport height.
    const portrait = aspect < 1.2;
    const verticalExtent = fitHalfWidth * (portrait ? 1.55 : 1.15);
    const byHeight = verticalExtent / Math.max(tanV, 0.05);
    return Math.max(11, byWidth, byHeight);
  }, [camera, size.width, size.height, fitHalfWidth]);

  useEffect(() => {
    camera.position.z = distance;
    camera.updateProjectionMatrix();
  }, [camera, distance]);

  useEffect(() => {
    if (reducedMotion) return undefined;
    const onMove = (e) => {
      pointer.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.current.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, [reducedMotion]);

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 1 / 20);
    const k = 1 - Math.exp(-2.4 * delta);
    current.current.x += (pointer.current.x - current.current.x) * k;
    current.current.y += (pointer.current.y - current.current.y) * k;
    camera.position.x = current.current.x * 0.55;
    camera.position.y = target[1] - current.current.y * 0.22;
    camera.lookAt(0, target[1], 0);
  });
  return null;
}

function Lights({ quality }) {
  const key = useRef(null);
  useFrame((state) => {
    if (key.current) {
      key.current.intensity = 1.5 + Math.sin(state.clock.elapsedTime * 0.8) * 0.35;
    }
  });
  return (
    <>
      <ambientLight intensity={0.16} color={PALETTE.rock} />
      {/* Green key light from the platform, pulsing softly. */}
      <pointLight ref={key} position={[0, 1.5, 0]} color={PALETTE.accent} intensity={1.5} distance={16} decay={2.0} />
      <pointLight position={[0, 5.0, 3]} color="#d8ffe8" intensity={1.1} distance={24} decay={1.9} />
      {/* Cool rim so the chrome lettering reads as metal, not plastic. */}
      <directionalLight position={[-6, 7, 6]} intensity={1.5} color="#eafff2" />
      <directionalLight position={[7, 3, -5]} intensity={0.85} color={PALETTE.particle} />
      {quality === 'high' && (
        <spotLight position={[0, 12, 2]} angle={0.5} penumbra={1} intensity={1.2} color={PALETTE.accent} distance={30} />
      )}
    </>
  );
}

/**
 * Procedural studio environment for chrome/glass reflections — no downloads.
 *
 * Built as a tiny 128x64 equirectangular HDR-ish texture on the CPU, then PMREM
 * filtered. Rendering an offscreen scene instead would allocate a 256px cube
 * target and block the main thread for seconds on weak GPUs, which stalls the
 * progress bar. This costs well under a millisecond and a few KB.
 */
function buildStudioTexture() {
  const w = 128;
  const h = 64;
  // Float, not 8-bit: chrome needs real HDR range. Encoding these values into
  // bytes clamps the softboxes and crushes the base to black, which makes
  // metal read as flat grey.
  const data = new Float32Array(w * h * 4);
  const smoothstep = (e0, e1, x) => {
    const t = Math.min(Math.max((x - e0) / (e1 - e0), 0), 1);
    return t * t * (3 - 2 * t);
  };
  const gauss = (x, k) => Math.exp(-((x * k) ** 2));

  for (let y = 0; y < h; y++) {
    const theta = (y / (h - 1)) * Math.PI;          // 0 = up
    const dy = Math.cos(theta);
    const sinT = Math.sin(theta);
    const up = dy * 0.5 + 0.5;
    for (let x = 0; x < w; x++) {
      const phi = (x / (w - 1)) * Math.PI * 2 - Math.PI;
      const dx = sinT * Math.cos(phi);
      const dz = sinT * Math.sin(phi);
      const az = Math.atan2(dz, dx);

      const ceil = smoothstep(0.70, 0.98, up) * 2.2;
      let boxes = gauss(az - 0.60, 2.6) * 2.6
                + gauss(az + 1.90, 3.0) * 2.0
                + gauss(az - 2.70, 3.4) * 1.5
                // Broad frontal softbox so camera-facing chrome reads silver.
                + gauss(az - 1.5708, 1.7) * 2.4;
      boxes *= smoothstep(-0.55, 0.15, dy) * smoothstep(0.98, 0.30, dy);
      const accent = gauss(az + 0.35, 3.2) * smoothstep(-0.2, 0.5, dy) * 0.9;

      const white = ceil + boxes;
      // Green-dominant accent + near-black base, matching the environment
      // plate's grade so chrome reflects the world it is standing in.
      const r = 0.012 + up * 0.188 + white + accent * 0.30;
      const g = 0.016 + up * 0.214 + white + accent * 1.00;
      const b = 0.018 + up * 0.202 + white + accent * 0.50;

      const i = (y * w + x) * 4;
      // Store linear radiance directly — PMREM consumes it as HDR.
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = 1;
    }
  }
  const tex = new THREE.DataTexture(data, w, h, THREE.RGBAFormat, THREE.FloatType);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.LinearSRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

function Reflections() {
  const { gl, scene } = useThree();
  useEffect(() => {
    const src = buildStudioTexture();
    const pmrem = new THREE.PMREMGenerator(gl);
    const rt = pmrem.fromEquirectangular(src);
    scene.environment = rt.texture;
    // The source is only needed to build the PMREM; free it immediately.
    src.dispose();
    pmrem.dispose();

    return () => {
      scene.environment = null;
      rt.dispose();
    };
  }, [gl, scene]);
  return null;
}

function SceneContents({ reducedMotion, quality, onReady, compact }) {
  // Composition tuned against the reference: cube above centre, platform below.
  const cubeY = compact ? 2.05 : 2.20;
  const cubeSize = compact ? 2.30 : 2.50;
  const platformRadius = compact ? 2.7 : 3.12;

  return (
    <>
      {/* No background colour: the canvas is transparent so the environment
          plate behind it shows through. Fog still tints distant geometry so the
          live objects sit in the same depth as the baked terrain. */}
      <fogExp2 attach="fog" args={[PALETTE.fog, 0.019]} />

      <CameraRig
        reducedMotion={reducedMotion}
        target={[0, 0.85, 11]}
        fitHalfWidth={platformRadius * 1.12}
      />
      <Lights quality={quality} />
      <Reflections />

      <SceneEnvironment reducedMotion={reducedMotion} quality={quality} />

      <Platform radius={platformRadius} reducedMotion={reducedMotion} />

      <group position={[0, cubeY, 0]}>
        <VkjCube size={cubeSize} reducedMotion={reducedMotion} quality={quality} />
        <OrbitalRings reducedMotion={reducedMotion} scale={compact ? 0.82 : 1} />
      </group>

      <ReadySignal onReady={onReady} />
    </>
  );
}

export default function LoadingScene({ onReady, reducedMotion = false, visible = true }) {
  const [quality, setQuality] = useState('high');
  const [compact, setCompact] = useState(false);
  const wrapRef = useRef(null);

  // Pick a quality tier once, from real device signals.
  useEffect(() => {
    const cores = navigator.hardwareConcurrency || 4;
    const mem = navigator.deviceMemory || 4;
    const small = window.innerWidth < 900;
    setCompact(small);
    if (small || cores <= 4 || mem <= 4) setQuality('low');

    const onResize = () => setCompact(window.innerWidth < 900);
    window.addEventListener('resize', onResize, { passive: true });
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const dpr = useMemo(() => (quality === 'high' ? [1, 1.75] : [1, 1.25]), [quality]);

  return (
    <div ref={wrapRef} className="vkj-canvas" aria-hidden="true">
      <Canvas
        dpr={dpr}
        frameloop={visible ? 'always' : 'never'}
        gl={{
          antialias: quality === 'high',
          powerPreference: 'high-performance',
          alpha: true,
          stencil: false,
          depth: true,
          // Keep the last frame after the render loop is paused for the exit.
          // Without this the browser discards the drawing buffer on the next
          // composite and the scene blinks out instead of fading.
          preserveDrawingBuffer: true,
        }}
        camera={{ position: [0, 1.15, 11], fov: 42, near: 0.1, far: 140 }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.0;
        }}
      >
        <Suspense fallback={null}>
          <SceneContents
            reducedMotion={reducedMotion}
            quality={quality}
            onReady={onReady}
            compact={compact}
          />
        </Suspense>
      </Canvas>
    </div>
  );
}
