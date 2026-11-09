'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { PALETTE } from '../palette';

/**
 * VKJ heraldic shield.
 *
 * A flat-topped, pointed-bottom badge extruded from a 2D outline, in green
 * glass, with the chrome VKJ wordmark raised off its face. Replaces the removed
 * glass cube: same slot in the scene, same camera fit, no downloads.
 *
 * Everything is generated on the CPU from paths — no font files, no GLB, no
 * external assets. The letters are drawn as polygon outlines rather than text
 * so the wordmark keeps the reference's angular, cut-metal look and never
 * depends on a webfont being available.
 */

/* ---------------- shield outline ---------------- */

// Normalised heraldic shield: flat top with clipped corners, straight upper
// sides, then shoulders curving into a point. Traced clockwise from top-left.
function shieldShape(w = 1, h = 1) {
  const s = new THREE.Shape();
  const hw = w / 2;
  const top = h * 0.50;
  const bot = -h * 0.50;
  const clip = w * 0.10;      // corner chamfer
  const shoulder = h * 0.10;  // where the curve toward the point begins

  s.moveTo(-hw + clip, top);
  s.lineTo(hw - clip, top);
  s.lineTo(hw, top - clip * 0.85);
  s.lineTo(hw, shoulder);
  // Right flank sweeping down to the tip.
  s.bezierCurveTo(hw, -h * 0.16, hw * 0.72, bot + h * 0.16, 0, bot);
  // Left flank mirroring back up.
  s.bezierCurveTo(-hw * 0.72, bot + h * 0.16, -hw, -h * 0.16, -hw, shoulder);
  s.lineTo(-hw, top - clip * 0.85);
  s.closePath();
  return s;
}

/* ---------------- VKJ letterforms ---------------- */

// Each letter is a closed polygon in a 1x1 box, y up. Angular joints keep the
// cut-chrome feel of the reference; the K's diagonal is a separate stroke so it
// can be tinted green like the artwork.

function letterV() {
  const s = new THREE.Shape();
  s.moveTo(0.00, 1.00);
  s.lineTo(0.30, 1.00);
  s.lineTo(0.50, 0.34);
  s.lineTo(0.70, 1.00);
  s.lineTo(1.00, 1.00);
  s.lineTo(0.66, 0.00);
  s.lineTo(0.34, 0.00);
  s.closePath();
  return s;
}

function letterKStem() {
  const s = new THREE.Shape();
  s.moveTo(0.00, 1.00);
  s.lineTo(0.28, 1.00);
  s.lineTo(0.28, 0.00);
  s.lineTo(0.00, 0.00);
  s.closePath();
  return s;
}

function letterKArm() {
  const s = new THREE.Shape();
  // Upper diagonal rising to the right.
  s.moveTo(0.30, 0.48);
  s.lineTo(0.74, 1.00);
  s.lineTo(1.00, 1.00);
  s.lineTo(0.52, 0.46);
  s.closePath();
  return s;
}

function letterKLeg() {
  const s = new THREE.Shape();
  // Lower diagonal descending to the right.
  s.moveTo(0.50, 0.52);
  s.lineTo(1.00, 0.00);
  s.lineTo(0.68, 0.00);
  s.lineTo(0.30, 0.40);
  s.closePath();
  return s;
}

function letterJ() {
  const s = new THREE.Shape();
  s.moveTo(0.42, 1.00);
  s.lineTo(1.00, 1.00);
  s.lineTo(1.00, 0.30);
  s.bezierCurveTo(1.00, 0.08, 0.78, 0.00, 0.52, 0.00);
  s.bezierCurveTo(0.24, 0.00, 0.02, 0.10, 0.00, 0.32);
  s.lineTo(0.28, 0.32);
  s.bezierCurveTo(0.30, 0.24, 0.40, 0.22, 0.52, 0.22);
  s.bezierCurveTo(0.64, 0.22, 0.72, 0.26, 0.72, 0.36);
  s.lineTo(0.72, 0.76);
  s.lineTo(0.42, 0.76);
  s.closePath();
  return s;
}

/* ---------------- component ---------------- */

const LETTER_DEPTH = 0.055;

