'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { PALETTE } from '../palette';

/**
 * Live scene dressing: drifting energy particles in a single draw call.
 * The floating glass cubes were removed by request.
 *
 * The grid floor, mountain terrain, ground fog and volumetric shafts used to be
 * generated here. They now come from the environment plate behind the canvas,
 * which looks far closer to the reference and costs no geometry at all.
 */

/* ---------------- grid floor ---------------- */

const PARTICLE_VERT = /* glsl */ `
  uniform float uTime;
  attribute float aSeed;
  varying float vAlpha;
  void main() {
    vec3 p = position;
    float s = aSeed * 6.2831;
    p.y += sin(uTime * 0.22 + s) * 0.9 + mod(uTime * 0.16 + aSeed * 12.0, 14.0) - 7.0;
    p.x += sin(uTime * 0.15 + s * 1.7) * 0.7;
    p.z += cos(uTime * 0.12 + s * 2.3) * 0.7;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = (aSeed * 2.8 + 1.4) * (34.0 / max(-mv.z, 1.0));
    vAlpha = 0.35 + 0.65 * abs(sin(uTime * 0.5 + s));
  }
`;

const PARTICLE_FRAG = /* glsl */ `
  uniform vec3 uColor;
  varying float vAlpha;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    if (d > 0.5) discard;
    float a = smoothstep(0.5, 0.0, d) * vAlpha;
    gl_FragColor = vec4(uColor, a);
  }
`;

function Particles({ count = 220, reducedMotion }) {
  const mat = useRef(null);
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const seed = new Float32Array(count);
    let s = 12345;
    const rand = () => {
      s = (s * 1664525 + 1013904223) % 4294967296;
      return s / 4294967296;
    };
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (rand() - 0.5) * 44;
      pos[i * 3 + 1] = rand() * 16 - 2;
      pos[i * 3 + 2] = (rand() - 0.5) * 30 - 4;
      seed[i] = rand();
    }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    return g;
  }, [count]);

  const uniforms = useMemo(
    () => ({ uTime: { value: 0 }, uColor: { value: new THREE.Color(PALETTE.soft) } }),
    []
  );

  useFrame((state) => {
    if (mat.current && !reducedMotion) mat.current.uniforms.uTime.value = state.clock.elapsedTime;
  });

  return (
    <points geometry={geo} frustumCulled={false}>
      <shaderMaterial
        ref={mat}
        uniforms={uniforms}
        vertexShader={PARTICLE_VERT}
        fragmentShader={PARTICLE_FRAG}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </points>
  );
}

export default function SceneEnvironment({ reducedMotion = false, quality = 'high' }) {
  return (
    <group>
      <Particles count={quality === 'high' ? 220 : 110} reducedMotion={reducedMotion} />
    </group>
  );
}
