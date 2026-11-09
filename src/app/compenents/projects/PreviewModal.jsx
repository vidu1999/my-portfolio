'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { previewUrlOf, repoUrlOf } from './ProjectActions';

/**
 * In-page preview for a project.
 *
 * Games are static Canvas ports shipped in /public/games and loaded in a
 * sandboxed iframe; web apps are the project's real deployed URL. The iframe is
 * only mounted while the modal is open, so closing it tears the game down and
 * stops its animation loop rather than leaving it running behind the page.
 *
 * Third-party sites can refuse framing via X-Frame-Options / CSP. That cannot
 * be detected reliably cross-origin, so after a grace period we surface an
 * "open in a new tab" escape hatch instead of leaving a blank pane.
 */

const FRAME_GRACE_MS = 6000;

export default function PreviewModal({ project, onClose }) {
  const open = Boolean(project);
  const url = open ? previewUrlOf(project) : null;
  const isGame = project?.preview?.kind === 'game';
  const [loaded, setLoaded] = useState(false);
  const [slow, setSlow] = useState(false);
  const closeRef = useRef(null);
  const restoreRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    setLoaded(false);
    setSlow(false);
    restoreRef.current = document.activeElement;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // Focus the close control so Escape and keyboard nav start somewhere sane.
    const t = setTimeout(() => closeRef.current?.focus(), 30);
    const grace = setTimeout(() => setSlow(true), FRAME_GRACE_MS);
    return () => {
      clearTimeout(t);
      clearTimeout(grace);
      document.body.style.overflow = prevOverflow;
      const el = restoreRef.current;
      if (el && typeof el.focus === 'function') el.focus();
    };
  }, [open, project?.id]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const onBackdrop = useCallback((e) => {
    if (e.target === e.currentTarget) onClose();
  }, [onClose]);

  if (!open || !url) return null;

  const repo = repoUrlOf(project);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${project.title} preview`}
      onClick={onBackdrop}
      className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-6"
      style={{ background: 'rgba(3,6,18,0.82)', backdropFilter: 'blur(6px)' }}
    >
      <div
        className="relative flex w-full max-w-5xl flex-col overflow-hidden rounded-2xl"
        style={{
          height: 'min(92svh, 900px)',
          background: 'linear-gradient(160deg, rgba(15,10,35,0.98), rgba(8,5,22,0.99))',
          border: '1px solid rgba(118,230,255,0.28)',
          boxShadow: '0 30px 80px rgba(0,0,0,0.6), 0 0 40px rgba(118,230,255,0.12)',
        }}
      >
        <header
          className="flex shrink-0 items-center gap-3 px-4 py-3"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}
        >
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-sm font-black text-white">{project.title}</h2>
            <p className="truncate text-[11px] font-semibold text-[#9fb3d6]">
              {isGame ? 'Playing in your browser' : project.preview.label || 'Live preview'}
            </p>
          </div>

          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden shrink-0 rounded-full px-3 py-1.5 text-[11px] font-bold text-[#76e6ff] sm:block"
            style={{ border: '1px solid rgba(118,230,255,0.35)' }}
          >
            Open in new tab
          </a>
          {repo && (
            <a
              href={repo}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden shrink-0 rounded-full px-3 py-1.5 text-[11px] font-bold text-white/80 sm:block"
              style={{ border: '1px solid rgba(255,255,255,0.2)' }}
            >
              Source
            </a>
          )}
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close preview"
            className="shrink-0 rounded-full p-2 text-white transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#76e6ff]"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeWidth={2.2} d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </header>

        <div className="relative min-h-0 flex-1" style={{ background: '#0b1020' }}>
          {!loaded && (
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 text-center">
              <div
                className="h-8 w-8 animate-spin rounded-full"
                style={{ border: '2px solid rgba(118,230,255,0.25)', borderTopColor: '#76e6ff' }}
              />
              <p className="text-xs font-semibold text-[#9fb3d6]">
                {isGame ? 'Loading game…' : 'Loading live preview…'}
              </p>
            </div>
          )}

          {slow && !loaded && !isGame && (
            <div className="absolute inset-x-0 bottom-0 z-10 flex flex-wrap items-center justify-center gap-3 px-4 py-3 text-center"
              style={{ background: 'rgba(8,5,22,0.94)', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
              <p className="text-[11px] font-semibold text-[#9fb3d6]">
                This site may not allow embedding.
              </p>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full bg-[#76e6ff] px-4 py-1.5 text-[11px] font-black text-[#0b1020]"
              >
                Open in a new tab
              </a>
            </div>
          )}

          <iframe
            key={project.id}
            src={url}
            title={`${project.title} preview`}
            onLoad={() => setLoaded(true)}
            className="h-full w-full border-0"
            /* Games are our own static files and need scripts + pointer/keyboard.
               External sites get the same minus top-level navigation. */
            sandbox="allow-scripts allow-same-origin allow-pointer-lock allow-popups allow-forms"
            allow="fullscreen; gamepad"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>

        {isGame && (
          <footer
            className="shrink-0 px-4 py-2 text-center text-[11px] font-semibold text-[#9fb3d6]"
            style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}
          >
            Browser port of the original Pygame project — same rules, controls and artwork.
          </footer>
        )}
      </div>
    </div>
  );
}
