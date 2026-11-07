'use client';

import { useEffect, useRef, useState } from 'react';

const LINES = [
  'Building something amazing...',
  'React | Next.js | Three.js',
  'Python | AI | DevOps',
  'Turning ideas into reality...',
];

/**
 * Developer-terminal typing effect. Types each line character by character,
 * then leaves a blinking block cursor on the final prompt line.
 * Under reduced motion the full transcript renders immediately.
 */
export default function Terminal({ reducedMotion = false }) {
  const [typed, setTyped] = useState(() => (reducedMotion ? LINES.map((l) => l.length) : [0, 0, 0, 0]));
  const [line, setLine] = useState(() => (reducedMotion ? LINES.length : 0));
  const timers = useRef([]);

  useEffect(() => {
    if (reducedMotion) {
      setTyped(LINES.map((l) => l.length));
      setLine(LINES.length);
      return undefined;
    }

    let cancelled = false;
    let currentLine = 0;
    let currentChar = 0;

    const step = () => {
      if (cancelled) return;
      if (currentLine >= LINES.length) {
        setLine(LINES.length);
        return;
      }
      const text = LINES[currentLine];
      currentChar += 1;
      const li = currentLine;
      const cc = currentChar;
      setTyped((prev) => {
        const next = [...prev];
        next[li] = cc;
        return next;
      });

      if (currentChar >= text.length) {
        currentLine += 1;
        currentChar = 0;
        setLine(currentLine);
        timers.current.push(setTimeout(step, 420));
      } else {
        // Slightly irregular cadence reads as human typing.
        timers.current.push(setTimeout(step, 26 + ((currentChar * 37) % 22)));
      }
    };

    timers.current.push(setTimeout(step, 520));

    return () => {
      cancelled = true;
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
  }, [reducedMotion]);

  return (
    <div className="vkj-terminal" aria-hidden="true">
      {LINES.map((text, i) => {
        if (i > line) return null;
        const shown = text.slice(0, typed[i] || 0);
        const isActive = i === line && line < LINES.length;
        return (
          <p key={i}>
            <span className="vkj-prompt">&gt;</span>
            <span className={i === 1 || i === 2 ? 'vkj-dim' : undefined}>{shown}</span>
            {isActive && <span className="vkj-caret" />}
          </p>
        );
      })}
      {line >= LINES.length && (
        <p>
          <span className="vkj-prompt">&gt;</span>
          <span className="vkj-caret" />
        </p>
      )}
    </div>
  );
}
