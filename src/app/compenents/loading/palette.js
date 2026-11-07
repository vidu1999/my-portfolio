/**
 * Single source of truth for the loader's accent colours.
 *
 * The reference artwork is neon green, and the background plate baked from it is
 * green too, so the foreground has to be green to sit on it coherently.
 *
 * To switch the whole loader (CSS *and* WebGL) to the portfolio's cyan instead,
 * change PALETTE to CYAN below — nothing else needs editing. The CSS consumes
 * these as custom properties set on .vkj-root; the scene imports them directly.
 */

const GREEN = {
  accent: '#22ff5e',
  accentRgb: '34, 255, 94',
  soft: '#4dff81',
  dim: '#1a8f3c',
  deep: '#0fb840',
  // Additive layers need a low red channel or they clip to white.
  glow: '#4dff7d',
  edgeCore: '#63ff96',
  glass: '#a9f5c6',
  fog: '#010704',
  ink: '#03070a',
  rock: '#040906',
  metal: '#070c0a',
  particle: '#1cff5c',
  // The reference's K is a lime/yellow-green, distinct from the pure green trim.
  logoAccent: '#7cc428',
  logoEmissive: '#8ed13a',
  text: '#e8fff0',
  textDim: '#cfe9d8',
  muted: '#7e9a8b',
};

const CYAN = {
  accent: '#76e6ff',
  accentRgb: '118, 230, 255',
  soft: '#9beeff',
  dim: '#2f7fa8',
  deep: '#2b8fd6',
  glow: '#3eb7ff',
  edgeCore: '#5fd8ff',
  glass: '#a9d8f5',
  fog: '#050a18',
  ink: '#0a1022',
  rock: '#050a18',
  metal: '#070d1c',
  particle: '#1cc8ff',
  logoAccent: '#3eb7ff',
  logoEmissive: '#76e6ff',
  text: '#f5fbff',
  textDim: '#dfeeff',
  muted: '#9fb3d6',
};

export const PALETTE = GREEN;

/** Custom properties applied to .vkj-root so CSS and WebGL never drift apart. */
export const paletteVars = {
  '--vkj-accent': PALETTE.accent,
  '--vkj-accent-rgb': PALETTE.accentRgb,
  '--vkj-accent-soft': PALETTE.soft,
  '--vkj-accent-dim': PALETTE.dim,
  '--vkj-accent-deep': PALETTE.deep,
  '--vkj-text': PALETTE.text,
  '--vkj-text-dim': PALETTE.textDim,
  '--vkj-muted': PALETTE.muted,
};

export { GREEN, CYAN };
