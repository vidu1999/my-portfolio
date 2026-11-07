'use client';

import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { usePageVisible } from '@/app/lib/usePageVisible';
import { getPointer, subscribePointer } from '@/app/lib/pointerTracker';
import { damp, greetEnvelope, resolvePreset } from './motionPresets';

/**
 * ModelRig — additive, non-destructive animation rig.
 *
 * WHY THIS APPROACH
 * The portfolio's character/robot assets are single-mesh glTF exports with no
 * armature. Re-rigging them offline would mean re-exporting the .glb, which
 * risks recompressing textures and decimating geometry. Instead this rig:
 *
 *   1. Animates a wrapper group (idle bob / sway / drift / pointer attention).
 *   2. Injects a "virtual spine" into a CLONE of the material's vertex shader,
 *      giving breathing, torso twist and lean without editing a single vertex
 *      in the source buffer.
 *
 * GUARANTEES
 *   - Original geometry, UVs, normals, textures and .glb files are untouched.
 *   - Materials are cloned, so shared/cached glTF materials are never mutated.
 *   - Original materials are restored and clones disposed on unmount.
 *   - Pauses when the tab is hidden and honours prefers-reduced-motion.
 */

const AXIS_MASKS = [
  new THREE.Vector3(1, 0, 0),
  new THREE.Vector3(0, 1, 0),
  new THREE.Vector3(0, 0, 1),
];

const SHADER_HELPERS = /* glsl */ `
uniform vec3  uRigAxis;
uniform vec3  uRigSideA;
uniform vec3  uRigSideB;
uniform vec3  uRigCenter;
uniform float uRigMinH;
uniform float uRigHeight;
uniform float uRigFalloff;
uniform float uRigTwistScale;
uniform float uRigBreathe;
uniform float uRigTwist;
uniform float uRigBendA;
uniform float uRigBendB;

vec3 rigRotateAxis(vec3 p, vec3 axis, float angle) {
  float c = cos(angle);
  float s = sin(angle);
  return p * c + cross(axis, p) * s + axis * dot(axis, p) * (1.0 - c);
}

float rigHeight01(vec3 p) {
  return clamp((dot(p, uRigAxis) - uRigMinH) / max(uRigHeight, 0.0001), 0.0, 1.0);
}

// Zero at the base, so feet/base stay exactly planted and nothing slides.
float rigGate(vec3 p) {
  return smoothstep(0.0, 0.18, rigHeight01(p));
}

float rigWeight(vec3 p) {
  return pow(rigHeight01(p), uRigFalloff) * rigGate(p);
}
`;

const NORMAL_DEFORM = /* glsl */ `
  objectNormal = rigRotateAxis(objectNormal, uRigAxis, uRigTwist * uRigTwistScale * rigWeight(position));
`;

const VERTEX_DEFORM = /* glsl */ `
  float rigH = rigHeight01(transformed);
  float rigW = rigWeight(transformed);

  // Breathing: expand the chest band radially, gated to zero at the base.
  float rigChest = exp(-pow((rigH - 0.6) * 3.2, 2.0)) * rigGate(transformed);
  vec3 rigAxisPart = uRigAxis * dot(transformed, uRigAxis);
  vec3 rigRadial = transformed - rigAxisPart;
  rigRadial *= 1.0 + uRigBreathe * rigChest;
  transformed = rigAxisPart + rigRadial;

  // Spine twist around the model's own up-axis, centred so it spins in place.
  transformed = rigRotateAxis(transformed - uRigCenter, uRigAxis, uRigTwist * uRigTwistScale * rigW) + uRigCenter;

  // Lean: height-weighted shear. Scaled by height (not absolute units) so a
  // short/wide robot leans proportionally as little as a tall character.
  transformed += (uRigSideA * uRigBendA + uRigSideB * uRigBendB) * (rigW * uRigHeight);
`;

function createUniforms() {
  return {
    uRigAxis: { value: new THREE.Vector3(0, 1, 0) },
    uRigSideA: { value: new THREE.Vector3(1, 0, 0) },
    uRigSideB: { value: new THREE.Vector3(0, 0, 1) },
    uRigCenter: { value: new THREE.Vector3() },
    uRigMinH: { value: 0 },
    uRigHeight: { value: 1 },
    uRigFalloff: { value: 1.6 },
    uRigTwistScale: { value: 1 },
    uRigBreathe: { value: 0 },
    uRigTwist: { value: 0 },
    uRigBendA: { value: 0 },
    uRigBendB: { value: 0 },
  };
}

