'use client';

import { Component, useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';

/**
 * Drop-in replacement for @react-three/fiber's <Canvas> that fails safe.
 *
 * R3F throws while *constructing* the renderer if a WebGL context cannot be
 * created. An ErrorBoundary placed INSIDE the Canvas never sees that throw, so
 * on a device without WebGL the error escapes and React unmounts the whole
 * page. This wrapper:
 *   1. probes for WebGL support after mount and renders nothing if absent, and
 *   2. wraps the Canvas itself in a boundary as a second line of defence.
 *
 * All props are forwarded unchanged, so callers only swap the import.
 */

let cachedSupport = null;

function probeWebGL() {
  if (cachedSupport !== null) return cachedSupport;
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) {
      cachedSupport = false;
    } else {
      const lose = gl.getExtension('WEBGL_lose_context');
      if (lose) lose.loseContext();
      cachedSupport = true;
    }
  } catch {
    cachedSupport = false;
  }
  return cachedSupport;
}

class CanvasBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    // eslint-disable-next-line no-console
    console.warn('3D canvas disabled:', error?.message || error);
  }

  render() {
    if (this.state.failed) return this.props.fallback ?? null;
    return this.props.children;
  }
}

export default function SafeCanvas({ fallback = null, children, ...props }) {
  // Start true so server and first client render agree (no hydration mismatch),
  // then drop to the fallback if the device genuinely has no WebGL.
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    setSupported(probeWebGL());
  }, []);

  if (!supported) return fallback;

  return (
    <CanvasBoundary fallback={fallback}>
      <Canvas {...props}>{children}</Canvas>
    </CanvasBoundary>
  );
}
