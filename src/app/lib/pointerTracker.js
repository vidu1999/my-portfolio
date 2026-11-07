'use client';

/**
 * Shared, reference-counted pointer tracker.
 *
 * The portfolio canvases render with `pointer-events: none`, so R3F's built-in
 * `state.pointer` never updates. This module tracks the pointer at the window
 * level instead, using ONE passive listener shared by every 3D rig on the page.
 *
 * Values are written to a mutable object (no React state, no re-renders) and read
 * inside `useFrame`, so tracking costs nothing per frame beyond two divisions.
 */

const pointer = { x: 0, y: 0, active: false };

let subscribers = 0;
let attached = false;

function handleMove(event) {
  const width = window.innerWidth || 1;
  const height = window.innerHeight || 1;
  pointer.x = (event.clientX / width) * 2 - 1;
  pointer.y = -((event.clientY / height) * 2 - 1);
  pointer.active = true;
}

function handleLeave() {
  pointer.x = 0;
  pointer.y = 0;
  pointer.active = false;
}

function attach() {
  if (attached || typeof window === 'undefined') return;
  window.addEventListener('pointermove', handleMove, { passive: true });
  window.addEventListener('pointerdown', handleMove, { passive: true });
  document.addEventListener('pointerleave', handleLeave);
  window.addEventListener('blur', handleLeave);
  attached = true;
}

function detach() {
  if (!attached || typeof window === 'undefined') return;
  window.removeEventListener('pointermove', handleMove);
  window.removeEventListener('pointerdown', handleMove);
  document.removeEventListener('pointerleave', handleLeave);
  window.removeEventListener('blur', handleLeave);
  attached = false;
  handleLeave();
}

/** Subscribe to the shared tracker. Returns an unsubscribe function. */
export function subscribePointer() {
  if (typeof window === 'undefined') return () => {};
  subscribers += 1;
  attach();

  return () => {
    subscribers = Math.max(0, subscribers - 1);
    if (subscribers === 0) detach();
  };
}

/** Current normalized pointer position (-1..1). Do not mutate. */
export function getPointer() {
  return pointer;
}
