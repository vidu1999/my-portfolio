'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * Orbital neon rings. Each ring is a torus with an additive shader that fades
 * the tail and brightens the leading arc, so it reads as a glowing light trail
 * rather than a flat green hoop. Rings rotate independently on tilted axes.
 */

const RING_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const RING_FRAG = /* glsl */ `
  uniform float uTime;
  uniform vec3  uColor;
  uniform float uSpeed;
  uniform float uOffset;
  varying vec2 vUv;
  void main() {
    // vUv.x runs around the ring. Build a comet: bright head, long soft tail.
    float p = fract(vUv.x - uTime * uSpeed + uOffset);
    float head = exp(-pow((1.0 - p) * 7.0, 2.0));
    float tail = pow(1.0 - p, 2.6) * 0.55;
    float base = 0.30;
    float i = base + head * 2.4 + tail * 1.3;
    // Fade the tube cross-section so the ring has a soft neon core.
    float edge = smoothstep(0.0, 0.35, vUv.y) * smoothstep(1.0, 0.65, vUv.y);
    gl_FragColor = vec4(uColor * i, clamp(i * (0.45 + edge * 0.55), 0.0, 1.0));
  }
`;

const RINGS = [
  { radius: 2.62, tube: 0.030, tilt: [1.15, 0.2, 0.42], speed: 0.13, spin: 0.10, offset: 0.0 },
  { radius: 3.05, tube: 0.022, tilt: [1.32, -0.5, -0.30], speed: -0.09, spin: -0.07, offset: 0.45 },
  { radius: 2.28, tube: 0.018, tilt: [0.78, 0.9, 0.15], speed: 0.17, spin: 0.13, offset: 0.72 },
];

function Ring({ radius, tube, tilt, speed, spin, offset, reducedMotion }) {
  const ref = useRef(null);
  const mat = useRef(null);
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uColor: { value: new THREE.Color('#2bff62') },
      uSpeed: { value: speed },
      uOffset: { value: offset },
    }),
    [speed, offset]
  );

  useFrame((state, rawDelta) => {
    const delta = Math.min(rawDelta, 1 / 20);
    if (mat.current) mat.current.uniforms.uTime.value = state.clock.elapsedTime;
    if (!reducedMotion && ref.current) ref.current.rotation.z += delta * spin;
  });

  return (
    <group rotation={tilt}>
      <mesh ref={ref}>
        <torusGeometry args={[radius, tube, 6, 110]} />
        <shaderMaterial
          ref={mat}
          uniforms={uniforms}
          vertexShader={RING_VERT}
          fragmentShader={RING_FRAG}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          side={THREE.DoubleSide}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

export default function OrbitalRings({ reducedMotion = false, ...props }) {
  return (
    <group {...props}>
      {RINGS.map((r, i) => (
        <Ring key={i} {...r} reducedMotion={reducedMotion} />
      ))}
    </group>
  );
}
