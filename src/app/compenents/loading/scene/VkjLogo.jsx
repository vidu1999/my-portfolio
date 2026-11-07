'use client';

import { useMemo } from 'react';
import * as THREE from 'three';
import { PALETTE } from '../palette';

/**
 * The VKJ logotype built as real extruded 3D geometry (not a texture / flat plane).
 * Letterforms are hand-authored angular polygons to match the reference's
 * futuristic cut, then bevel-extruded so the chrome catches real specular light.
 */

// Each letter is authored in a 0..1 tall coordinate space.
const V_POINTS = [
  [0.0, 1.0], [0.29, 1.0], [0.46, 0.30], [0.63, 1.0], [0.92, 1.0],
  [0.61, 0.0], [0.31, 0.0],
];

const K_POINTS = [
  [0.0, 0.0], [0.25, 0.0], [0.25, 0.37], [0.61, 0.0], [0.93, 0.0],
  [0.46, 0.52], [0.91, 1.0], [0.59, 1.0], [0.25, 0.61], [0.25, 1.0], [0.0, 1.0],
];

const J_POINTS = [
  [0.30, 1.0], [0.74, 1.0], [0.74, 0.30], [0.70, 0.14], [0.56, 0.03],
  [0.36, 0.0], [0.17, 0.06], [0.05, 0.19], [0.0, 0.35], [0.26, 0.39],
  [0.30, 0.28], [0.39, 0.24], [0.46, 0.29], [0.48, 0.40], [0.48, 1.0],
];

function shapeFrom(points, offsetX) {
  const shape = new THREE.Shape();
  points.forEach(([x, y], i) => {
    const px = x + offsetX;
    if (i === 0) shape.moveTo(px, y);
    else shape.lineTo(px, y);
  });
  shape.closePath();
  return shape;
}

const LETTERS = [
  { key: 'V', points: V_POINTS, offset: 0.0, accent: false },
  { key: 'K', points: K_POINTS, offset: 0.80, accent: true },
  { key: 'J', points: J_POINTS, offset: 1.62, accent: false },
];

const TOTAL_WIDTH = 2.36;

export default function VkjLogo({ scale = 1, ...props }) {
  const geometries = useMemo(() => {
    const settings = {
      depth: 0.22,
      bevelEnabled: true,
      bevelThickness: 0.030,
      bevelSize: 0.026,
      bevelOffset: 0,
      bevelSegments: 3,
      curveSegments: 2,
    };
    return LETTERS.map(({ key, points, offset, accent }) => {
      const geo = new THREE.ExtrudeGeometry(shapeFrom(points, offset), settings);
      // Centre the whole word on the origin, and centre depth on z = 0.
      geo.translate(-TOTAL_WIDTH / 2, -0.5, -settings.depth / 2);
      geo.computeVertexNormals();
      return { key, geo, accent };
    });
  }, []);

  return (
    <group scale={scale} {...props}>
      {geometries.map(({ key, geo, accent }) => (
        <mesh key={key} geometry={geo} castShadow={false} receiveShadow={false}>
          {accent ? (
            <meshStandardMaterial
              color={PALETTE.logoAccent}
              emissive={PALETTE.logoEmissive}
              emissiveIntensity={0.32}
              metalness={0.45}
              roughness={0.26}
              envMapIntensity={1.1}
              toneMapped={false}
            />
          ) : (
            <meshStandardMaterial
              color="#ffffff"
              metalness={1}
              roughness={0.055}
              envMapIntensity={5.0}
            />
          )}
        </mesh>
      ))}
    </group>
  );
}
