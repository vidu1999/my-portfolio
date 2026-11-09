import { LINES, SCHEDULE } from './terminalSchedule';

/**
 * Live bash-style typing, driven entirely by CSS.
 *
 * Why there is no JavaScript here
 * -------------------------------
 * Three earlier versions advanced the reveal from a rAF loop. All three failed
 * the same way: the loop can only run when the main thread is free, and on this
 * site the portfolio's own 3D models block it for seconds during hydration. A
 * time-based loop then reads a large elapsed value on its very first frame and
 * paints the finished transcript at once — static text, no typing. A clamped
 * loop instead fell behind and got snapped to full by the completion flush.
 *
 * Both are the same bug: the reveal depended on main-thread frames. This
 * version does not. Every character is rendered up front, hidden, and revealed
 * by its own `opacity` animation with a precomputed `animation-delay`. Opacity
 * is compositor-driven, so the transcript keeps printing even while the main
 * thread is blocked, and it starts at first paint rather than after hydration.
 *
 * The markup is deterministic and identical on server and client, so there is
 * no hydration mismatch and no flash. No state, no effects, no timers, no
 * cleanup — nothing to leak when the loader unmounts.
 */

const ms = (n) => `${Math.round(n)}ms`;

export default function Terminal({ reducedMotion = false }) {
  return (
    <div
      className="vkj-terminal"
      data-reduced={reducedMotion ? '1' : '0'}
      aria-hidden="true"
    >
      {SCHEDULE.lines.map((line, li) => (
        <p
          key={li}
          style={{
            '--vkj-line-at': ms(line.promptAt),
            '--vkj-type-ms': ms(line.endAt - line.promptAt),
            '--vkj-chars': line.chars.length,
          }}
        >
          <span className="vkj-prompt">&gt;</span>
          <span className="vkj-line">
            <span className={li === 1 || li === 2 ? 'vkj-dim' : undefined}>
              {line.chars.map((c, ci) => (
                <span key={ci} className="vkj-ch" style={{ '--vkj-at': ms(c.t) }}>
                  {c.ch === ' ' ? '\u00a0' : c.ch}
                </span>
              ))}
            </span>
            {/* One caret per line, stepped across in ch units. The font is
                monospace so 1ch is exactly one character. Animating transform
                keeps this on the compositor and costs one layer per line
                instead of one per character. */}
            <span className="vkj-caret" data-track="1" />
          </span>
        </p>
      ))}

      {/* Trailing idle prompt, as a shell shows after the last command. */}
      <p className="vkj-idle" style={{ '--vkj-line-at': ms(SCHEDULE.endAt) }}>
        <span className="vkj-prompt">&gt;</span>
        <span className="vkj-caret" data-idle="1" />
      </p>
    </div>
  );
}

export { LINES };
