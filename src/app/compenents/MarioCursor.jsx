"use client"
import React from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import Mario3D from './models/Mario3D'
import { usePageVisible } from '@/app/lib/usePageVisible'

export default function MarioCursor() {
  const pageVisible = usePageVisible()

  return (
    <div
      style={{
        width: 34,
        height: 34,
        display: 'inline-block',
        verticalAlign: 'middle',
      }}
    >
      <Canvas
        camera={{ position: [0, 0, 35], fov: 18 }}
        dpr={[1, 1.5]}
        frameloop={pageVisible ? 'always' : 'never'}
        gl={{ alpha: true, antialias: true, powerPreference: 'low-power' }}
      >
        <ambientLight intensity={1.6} />
        <directionalLight position={[5, 5, 5]} intensity={1.5} />
        <Mario3D scale={0.09} position={[0, -7, 0]} rotation={[0, Math.PI / 2, 0]}/>
        <OrbitControls enableZoom={false} enablePan={false} enableRotate={false} />
      </Canvas>
    </div>
  )
}