/**
 * Aim the virtual spine along the mesh's longest LOCAL axis.
 * Local space matters: the shader deforms `position` before any parent
 * scale/rotation, so world-space measurements would aim the spine wrongly.
 */
function measureGeometry(geometry, uniforms) {
  if (!geometry.boundingBox) geometry.computeBoundingBox();
  const box = geometry.boundingBox;
  if (!box || box.isEmpty()) return;

  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());

  let axisIndex = 1;
  if (size.x >= size.y && size.x >= size.z) axisIndex = 0;
  else if (size.z >= size.x && size.z >= size.y) axisIndex = 2;

  const axis = AXIS_MASKS[axisIndex];
  uniforms.uRigAxis.value.copy(axis);
  uniforms.uRigSideA.value.copy(AXIS_MASKS[(axisIndex + 1) % 3]);
  uniforms.uRigSideB.value.copy(AXIS_MASKS[(axisIndex + 2) % 3]);
  uniforms.uRigHeight.value = Math.max(size.getComponent(axisIndex), 0.0001);
  uniforms.uRigMinH.value = box.min.getComponent(axisIndex);

  // Centre of the radial plane, so twist spins in place instead of orbiting.
  uniforms.uRigCenter.value.copy(center).addScaledVector(axis, -center.dot(axis));

  // Normalize twist by aspect ratio: arc length = angle * radius, so a wide,
  // short model needs a smaller angle to travel the same fraction of its size.
  const halfA = size.getComponent((axisIndex + 1) % 3) * 0.5;
  const halfB = size.getComponent((axisIndex + 2) % 3) * 0.5;
  const maxRadius = Math.hypot(halfA, halfB);
  const height = uniforms.uRigHeight.value;
  uniforms.uRigTwistScale.value = THREE.MathUtils.clamp(
    height / Math.max(2 * maxRadius, 0.0001), 0.2, 1
  );
}

