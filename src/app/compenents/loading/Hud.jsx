'use client';

import { memo } from 'react';

/** Thin neon circuit corner. Drawn once as inline SVG — no image requests. */
const Corner = memo(function Corner({ pos }) {
  return (
    <div className={`vkj-corner vkj-corner--${pos}`}>
      <svg viewBox="0 0 268 150" fill="none" preserveAspectRatio="xMinYMin meet">
        <path
          d="M0 30 H34 L52 12 H150"
          stroke="currentColor"
          strokeWidth="1.4"
          opacity="0.85"
        />
        <path d="M0 62 H22 L38 46 H86" stroke="currentColor" strokeWidth="1" opacity="0.45" />
        <path d="M18 150 V96 L36 78 H70" stroke="currentColor" strokeWidth="1" opacity="0.35" />
        <path d="M150 12 H210" stroke="currentColor" strokeWidth="1" opacity="0.25" />
        <circle cx="150" cy="12" r="2.4" fill="currentColor" opacity="0.9" />
        <circle cx="86" cy="46" r="1.8" fill="currentColor" opacity="0.6" />
      </svg>
    </div>
  );
});

const Stripes = memo(function Stripes() {
  return (
    <span className="vkj-stripes">
      <em />
      <em />
      <em />
    </span>
  );
});

const Dots = memo(function Dots() {
  // 9 x 6 matrix; staggered pulse so it shimmers rather than blinks in unison.
  const cells = Array.from({ length: 54 }, (_, i) => i);
  return (
    <div className="vkj-dots">
      {cells.map((i) => (
        <span key={i} style={{ animationDelay: `${((i % 9) + Math.floor(i / 9)) * 0.14}s` }} />
      ))}
    </div>
  );
});

export default function Hud() {
  return (
    <div className="vkj-hud">
      <Corner pos="tl" />
      <Corner pos="tr" />
      <Corner pos="bl" />
      <Corner pos="br" />

      <div className="vkj-brand">
        VKJ<span>/&gt;</span>
      </div>

      <div className="vkj-role">
        <b>SOFTWARE ENGINEER</b>
        <i>•</i>
        <b>DEVELOPER</b>
        <i>•</i>
        <b>CREATOR</b>
        <Stripes />
      </div>

      <Dots />

      <div className="vkj-tagline">
        <Stripes />
        <span>
          INNOVATE <i>•</i> DEVELOP <i>•</i> INSPIRE
        </span>
      </div>
    </div>
  );
}
