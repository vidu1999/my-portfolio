"use client"
import React from 'react'
import { useGLTF } from '@react-three/drei'
import { modelAsset } from '@/app/lib/publicAsset';
import ModelRig from './rig/ModelRig';

export default function Model(props) {
  // ✅ Hook called unconditionally at top level
  const { nodes, materials } = useGLTF(modelAsset('low_poly_stone_arche-transformed.glb'));

  // If model data exists, render the model
  if (nodes && materials) {
    return (
      <ModelRig preset="robot" phase={1.2}>
        <group {...props} dispose={null} position={[-0.2, -2, 0]} scale={[7, 7, 7]} rotation={[0, 1.6, 0]}>
          <mesh
            name="mesh_base_material_0"
            castShadow
            receiveShadow
            geometry={nodes.mesh_base_material_0.geometry}
            material={materials.base_material}
            scale={2.146}
          />
        </group>
      </ModelRig>
    );
  }

  // Fallback if model doesn't load
  return (
    <mesh {...props}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="red" />
    </mesh>
  );
}
