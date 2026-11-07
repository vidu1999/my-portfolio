'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { PALETTE } from '../palette';

/**
 * Live scene dressing: drifting energy particles (a single instanced draw call)
 * and rotating floating glass cubes.
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

/* ---------------- floating glass cubes ---------------- */

const FLOATERS = [
  { pos: [-4.6, 4.5, -1.5], size: 0.36, speed: 0.34, seed: 0.0 },
  { pos: [4.9, 2.3, 0.4], size: 0.52, speed: -0.26, seed: 1.7 },
  { pos: [3.7, 0.6, 1.6], size: 0.24, speed: 0.42, seed: 3.1 },
  { pos: [-6.0, 1.2, 1.0], size: 0.20, speed: -0.38, seed: 4.4 },
  { pos: [-3.2, 2.0, 2.2], size: 0.15, speed: 0.5, seed: 5.6 },
];

function FloatingCubes({ reducedMotion }) {
  const group = useRef(null);
  const boxGeo = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  const edgeGeo = useMemo(() => new THREE.EdgesGeometry(boxGeo), [boxGeo]);

  useFrame((state, rawDelta) => {
    if (reducedMotion || !group.current) return;
    const delta = Math.min(rawDelta, 1 / 20);
    const t = state.clock.elapsedTime;
    group.current.children.forEach((child, i) => {
      const f = FLOATERS[i];
      if (!f) return;
      child.rotation.x += delta * f.speed;
      child.rotation.y += delta * f.speed * 0.72;
      child.position.y = f.pos[1] + Math.sin(t * 0.42 + f.seed) * 0.30;
      child.position.x = f.pos[0] + Math.cos(t * 0.28 + f.seed) * 0.18;
    });
  });

  return (
    <group ref={group}>
      {FLOATERS.map((f, i) => (
        <group key={i} position={f.pos} scale={f.size}>
          <mesh geometry={boxGeo}>
            <meshPhysicalMaterial
              color={PALETTE.glass}
              transparent
              opacity={0.16}
              roughness={0.04}
              metalness={0.1}
              envMapIntensity={2.4}
              clearcoat={1}
              side={THREE.DoubleSide}
              depthWrite={false}
            />
          </mesh>
          <lineSegments geometry={edgeGeo}>
            <lineBasicMaterial color={PALETTE.accent} transparent opacity={0.95} toneMapped={false} />
          </lineSegments>
        </group>
      ))}
    </group>
  );
}


/* ---------------- volumetric light shafts ---------------- */

export default function SceneEnvironment({ reducedMotion = false, quality = 'high' }) {
  return (
    <group>
      <Particles count={quality === 'high' ? 220 : 110} reducedMotion={reducedMotion} />
      <FloatingCubes reducedMotion={reducedMotion} />
    </group>
  );
}
