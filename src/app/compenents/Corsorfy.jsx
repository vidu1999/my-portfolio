"use client"

import Canvas from "./SafeCanvas"
import { Suspense } from "react"
import AnimatedDroneModel from "./DroneMeetup"
import { ErrorBoundary } from "./RenderModels"
import { modelAsset } from "@/app/lib/publicAsset"
import { usePageVisible } from "@/app/lib/usePageVisible"

export default function Corsorfy() {
  const pageVisible = usePageVisible()

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 z-0 pointer-events-none overflow-hidden"
    >
      <Canvas
       style={{ pointerEvents: "none" }} // âœ… FORCE disable
        className="pointer-events-none"
        camera={{ position: [0, 0, 10], fov: 45 }}
        dpr={[1, 1.5]}
        frameloop={pageVisible ? 'always' : 'never'}
        gl={{ alpha: true, powerPreference: 'low-power' }}
        resize={{ scroll: false, debounce: { scroll: 50, resize: 100 } }}
      >
        <ErrorBoundary>
          <Suspense fallback={null}>
            <ambientLight intensity={1.2} />
            <directionalLight position={[5, 5, 5]} intensity={2} />

            <AnimatedDroneModel
              glbPath={modelAsset('animated_drone.glb')}
            />
          </Suspense>
        </ErrorBoundary>
      </Canvas>
    </div>
  )
}
