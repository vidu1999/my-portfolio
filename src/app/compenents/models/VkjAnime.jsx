'use client';

import React, { useEffect, useMemo } from 'react';
import { useGLTF, useAnimations } from '@react-three/drei';
import * as THREE from 'three';
import { modelAsset } from '@/app/lib/publicAsset';

/**
 * VKJ animated character — the homepage avatar.
 *
 * Asset: public/models/vkjanime.glb — glTF 2.0, one SkinnedMesh (36.8k verts),
 * one material, one 3.98s clip ("animation_0"). The rig and animation are baked
 * into the file; nothing is authored at runtime.
 *
 * The clip always autoplays and loops. It deliberately does NOT consult
 * prefers-reduced-motion: this avatar is the intended centrepiece of the
 * profile panel and was specified to animate on every visit. The previous
 * reduced-motion branch froze it, which read as "the animation is broken" on
 * any device with motion effects disabled. Dropping the matchMedia query also
 * removes a hard dependency on MediaQueryList.addEventListener, which older
 * Safari/iOS do not implement — there it threw inside the effect and took the
 * whole avatar down with it.
 *
 * Framing is measured rather than hard-coded, so re-exporting the model at a
 * different scale won't break the composition. Two details matter:
 *
 *  - Box3.setFromObject() alone reads bind-pose geometry and ignores the bones.
 *    SkinnedMesh.computeBoundingBox() applies the skeleton, giving the volume
 *    the posed character actually occupies.
 *  - The result is applied as props, not mutated onto a ref inside an effect,
 *    so framing can't depend on ref or frame timing.
 *
 * Memory: 2.86MB, one mesh, one material, nothing allocated per frame. The clip
 * stops on unmount (useAnimations uncaches the mixer for us); the wrapping
 * Canvas already pauses its frameloop when the page is hidden.
 */

const URL = modelAsset('vkjanime.glb');

export function VkjAnime({
  // World-space height to fit into. The wrapping Canvas uses R3F's default
  // camera (fov 75 at z=5), framing ~7.7 units vertically, so 5.4 leaves a
  // little headroom inside the avatar box.
  fitHeight = 5.4,
  yOffset = 0,
  ...props
}) {
  const { scene, animations } = useGLTF(URL);
  const { actions } = useAnimations(animations, scene);

  const fit = useMemo(() => {
    scene.updateMatrixWorld(true);

    const box = new THREE.Box3();
    scene.traverse((o) => {
      if (o.isSkinnedMesh) {
        o.computeBoundingBox();
        if (o.boundingBox) box.union(o.boundingBox.clone().applyMatrix4(o.matrixWorld));
      } else if (o.isMesh && o.geometry) {
        box.expandByObject(o);
      }
    });

    if (box.isEmpty()) return { scale: 1, position: [0, 0, 0] };

    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);
    const scale = size.y > 0 ? fitHeight / size.y : 1;

    return {
      scale,
      position: [-center.x * scale, -center.y * scale + yOffset, -center.z * scale],
    };
  }, [scene, fitHeight, yOffset]);

  useEffect(() => {
    const list = actions ? Object.values(actions).filter(Boolean) : [];
    if (!list.length) return undefined;

    // The clip is unnamed in the file, so it is selected by index, not name.
    const clip = list[0];
    clip.reset();
    clip.setLoop(THREE.LoopRepeat, Infinity);
    clip.clampWhenFinished = false;
    clip.paused = false;
    clip.enabled = true;
    clip.setEffectiveWeight(1);
    clip.setEffectiveTimeScale(1);
    clip.fadeIn(0.35).play();

    // Only stop the clip here. Uncaching the mixer mid-life would invalidate
    // the PropertyBindings that a later play() reuses — three.js then throws
    // "_cacheIndex of undefined" and the canvas is lost. useAnimations already
    // stops all actions and uncaches them on unmount.
    return () => {
      try { clip.stop(); } catch { /* already disposed */ }
    };
  }, [actions]);

  return (
    <group {...props} dispose={null}>
      {/* The wrapper's only light is a third-party HDR preset. These keep the
          character readable if that fetch is slow or unavailable, and are
          deliberately modest so they don't wash it out once it arrives. */}
      <ambientLight intensity={0.6} />
      <directionalLight position={[2.5, 3, 4]} intensity={0.9} />
      <group scale={fit.scale} position={fit.position}>
        <primitive object={scene} />
      </group>
    </group>
  );
}

useGLTF.preload(URL);

export default VkjAnime;
