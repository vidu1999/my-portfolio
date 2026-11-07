'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { PALETTE } from '../palette';

/**
 * Futuristic launch platform: stacked metallic black discs, concentric neon
 * edge strips, and an energy pulse that expands outward across the surface.
 */

const PULSE_FRAG = /* glsl */ `
  uniform float uTime;
  uniform vec3  uColor;
  varying vec2 vUv;
  void main() {
    // Map the disc UV into radial distance from the centre.
    float d = length(vUv - 0.5) * 2.0;
    if (d > 1.0) discard;

    // Two expanding rings, offset in phase.
    float w = 0.0;
    for (int i = 0; i < 2; i++) {
      float phase = fract(uTime * 0.28 + float(i) * 0.5);
      float ring = exp(-pow((d - phase) * 13.0, 2.0));
      w += ring * (1.0 - phase) * 0.85;
    }
    // Static concentric guide rings.
    float guides = smoothstep(0.90, 1.0, abs(sin(d * 15.0))) * 0.20;
    float rim = smoothstep(0.86, 1.0, d) * 0.32;
    float i = w + guides + rim;
    float fade = 1.0 - smoothstep(0.75, 1.0, d);
    gl_FragColor = vec4(uColor * i, clamp(i, 0.0, 1.0) * (0.35 + fade * 0.65));
  }
`;

const PULSE_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export default function Platform({ radius = 3.1, reducedMotion = false, ...props }) {
  const pulse = useRef(null);
  const uniforms = useMemo(
    () => ({ uTime: { value: 0 }, uColor: { value: new THREE.Color(PALETTE.accent) } }),
    []
  );

  useFrame((state) => {
    if (pulse.current && !reducedMotion) {
      pulse.current.uniforms.uTime.value = state.clock.elapsedTime;
    }
  });

  const tiers = useMemo(
    () => [
      { r: radius, h: 0.10, y: -0.05 },
      { r: radius * 0.86, h: 0.09, y: 0.04 },
      { r: radius * 0.70, h: 0.08, y: 0.12 },
    ],
    [radius]
  );

  return (
    <group {...props}>
      {/* Metallic black tiered base */}
      {tiers.map((t, i) => (
        <mesh key={i} position={[0, t.y, 0]} receiveShadow>
          <cylinderGeometry args={[t.r, t.r * 1.02, t.h, 72]} />
          <meshStandardMaterial color={PALETTE.metal} metalness={0.78} roughness={0.44} envMapIntensity={0.5} />
        </mesh>
      ))}

      {/* Neon glowing edge strips on each tier */}
      {tiers.map((t, i) => (
        <mesh key={`strip-${i}`} position={[0, t.y + t.h / 2 + 0.004, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[t.r * 0.945, t.r, 96]} />
          <meshBasicMaterial
            color={PALETTE.glow}
            transparent
            opacity={0.62 - i * 0.10}
            side={THREE.DoubleSide}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      ))}

      {/* Animated energy pulse across the top surface */}
      <mesh position={[0, 0.168, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[radius * 0.70, 96]} />
        <shaderMaterial
          ref={pulse}
          uniforms={uniforms}
          vertexShader={PULSE_VERT}
          fragmentShader={PULSE_FRAG}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>

      {/* Bright contact ring where the cube's energy meets the platform */}
      <mesh position={[0, 0.19, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[radius * 0.285, radius * 0.365, 80]} />
        <meshBasicMaterial
          color={PALETTE.accent}
          transparent
          opacity={1}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}
