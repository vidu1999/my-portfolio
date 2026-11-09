'use client';

import { publicAsset } from '@/app/lib/publicAsset';

/**
 * The two project actions.
 *
 * GitHub button -> opens the source repository in a new tab.
 * Eye button    -> opens a real, running preview inside the site.
 *
 * Both carry the "View Project" label by design; the icon and the aria-label
 * distinguish them. A button is omitted entirely when its target does not
 * exist, rather than rendered dead: several of these projects are hardware,
 * desktop or backend work with no public repo or no possible browser preview.
 */

export function GithubIcon({ className = 'w-4 h-4' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 .5C5.73.5.5 5.73.5 12a11.5 11.5 0 0 0 7.86 10.92c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.54-3.88-1.54-.53-1.34-1.3-1.7-1.3-1.7-1.06-.72.08-.71.08-.71 1.17.08 1.79 1.2 1.79 1.2 1.04 1.79 2.73 1.27 3.4.97.1-.76.41-1.27.74-1.56-2.55-.29-5.23-1.28-5.23-5.7 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.8 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.12 3.05.74.81 1.18 1.84 1.18 3.1 0 4.43-2.69 5.41-5.25 5.69.42.36.79 1.08.79 2.18v3.23c0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12C23.5 5.73 18.27.5 12 .5Z" />
    </svg>
  );
}

export function EyeIcon({ className = 'w-4 h-4' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M2.25 12S5.75 5.75 12 5.75 21.75 12 21.75 12 18.25 18.25 12 18.25 2.25 12 2.25 12Z" />
      <circle cx="12" cy="12" r="3.1" strokeWidth={2} />
    </svg>
  );
}

/** Resolve a project's repo URL, falling back to `link` when it is a GitHub URL. */
export function repoUrlOf(project) {
  if (project?.repo) return project.repo;
  const link = project?.link;
  return typeof link === 'string' && /^https:\/\/github\.com\//.test(link) ? link : null;
}

/** Absolute, basePath-safe URL for the preview, or null when there is none. */
export function previewUrlOf(project) {
  const p = project?.preview;
  if (!p) return null;
  return p.kind === 'game' ? publicAsset(p.path) : p.url;
}

export default function ProjectActions({ project, onPreview, className = '' }) {
  const repo = repoUrlOf(project);
  const hasPreview = Boolean(project?.preview);
  if (!repo && !hasPreview) return null;

  const accent = (project.glowColor || 'rgba(139,92,246,0.6)').replace('0.6', '0.4');

  const base =
    'flex-1 min-w-0 py-3 px-3 rounded-xl font-black text-xs text-white transition-all duration-300 hover:brightness-125 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2';
  const style = {
    background: 'rgba(255,255,255,0.07)',
    border: `1px solid ${accent}`,
  };

  return (
    <div className={`flex items-stretch gap-2 ${className}`}>
      {repo && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            window.open(repo, '_blank', 'noopener,noreferrer');
          }}
          className={base}
          style={style}
          aria-label={`View ${project.title} source on GitHub`}
          title="Open the GitHub repository"
        >
          <span className="flex items-center justify-center gap-1.5">
            <GithubIcon />
            <span className="truncate">View Project</span>
          </span>
        </button>
      )}

      {hasPreview && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onPreview?.(project);
          }}
          className={base}
          style={{
            ...style,
            background: `linear-gradient(135deg, ${accent}, rgba(255,255,255,0.04))`,
          }}
          aria-label={`Preview ${project.title} in the browser`}
          title={project.preview.kind === 'game' ? 'Play in the browser' : 'Open a live preview'}
        >
          <span className="flex items-center justify-center gap-1.5">
            <EyeIcon />
            <span className="truncate">View Project</span>
          </span>
        </button>
      )}
    </div>
  );
}