function patchMaterial(material, uniforms) {
  const clone = material.clone();
  const previousCompile = material.onBeforeCompile;

  clone.onBeforeCompile = (shader, renderer) => {
    if (previousCompile) previousCompile.call(material, shader, renderer);

    Object.assign(shader.uniforms, uniforms);

    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${SHADER_HELPERS}`)
      .replace(
        '#include <beginnormal_vertex>',
        `#include <beginnormal_vertex>\n${NORMAL_DEFORM}`
      )
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n${VERTEX_DEFORM}`);
  };

  // Distinct cache key so rigged and unrigged variants never share a program.
  clone.customProgramCacheKey = () => 'model-rig-v1';
  clone.needsUpdate = true;
  return clone;
}

export default function ModelRig({
  children,
  preset = 'character',
  overrides,
  deform = true,
  interactive = true,
  greet = true,
  phase = 0,
  intensity = 1,
}) {
  const group = useRef(null);
  const pageVisible = usePageVisible();
  const config = useMemo(() => resolvePreset(preset, overrides), [preset, overrides]);

  const state = useRef({
    elapsed: phase,
    yaw: 0,
    pitch: 0,
    reducedMotion: false,
    targets: [],
    // Pivot in the wrapper's own space, so rotations turn the model in place
    // instead of swinging it around the wrapper origin (Robot is offset -2 Y).
    pivot: new THREE.Vector3(),
    scratch: new THREE.Vector3(),
  });

  // Clone + patch materials once the meshes exist; restore them on unmount.
  useLayoutEffect(() => {
    const root = group.current;
    if (!root) return;

    const store = state.current;
    store.reducedMotion =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Measure the children's combined bounds in the WRAPPER's local space so
    // rotation pivots about the model's centre of mass, not the wrapper origin.
    root.updateWorldMatrix(true, true);
    const bounds = new THREE.Box3();
    const meshBox = new THREE.Box3();
    root.traverse((child) => {
      if (!child.isMesh || !child.geometry) return;
      if (!child.geometry.boundingBox) child.geometry.computeBoundingBox();
      if (!child.geometry.boundingBox) return;
      meshBox.copy(child.geometry.boundingBox).applyMatrix4(child.matrixWorld);
      bounds.union(meshBox);
    });
    if (!bounds.isEmpty()) {
      bounds.getCenter(store.pivot);
      root.worldToLocal(store.pivot);
    }

    if (deform) {
      root.traverse((child) => {
        if (!child.isMesh || !child.geometry || !child.material) return;

        // Each mesh needs its own uniforms measured in its own local space.
        const uniforms = createUniforms();
        measureGeometry(child.geometry, uniforms);

        const original = child.material;
        const rigged = Array.isArray(original)
          ? original.map((m) => patchMaterial(m, uniforms))
          : patchMaterial(original, uniforms);

        child.material = rigged;
        store.targets.push({ mesh: child, original, rigged, uniforms });
      });
    }

    const unsubscribe = interactive ? subscribePointer() : () => {};

    return () => {
      unsubscribe();
      store.targets.forEach(({ mesh, original, rigged }) => {
        mesh.material = original;
        (Array.isArray(rigged) ? rigged : [rigged]).forEach((m) => m.dispose());
      });
      store.targets = [];
    };
  }, [deform, interactive]);

  useFrame((_, rawDelta) => {
    const root = group.current;
    if (!root) return;

    const store = state.current;
    if (!pageVisible || store.reducedMotion) return;

    // Clamp delta so returning to the tab never snaps the pose.
    const delta = Math.min(rawDelta, 1 / 20);
    store.elapsed += delta;
    const t = store.elapsed;
    const k = intensity;

    // --- Idle motion -------------------------------------------------
    const bob = Math.sin(t * config.bobSpeed) * config.bobAmp * k;
    const drift = Math.sin(t * config.driftSpeed + 1.7) * config.driftAmp * k;
    const sway = Math.sin(t * config.swaySpeed) * config.swayAmp * k;

    // --- Pointer attention -------------------------------------------
    const pointer = interactive ? getPointer() : { x: 0, y: 0 };
    store.yaw = damp(store.yaw, pointer.x * config.lookYaw * k, config.lookDamping, delta);
    store.pitch = damp(store.pitch, -pointer.y * config.lookPitch * k, config.lookDamping, delta);

    // --- Periodic greeting -------------------------------------------
    let envelope = 0;
    if (greet && config.greetEvery > 0) {
      envelope = greetEnvelope((t % config.greetEvery) / config.greetDuration);
    }
    const greetWave = Math.sin(t * 7.5) * envelope;

    root.rotation.set(
      store.pitch + envelope * config.greetNod * k,
      store.yaw + greetWave * config.greetTwist * 0.35 * k,
      sway
    );

    // Pivot-corrected translation: p' = pivot - R*pivot + offset.
    // Keeps the model rotating about its own centre instead of orbiting the
    // wrapper origin, so nothing drifts out of its panel.
    store.scratch.copy(store.pivot).applyEuler(root.rotation);
    root.position.set(
      store.pivot.x - store.scratch.x + drift,
      store.pivot.y - store.scratch.y + bob + envelope * config.greetLift * k,
      store.pivot.z - store.scratch.z
    );

    // --- Virtual spine (shader) --------------------------------------
    if (!deform || store.targets.length === 0) return;

    const breathe = Math.sin(t * config.breatheSpeed) * config.breatheAmp * k;
    const twist =
      (Math.sin(t * config.swaySpeed * 0.8) * config.twistAmp * 0.35 +
        store.yaw * 0.5 +
        greetWave * config.greetTwist) *
      k;
    const bendA =
      (store.yaw * config.bendAmp * 0.6 + Math.sin(t * 0.47) * config.bendAmp * 0.3) * k;
    const bendB = (-store.pitch * config.bendAmp + envelope * config.bendAmp * 0.8) * k;

    for (let i = 0; i < store.targets.length; i += 1) {
      const { uniforms } = store.targets[i];
      uniforms.uRigBreathe.value = breathe;
      uniforms.uRigTwist.value = twist;
      uniforms.uRigBendA.value = bendA;
      uniforms.uRigBendB.value = bendB;
      uniforms.uRigFalloff.value = config.spineStiffness;
    }
  });

  return (
    <group ref={group} dispose={null}>
      {children}
    </group>
  );
}
