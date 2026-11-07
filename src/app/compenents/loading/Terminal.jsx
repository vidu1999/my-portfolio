'use client';

import { useEffect, useRef, useState } from 'react';

const LINES = [
  'Building something amazing...',
  'React | Next.js | Three.js',
  'Python | AI | DevOps',
  'Turning ideas into reality...',
];

// Cadence tuned so the transcript lands in ~2.8s of timeline. The loader holds
// for minDuration (2.6s) + ready hold (0.85s) before the fade begins at ~3.45s,
// so every line finishes typing and is readable before the overlay leaves.
// The previous chained-setTimeout version needed ~5.5s and got cut off.
const START_MS = 200;
const CHAR_MS = 12;
const JITTER_MS = 16;
const LINE_GAP_MS = 130;
// Upper bound on timeline advance per frame — see the note in the rAF loop.
const MAX_STEP_MS = 200;

/**
 * Precomputed reveal schedule: one entry per character, plus the moment each
 * line's prompt appears. Driving from a timeline instead of chaining timers
 * keeps the cadence stable and lets a stalled main thread catch up gradually.
 */
function buildSchedule() {
  const chars = [];
  const promptAt = [];
  let t = START_MS;
  LINES.forEach((text, li) => {
    promptAt.push(t);
    for (let ci = 1; ci <= text.length; ci += 1) {
      // Deterministic pseudo-jitter: reads as human typing, stays reproducible.
      const jitter = ((li * 31 + ci * 17) % 11) / 10;
      t += CHAR_MS + jitter * JITTER_MS;
      chars.push({ li, ci, t });
    }
    t += LINE_GAP_MS;
  });
  return { chars, promptAt, endAt: t };
}

const SCHEDULE = buildSchedule();

/**
 * Live bash-style typing. Each line's `>` prompt appears, the command types out
 * character by character with a solid block cursor tracking the caret, then
 * pauses as if executed before the next prompt. Ends on a bare prompt with a
 * blinking cursor. Under reduced motion the full transcript renders at once.
 */
export default function Terminal({ reducedMotion = false, flush = false }) {
  const full = () => LINES.map((l) => l.length);
  const [typed, setTyped] = useState(() => (reducedMotion ? full() : [0, 0, 0, 0]));
  const [visibleLines, setVisibleLines] = useState(() => (reducedMotion ? LINES.length + 1 : 0));
  const [typing, setTyping] = useState(false);
  const raf = useRef(0);

  // When loading finishes, immediately reveal whatever hasn't been typed yet.
  // On a slow device the clamped clock can lag behind the loader; flushing keeps
  // the transcript from being truncated mid-line, exactly as a shell prints
  // buffered output when it catches up.
  useEffect(() => {
    if (reducedMotion) {
      setTyped(full());
      setVisibleLines(LINES.length + 1);
      setTyping(false);
      return undefined;
    }

    if (flush) return undefined;
    let last = 0;
    let elapsed = 0;
    let lastKey = '';

    const frame = (now) => {
      if (!last) last = now;
      // Advance a virtual clock, clamped per frame. A multi-second main-thread
      // stall (shader compilation on a weak GPU) would otherwise skip the whole
      // transcript in one jump; clamping keeps the typing visible while still
      // letting it catch up gradually rather than dragging.
      elapsed += Math.min(now - last, MAX_STEP_MS);
      last = now;

      const counts = [0, 0, 0, 0];
      for (const c of SCHEDULE.chars) {
        if (c.t > elapsed) break;
        counts[c.li] = c.ci;
      }
      let lines = 0;
      for (const at of SCHEDULE.promptAt) {
        if (at > elapsed) break;
        lines += 1;
      }
      const done = elapsed >= SCHEDULE.endAt;
      if (done) lines = LINES.length + 1;

      // Active line is the last visible one that isn't complete yet.
      const active = Math.min(lines, LINES.length) - 1;
      const isTyping =
        !done && active >= 0 && counts[active] > 0 && counts[active] < LINES[active].length;

      // Only commit when something actually changed — avoids a render per frame.
      const key = `${counts.join(',')}|${lines}|${isTyping}`;
      if (key !== lastKey) {
        lastKey = key;
        setTyped(counts);
        setVisibleLines(lines);
        setTyping(isTyping);
      }
      if (!done) raf.current = requestAnimationFrame(frame);
    };

    raf.current = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf.current);
  }, [reducedMotion, flush]);

  // Derived, so the same commit that flips the loader to READY also shows the
  // complete transcript — no one-frame flash of truncated text.
  const shownTyped = flush ? LINES.map((l) => l.length) : typed;
  const shownLines = flush ? LINES.length + 1 : visibleLines;
  const shownTyping = flush ? false : typing;
  const activeLine = Math.min(shownLines, LINES.length) - 1;

  return (
    <div className="vkj-terminal" aria-hidden="true">
      {LINES.map((text, i) => {
        if (i >= shownLines) return null;
        const shown = text.slice(0, shownTyped[i] || 0);
        const isActive = i === activeLine && shownLines <= LINES.length;
        return (
          <p key={i}>
            <span className="vkj-prompt">&gt;</span>
            <span className={i === 1 || i === 2 ? 'vkj-dim' : undefined}>{shown}</span>
            {isActive && <span className="vkj-caret" data-typing={typing ? '1' : '0'} />}
          </p>
        );
      })}
      {shownLines > LINES.length && (
        <p>
          <span className="vkj-prompt">&gt;</span>
          <span className="vkj-caret" data-typing="0" />
        </p>
      )}
    </div>
  );
}
