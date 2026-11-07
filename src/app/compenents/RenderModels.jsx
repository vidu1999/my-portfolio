'use client';

import React, { Suspense } from 'react';
import clsx from 'clsx';
import Canvas from './SafeCanvas';
import { Environment } from '@react-three/drei';
import { usePageVisible } from '@/app/lib/usePageVisible';

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
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? null;
    }
    return this.props.children;
  }
}

function RenderModels({ children, className }) {
  const pageVisible = usePageVisible();

  return (
    <Canvas
      className={clsx('relative h-full w-full pointer-events-none', className)}
      dpr={[1, 1.5]}
      frameloop={pageVisible ? 'always' : 'never'}
      gl={{ antialias: true, powerPreference: 'low-power' }}
      resize={{ scroll: false, debounce: { scroll: 50, resize: 100 } }}
    >
      <ErrorBoundary>
        <Suspense fallback={null}>
          {children}
          <Environment preset="city" />
        </Suspense>
      </ErrorBoundary>
    </Canvas>
  );
}

export default RenderModels;
