'use client';

import React, { Suspense, useEffect, useId } from 'react';
import clsx from 'clsx';
import Canvas from './SafeCanvas';
import { Environment } from '@react-three/drei';
import { usePageVisible } from '@/app/lib/usePageVisible';
import { beginModelWork, endModelWork } from '@/app/lib/modelReadiness';

// Simple error boundary to avoid crashing the page on WebGL/model load issues.
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(err, info) {
    // eslint-disable-next-line no-console
    console.error('3D ErrorBoundary caught:', err, info);
    this.props.onError?.(err);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? null;
    }
    return this.props.children;
  }
}

/** Mounts only once every suspended sibling has resolved. */
export function ModelResolved({ id }) {
  useEffect(() => { endModelWork(id, true); }, [id]);
  return null;
}

function RenderModels({ children, className }) {
  const pageVisible = usePageVisible();
  const modelId = useId();

  // Register as soon as the canvas wrapper exists, so a page that has 3D is
  // known to have 3D even before the model request starts. Unmounting settles the
  // slot so client-side navigation can never leave it pending.
  useEffect(() => {
    beginModelWork(modelId);
    return () => endModelWork(modelId, false);
  }, [modelId]);

  return (
    <Canvas
      className={clsx('relative h-full w-full pointer-events-none', className)}
      dpr={[1, 1.5]}
      frameloop={pageVisible ? 'always' : 'never'}
      gl={{ antialias: true, powerPreference: 'low-power' }}
      resize={{ scroll: false, debounce: { scroll: 50, resize: 100 } }}
    >
      <ErrorBoundary onError={() => endModelWork(modelId, false)}>
        <Suspense fallback={null}>
          {children}
          <ModelResolved id={modelId} />
        </Suspense>
      </ErrorBoundary>
      {/* The HDR preset is fetched from a third-party CDN, so it can fail or
          hang independently of the model. It MUST NOT share the boundary above:
          when that fetch rejected, the shared ErrorBoundary fell back to null
          and unmounted the model with it — the canvas kept rendering empty
          frames, so an animated character silently disappeared. Isolating it
          means a CDN failure costs reflections, not the model. */}
      <ErrorBoundary fallback={null}>
        <Suspense fallback={null}>
          <Environment preset="city" />
        </Suspense>
      </ErrorBoundary>
    </Canvas>
  );
}

export default RenderModels;
