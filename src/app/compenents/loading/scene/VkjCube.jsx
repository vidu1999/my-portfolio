'use client';

import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import VkjLogo from './VkjLogo';

/**
 * The glass centerpiece.
 *
 * Deliberately does NOT use `transmission`: that allocates a full-resolution
 * offscreen buffer and re-renders the scene every frame. A clear double-sided
 * physical material with strong environment reflections plus real emissive
 * edge tubes reads the same on screen at a fraction of the memory and cost.
 */

const EDGE_VERT = /* glsl */ `
  attribute float aProgress;
  varying float vProgress;
  void main() {
    vProgress = aProgress;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const EDGE_FRAG = /* glsl */ `
  uniform float uTime;
  uniform vec3  uColor;
  varying float vProgress;
  void main() {
    float a = fract(vProgress - uTime * 0.16);
    float b = fract(vProgress + uTime * 0.11 + 0.5);
    float bead = exp(-pow(a * 9.0, 2.0)) + exp(-pow(b * 12.0, 2.0)) * 0.7;
    float glow = 0.55 + bead * 2.2;
    gl_FragColor = vec4(uColor * glow, min(1.0, glow));
  }
`;

/** Cube corners + the 12 edge pairs, reused for lines and glow tubes. */
function edgeData(size) {
  const h = size / 2;
  const corners = [
    [-h, -h, -h], [h, -h, -h], [h, -h, h], [-h, -h, h],
    [-h, h, -h], [h, h, -h], [h, h, h], [-h, h, h],
  ].map((c) => new THREE.Vector3(...c));
  const pairs = [
    [0, 1], [1, 2], [2, 3], [3, 0],
    [4, 5], [5, 6], [6, 7], [7, 4],
    [0, 4], [1, 5], [2, 6], [3, 7],
  ];
  return { corners, pairs };
}

function buildEdgeLines(size) {
  const { corners, pairs } = edgeData(size);
  const positions = [];
  const progress = [];
  pairs.forEach(([a, b], i) => {
    positions.push(...corners[a].toArray(), ...corners[b].toArray());
    progress.push(i / pairs.length, (i + 1) / pairs.length);
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('aProgress', new THREE.Float32BufferAttribute(progress, 1));
  return geo;
}

/** Soft green tubes along every edge — gives the neon bloom the reference has. */
function EdgeGlow({ size }) {
  const core = useRef(null);
  const halo = useRef(null);
  const { corners, pairs } = useMemo(() => edgeData(size), [size]);

  const transforms = useMemo(() => {
    const up = new THREE.Vector3(0, 1, 0);
    return pairs.map(([a, b]) => {
      const from = corners[a];
      const to = corners[b];
      const mid = from.clone().add(to).multiplyScalar(0.5);
      const dir = to.clone().sub(from);
      const len = dir.length();
      const quat = new THREE.Quaternion().setFromUnitVectors(up, dir.clone().normalize());
      return { mid, quat, len };
    });
  }, [corners, pairs]);

  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    const scale = new THREE.Vector3();
    transforms.forEach((t, i) => {
      scale.set(1, t.len, 1);
      m.compose(t.mid, t.quat, scale);
      if (core.current) core.current.setMatrixAt(i, m);
      if (halo.current) halo.current.setMatrixAt(i, m);
    });
    if (core.current) core.current.instanceMatrix.needsUpdate = true;
    if (halo.current) halo.current.instanceMatrix.needsUpdate = true;
  }, [transforms]);

  const r = size * 0.0075;
  return (
    <>
      <instancedMesh ref={core} args={[undefined, undefined, 12]} renderOrder={5}>
        <cylinderGeometry args={[r, r, 1, 6, 1, true]} />
        <meshBasicMaterial color="#63ff96" transparent opacity={0.95} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={halo} args={[undefined, undefined, 12]} renderOrder={4}>
        <cylinderGeometry args={[r * 4.2, r * 4.2, 1, 6, 1, true]} />
        <meshBasicMaterial color="#22ff5e" transparent opacity={0.24} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </instancedMesh>
    </>
  );
}

export default function VkjCube({ size = 2.5, reducedMotion = false, ...props }) {
  const outer = useRef(null);
  const logo = useRef(null);
  const edgeMat = useRef(null);
  const innerCage = useRef(null);

  const edgeGeo = useMemo(() => buildEdgeLines(size), [size]);
  const cageGeo = useMemo(() => new THREE.BoxGeometry(size * 0.66, size * 0.66, size * 0.66), [size]);
  const octaGeo = useMemo(() => new THREE.OctahedronGeometry(size * 0.5, 0), [size]);
  const facetGeo = useMemo(() => new THREE.IcosahedronGeometry(size * 0.44, 0), [size]);
  const edgeUniforms = useMemo(
    () => ({ uTime: { value: 0 }, uColor: { value: new THREE.Color('#22ff5e') } }),
    []
  );

  // Start at the reference's three-quarter (near-isometric) angle so the very
  // first frame already reads as the hexagonal glass silhouette.
  useLayoutEffect(() => {
    if (outer.current) {
      outer.current.rotation.set(0.615, Math.PI / 4, 0);
    }
  }, []);

  useFrame((state, rawDelta) => {
    const delta = Math.min(rawDelta, 1 / 20);
    const t = state.clock.elapsedTime;
    if (edgeMat.current) edgeMat.current.uniforms.uTime.value = t;
    if (reducedMotion) return;

    if (outer.current) {
      outer.current.rotation.y += delta * 0.12;
      outer.current.rotation.x = 0.615 + Math.sin(t * 0.24) * 0.045;
      outer.current.position.y = Math.sin(t * 0.55) * 0.07;
    }
    if (logo.current) {
      logo.current.rotation.y = Math.sin(t * 0.32) * 0.10;
      logo.current.rotation.x = Math.sin(t * 0.26) * 0.04;
      logo.current.position.y = Math.sin(t * 0.55) * 0.07;
    }
    if (innerCage.current) {
      innerCage.current.rotation.y -= delta * 0.09;
      innerCage.current.rotation.z += delta * 0.05;
    }
  });

  return (
    <group {...props}>
      <group ref={outer}>
        {/* Clear glass shell. Low opacity + high env intensity = readable
            internals with bright reflective facets, like the reference. */}
        <mesh renderOrder={2}>
          <boxGeometry args={[size, size, size]} />
          <meshPhysicalMaterial
            color="#a9f5c6"
            transparent
            opacity={0.13}
            roughness={0.035}
            metalness={0}
            envMapIntensity={3.0}
            clearcoat={1}
            clearcoatRoughness={0.03}
            ior={1.5}
            reflectivity={0.6}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>

        <EdgeGlow size={size} />

        <lineSegments geometry={edgeGeo} renderOrder={6}>
          <shaderMaterial
            ref={edgeMat}
            uniforms={edgeUniforms}
            vertexShader={EDGE_VERT}
            fragmentShader={EDGE_FRAG}
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            toneMapped={false}
          />
        </lineSegments>

        {/* Internal geometric wireframe. */}
        <group ref={innerCage}>
          <lineSegments renderOrder={1}>
            <edgesGeometry args={[cageGeo]} />
            <lineBasicMaterial color="#2bff62" transparent opacity={0.42} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
          </lineSegments>
          <lineSegments rotation={[Math.PI / 4, Math.PI / 4, 0]} renderOrder={1}>
            <edgesGeometry args={[octaGeo]} />
            <lineBasicMaterial color="#22ff5e" transparent opacity={0.30} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
          </lineSegments>
          <lineSegments rotation={[0, Math.PI / 4, Math.PI / 5]} renderOrder={1}>
            <edgesGeometry args={[facetGeo]} />
            <lineBasicMaterial color="#39ff72" transparent opacity={0.16} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
          </lineSegments>
        </group>
      </group>

      {/* Wordmark is NOT parented to the tumbling shell so it stays upright. */}
      <group ref={logo} renderOrder={7}>
        <VkjLogo scale={size * 0.47} />
      </group>
    </group>
  );
}
