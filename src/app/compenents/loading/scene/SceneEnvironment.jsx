'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * Environment: reflective neon grid floor, distant mountain silhouettes,
 * drifting energy particles (single instanced draw call), and floating glass
 * cubes. Everything is procedural — no textures are downloaded.
 */

/* ---------------- grid floor ---------------- */

const FLOOR_VERT = /* glsl */ `
  varying vec2 vWorld;
  varying float vDist;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xz;
    vec4 mv = viewMatrix * world;
    vDist = -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;

const FLOOR_FRAG = /* glsl */ `
  uniform float uTime;
  uniform vec3  uColor;
  varying vec2 vWorld;
  varying float vDist;

  float gridLine(vec2 p, float spacing, float width) {
    vec2 g = abs(fract(p / spacing - 0.5) - 0.5) / fwidth(p / spacing);
    float l = min(g.x, g.y);
    return 1.0 - min(l / width, 1.0);
  }

  void main() {
    float fine  = gridLine(vWorld, 1.6, 1.1) * 0.34;
    float major = gridLine(vWorld, 8.0, 1.3) * 0.52;
    float grid = fine + major;

    // Distance fade so the grid dissolves into fog at the horizon.
    float fade = 1.0 - smoothstep(10.0, 62.0, vDist);
    // Radial pool of light beneath the platform.
    float d = length(vWorld);
    float pool = exp(-d * 0.15) * 0.34;
    // Slow scan sweep travelling outward.
    float sweep = exp(-pow((d - mod(uTime * 3.0, 55.0)) * 0.34, 2.0)) * 0.22;

    float i = (grid * (0.62 + pool) + pool * 0.20 + sweep * grid) * fade;
    gl_FragColor = vec4(uColor * i, clamp(i, 0.0, 1.0));
  }
`;

function GridFloor({ reducedMotion }) {
  const mat = useRef(null);
  const uniforms = useMemo(
    () => ({ uTime: { value: 0 }, uColor: { value: new THREE.Color('#1cc8ff') } }),
    []
  );
  useFrame((state) => {
    if (mat.current && !reducedMotion) mat.current.uniforms.uTime.value = state.clock.elapsedTime;
  });
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
      <planeGeometry args={[160, 160]} />
      <shaderMaterial
        ref={mat}
        uniforms={uniforms}
        vertexShader={FLOOR_VERT}
        fragmentShader={FLOOR_FRAG}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </mesh>
  );
}

/* ---------------- mountain silhouettes ---------------- */

/** Deterministic ridge line so SSR and client build identical geometry. */
function ridgeGeometry(seed, width, height, segments) {
  let s = seed;
  const rand = () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
  const shape = new THREE.Shape();
  shape.moveTo(-width / 2, -60);
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const x = -width / 2 + t * width;
    // Layered peaks: broad envelope + jagged detail.
    const envelope = Math.sin(t * Math.PI) ** 0.65;
    const peaks = Math.abs(Math.sin(t * 17.0 + seed)) * 0.42
      + Math.abs(Math.sin(t * 31.0 + seed * 2)) * 0.24
      + rand() * 0.34;
    shape.lineTo(x, envelope * height * (0.45 + peaks * 0.55));
  }
  shape.lineTo(width / 2, -60);
  shape.closePath();
  return new THREE.ShapeGeometry(shape, segments);
}

function Mountains() {
  const ridges = useMemo(
    () => [
      { geo: ridgeGeometry(7, 40, 10.5, 72), pos: [-21, 0, -24], color: '#050a18', op: 1 },
      { geo: ridgeGeometry(23, 40, 9.6, 72), pos: [22, 0, -23], color: '#050a18', op: 1 },
      { geo: ridgeGeometry(51, 64, 5.4, 50), pos: [-4, 0, -42], color: '#04081a', op: 1 },
      { geo: ridgeGeometry(97, 26, 5.2, 44), pos: [-23, 0, -11], color: '#02050f', op: 1 },
      { geo: ridgeGeometry(131, 26, 4.8, 44), pos: [24, 0, -11], color: '#02050f', op: 1 },
    ],
    []
  );
  return (
    <group>
      {ridges.map((r, i) => (
        <mesh key={i} geometry={r.geo} position={r.pos}>
          {/* Near-black rock with a cyan rim rising from the valley floor. */}
          <shaderMaterial
            transparent
            side={THREE.DoubleSide}
            uniforms={{ uBase: { value: new THREE.Color(r.color) } }}
            vertexShader={`
              varying float vY;
              void main(){
                vY = position.y;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
              }
            `}
            fragmentShader={`
              uniform vec3 uBase;
              varying float vY;
              void main(){
                // Narrow band hugging the valley floor; pure black below it so
                // the skirt that hides the silhouette's bottom edge stays invisible.
                float rim = smoothstep(2.4, 0.15, vY) * smoothstep(-0.5, 0.45, vY);
                vec3 c = uBase + vec3(0.10, 0.32, 0.52) * rim * 0.62;
                gl_FragColor = vec4(c, 1.0);
              }
            `}
          />
        </mesh>
      ))}
    </group>
  );
}

/* ---------------- particles (one instanced draw call) ---------------- */

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
    () => ({ uTime: { value: 0 }, uColor: { value: new THREE.Color('#6bd8ff') } }),
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
              color="#a8d8f0"
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
            <lineBasicMaterial color="#76e6ff" transparent opacity={0.95} toneMapped={false} />
          </lineSegments>
        </group>
      ))}
    </group>
  );
}


/* ---------------- volumetric light shafts ---------------- */

const SHAFTS = [
  { x: -13.5, z: -18, w: 1.5, h: 20, o: 0.34 },
  { x: -7.5, z: -22, w: 0.9, h: 22, o: 0.24 },
  { x: 9.0, z: -20, w: 1.4, h: 21, o: 0.32 },
  { x: 15.5, z: -17, w: 1.0, h: 19, o: 0.26 },
  { x: 2.0, z: -30, w: 1.2, h: 24, o: 0.18 },
];

function LightShafts({ reducedMotion }) {
  const group = useRef(null);
  useFrame((state) => {
    if (reducedMotion || !group.current) return;
    const t = state.clock.elapsedTime;
    group.current.children.forEach((child, i) => {
      child.material.opacity = SHAFTS[i].o * (0.65 + 0.35 * Math.sin(t * 0.5 + i * 1.3));
    });
  });
  return (
    <group ref={group}>
      {SHAFTS.map((s, i) => (
        <mesh key={i} position={[s.x, s.h / 2 - 1, s.z]}>
          <planeGeometry args={[s.w, s.h]} />
          <shaderMaterial
            transparent
            opacity={s.o}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            toneMapped={false}
            vertexShader={`varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`}
            fragmentShader={`
              varying vec2 vUv;
              void main(){
                float x = 1.0 - abs(vUv.x - 0.5) * 2.0;
                float y = smoothstep(0.0, 0.35, vUv.y) * smoothstep(1.0, 0.55, vUv.y);
                float a = pow(max(x, 0.0), 2.6) * y;
                gl_FragColor = vec4(vec3(0.46, 0.90, 1.0) * a, a * 0.30);
              }
            `}
          />
        </mesh>
      ))}
    </group>
  );
}

export default function SceneEnvironment({ reducedMotion = false, quality = 'high' }) {
  return (
    <group>
      <GridFloor reducedMotion={reducedMotion} />
      <LightShafts reducedMotion={reducedMotion} />
      <Mountains />
      <Particles count={quality === 'high' ? 220 : 110} reducedMotion={reducedMotion} />
      <FloatingCubes reducedMotion={reducedMotion} />
    </group>
  );
}