export default function VkjShield({ reducedMotion = false, size = 2.5, ...props }) {
  const group = useRef(null);
  const rim = useRef(null);
  const sheen = useRef(null);

  const w = size;
  const h = size * 1.16;

  // Glass body: a thin extrusion so the badge has real depth and catches the
  // environment on its bevel, without the cost of a transmissive volume.
  const bodyGeo = useMemo(() => {
    const g = new THREE.ExtrudeGeometry(shieldShape(w, h), {
      depth: 0.16,
      bevelEnabled: true,
      bevelThickness: 0.035,
      bevelSize: 0.035,
      bevelSegments: 3,
      curveSegments: 24,
    });
    g.center();
    return g;
  }, [w, h]);

  // Neon rim: the same outline drawn as a closed tube of light.
  const rimGeo = useMemo(() => {
    const pts = shieldShape(w * 1.005, h * 1.005).getPoints(160);
    const curve = new THREE.CatmullRomCurve3(
      pts.map((p) => new THREE.Vector3(p.x, p.y, 0)),
      true,
      'catmullrom',
      0.02
    );
    return new THREE.TubeGeometry(curve, 260, 0.022, 6, true);
  }, [w, h]);

  // Inner outline, slightly inset, for the double-line HUD detail.
  const innerGeo = useMemo(() => {
    const pts = shieldShape(w * 0.86, h * 0.86).getPoints(140);
    const curve = new THREE.CatmullRomCurve3(
      pts.map((p) => new THREE.Vector3(p.x, p.y, 0)),
      true,
      'catmullrom',
      0.02
    );
    return new THREE.TubeGeometry(curve, 220, 0.010, 5, true);
  }, [w, h]);

  // Wordmark. Letters share one extrude config so the bevels match.
  const letters = useMemo(() => {
    const opt = {
      depth: LETTER_DEPTH,
      bevelEnabled: true,
      bevelThickness: 0.030,
      bevelSize: 0.028,
      bevelSegments: 3,
      curveSegments: 14,
    };
    const make = (shape) => new THREE.ExtrudeGeometry(shape, opt);
    return {
      v: make(letterV()),
      kStem: make(letterKStem()),
      kArm: make(letterKArm()),
      kLeg: make(letterKLeg()),
      j: make(letterJ()),
    };
  }, []);

  // Wordmark layout: three letters across the shield's upper-middle, where the
  // badge is widest. Sized as a fraction of the shield so it scales with it.
  const lw = w * 0.235;   // letter box width
  const lh = h * 0.250;   // letter box height
  const gap = w * 0.035;
  const totalW = lw * 3 + gap * 2;
  const x0 = -totalW / 2;
  const ly = h * 0.055;   // baseline offset, slightly above centre
  const faceZ = 0.10;     // sits proud of the glass face

  useFrame((state, rawDelta) => {
    const delta = Math.min(rawDelta, 1 / 20);
    const t = state.clock.elapsedTime;

    if (group.current && !reducedMotion) {
      // Slow oscillation rather than a full spin, so the wordmark stays legible
      // and never shows its blank reverse side.
      group.current.rotation.y = Math.sin(t * 0.32) * 0.30;
      group.current.rotation.x = Math.sin(t * 0.24) * 0.045;
      group.current.position.y = Math.sin(t * 0.55) * 0.055;
    }
    if (rim.current) {
      rim.current.opacity = reducedMotion ? 0.9 : 0.72 + Math.sin(t * 1.6) * 0.22;
    }
    if (sheen.current) {
      sheen.current.uniforms.uTime.value = reducedMotion ? 0.35 : t;
    }
  });

  const sheenUniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(PALETTE.accent) },
    }),
    []
  );

  // These geometries are handed to `geometry={...}` rather than declared as JSX
  // children, so R3F does not own them and will not dispose them on unmount.
  // The loader unmounts for real after the fade, so free them explicitly or the
  // GPU buffers leak for the rest of the session.
  useEffect(
    () => () => {
      bodyGeo.dispose();
      rimGeo.dispose();
      innerGeo.dispose();
      Object.values(letters).forEach((g) => g.dispose());
    },
    [bodyGeo, rimGeo, innerGeo, letters]
  );

  const chrome = {
    color: '#c9d4cd',
    metalness: 1,
    roughness: 0.18,
    envMapIntensity: 3.0,
    // Rings orbit through this depth; the wordmark is printed on the face and
    // must never be occluded by them.
    depthTest: false,
    transparent: true,
  };

  return (
    <group ref={group} {...props}>
      {/* Glass body */}
      <mesh geometry={bodyGeo}>
        <meshPhysicalMaterial
          color="#072010"
          transparent
          opacity={0.52}
          roughness={0.09}
          metalness={0.22}
          envMapIntensity={0.9}
          clearcoat={0.6}
          clearcoatRoughness={0.08}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      {/* Faceted wireframe over the glass, echoing the reference's inner edges */}
      <lineSegments>
        <edgesGeometry args={[bodyGeo, 22]} />
        <lineBasicMaterial
          color={PALETTE.accent}
          transparent
          opacity={0.55}
          toneMapped={false}
        />
      </lineSegments>

      {/* Outer neon rim */}
      <mesh geometry={rimGeo} position={[0, 0, 0.09]}>
        <meshBasicMaterial
          ref={rim}
          color={PALETTE.accent}
          transparent
          opacity={0.9}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      {/* Inset detail line */}
      <mesh geometry={innerGeo} position={[0, 0, 0.095]}>
        <meshBasicMaterial
          color={PALETTE.soft}
          transparent
          opacity={0.34}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      {/* Energy sheen sweeping down the face */}
      <mesh position={[0, 0, 0.085]}>
        <planeGeometry args={[w * 0.94, h * 0.94]} />
        <shaderMaterial
          ref={sheen}
          uniforms={sheenUniforms}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
          vertexShader={/* glsl */ `
            varying vec2 vUv;
            void main() {
              vUv = uv;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `}
          fragmentShader={/* glsl */ `
            uniform float uTime;
            uniform vec3  uColor;
            varying vec2 vUv;
            void main() {
              // Shield mask so the sheen never bleeds outside the badge.
              vec2 p = vUv * 2.0 - 1.0;
              float taper = mix(1.0, 0.0, smoothstep(-0.15, -1.0, p.y));
              float halfW = p.y < -0.15 ? taper * 0.92 : 0.92;
              if (abs(p.x) > halfW) discard;

              float sweep = fract(uTime * 0.22);
              float band = exp(-pow((vUv.y - (1.0 - sweep)) * 9.0, 2.0));
              float grid = smoothstep(0.94, 1.0, abs(sin(vUv.y * 46.0))) * 0.03;
              float i = band * 0.28 + grid;
              gl_FragColor = vec4(uColor * i, i * 0.75);
            }
          `}
        />
      </mesh>

      {/* Chrome wordmark */}
      <group position={[x0, ly - lh / 2, faceZ]} scale={[lw, lh, 1]}>
        <mesh geometry={letters.v} renderOrder={12}>
          <meshStandardMaterial {...chrome} />
        </mesh>
      </group>

      <group position={[x0 + lw + gap, ly - lh / 2, faceZ]} scale={[lw, lh, 1]}>
        <mesh geometry={letters.kStem} renderOrder={12}>
          <meshStandardMaterial {...chrome} />
        </mesh>
        {/* The K's diagonals carry the green accent, as in the reference. */}
        <mesh geometry={letters.kArm} renderOrder={12}>
          <meshStandardMaterial
            color={PALETTE.accent}
            metalness={0.85}
            roughness={0.20}
            envMapIntensity={2.0}
            emissive={PALETTE.deep}
            emissiveIntensity={0.5}
            depthTest={false}
            transparent
          />
        </mesh>
        <mesh geometry={letters.kLeg} renderOrder={12}>
          <meshStandardMaterial
            color={PALETTE.accent}
            metalness={0.85}
            roughness={0.20}
            envMapIntensity={2.0}
            emissive={PALETTE.deep}
            emissiveIntensity={0.5}
            depthTest={false}
            transparent
          />
        </mesh>
      </group>

      <group position={[x0 + (lw + gap) * 2, ly - lh / 2, faceZ]} scale={[lw, lh, 1]}>
        <mesh geometry={letters.j} renderOrder={12}>
          <meshStandardMaterial {...chrome} />
        </mesh>
      </group>
    </group>
  );
}
