/**
 * Motion presets for the runtime model rig.
 *
 * Every value is intentionally small. The rig is additive and non-destructive:
 * it never edits geometry, materials, textures, or the .glb files. Amplitudes are
 * tuned so the silhouette stays faithful to the original sculpt.
 *
 * Units:
 *  - *Amp (position)  : world units, applied to the wrapper group
 *  - *Amp (rotation)  : radians
 *  - bend/twist/breathe: shader-space radians / fractional scale
 */

export const CHARACTER_PRESET = {
  // Whole-body idle
  bobAmp: 0.035,
  bobSpeed: 1.15,
  swayAmp: 0.022,
  swaySpeed: 0.62,
  driftAmp: 0.018,
  driftSpeed: 0.41,

  // Pointer attention (head/torso follow)
  lookYaw: 0.2,
  lookPitch: 0.11,
  lookDamping: 3.2,

  // Shader deformation (the "bones")
  breatheAmp: 0.012,
  breatheSpeed: 1.05,
  bendAmp: 0.022,
  twistAmp: 0.055,
  spineStiffness: 2.4,

  // Greeting gesture
  greetEvery: 11,
  greetDuration: 2.1,
  greetNod: 0.13,
  greetTwist: 0.10,
  greetLift: 0.05,
};

export const ROBOT_PRESET = {
  // Servo-style hover
  bobAmp: 0.06,
  bobSpeed: 0.85,
  swayAmp: 0.014,
  swaySpeed: 0.5,
  driftAmp: 0.012,
  driftSpeed: 0.33,

  // Scanning attention
  lookYaw: 0.12,
  lookPitch: 0.08,
  lookDamping: 2.1,

  // Mechanical micro-articulation
  breatheAmp: 0.006,
  breatheSpeed: 1.6,
  bendAmp: 0.014,
  twistAmp: 0.03,
  spineStiffness: 3.4,

  // Acknowledgement pulse
  greetEvery: 9,
  greetDuration: 1.6,
  greetNod: 0.09,
  greetTwist: 0.045,
  greetLift: 0.07,
};

export const PRESETS = {
  character: CHARACTER_PRESET,
  robot: ROBOT_PRESET,
};

export function resolvePreset(preset, overrides) {
  const base = typeof preset === 'string' ? PRESETS[preset] || CHARACTER_PRESET : preset || CHARACTER_PRESET;
  return overrides ? { ...base, ...overrides } : base;
}

/** Frame-rate independent exponential smoothing. */
export function damp(current, target, lambda, delta) {
  return current + (target - current) * (1 - Math.exp(-lambda * delta));
}

/** Smooth 0 -> 1 -> 0 envelope used for the greeting gesture. */
export function greetEnvelope(phase) {
  if (phase <= 0 || phase >= 1) return 0;
  return Math.sin(phase * Math.PI) ** 2;
}
