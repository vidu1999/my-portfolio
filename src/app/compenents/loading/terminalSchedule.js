/**
 * Terminal transcript, shared by the component and the loader's timing.
 *
 * Kept in its own module so LoadingScreen can size its minimum display time
 * against the real transcript length without importing the component.
 */

export const LINES = [
  'Building something amazing...',
  'React | Next.js | Three.js',
  'Python | AI | DevOps',
  'Turning ideas into reality...',
];

const START_MS = 200;
const CHAR_MS = 12;
const JITTER_MS = 16;
const LINE_GAP_MS = 130;

/**
 * Precomputed reveal schedule. Deterministic, so the server and the client
 * render byte-identical markup and hydration never mismatches.
 */
function build() {
  let t = START_MS;
  const lines = LINES.map((text, li) => {
    const promptAt = t;
    const chars = [];
    for (let ci = 0; ci < text.length; ci += 1) {
      // Deterministic pseudo-jitter: reads as human typing, stays reproducible.
      const jitter = ((li * 31 + (ci + 1) * 17) % 11) / 10;
      t += CHAR_MS + jitter * JITTER_MS;
      chars.push({ ch: text[ci], t });
    }
    const line = { text, promptAt, chars, endAt: t };
    t += LINE_GAP_MS;
    return line;
  });

  const endAt = t;

  return { lines, endAt };
}

export const SCHEDULE = build();

/** Wall-clock length of the full transcript, including the trailing gap. */
export const TERMINAL_DURATION_MS = SCHEDULE.endAt;
