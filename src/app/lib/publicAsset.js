const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

/**
 * Build a public-folder URL that works both locally and under the
 * GitHub Pages project path (`/my-portfolio`).
 *
 * @param {string} path Path inside `public`, with or without a leading slash.
 * @returns {string}
 */
export function publicAsset(path) {
  const normalizedPath = String(path).replace(/^\/+/, '');
  return `${basePath}/${normalizedPath}`;
}

export const projectImage = (filename) => publicAsset(`projects/${filename}`);
export const modelAsset = (filename) => publicAsset(`models/${filename}`);
export const iconAsset = (filename) => publicAsset(`icon/${filename}`);
