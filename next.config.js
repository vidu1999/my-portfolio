/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === 'production';
const repo = 'my-portfolio';
const basePath = isProd ? `/${repo}` : '';


const nextConfig = {
  // Static export for GitHub Pages
  output: 'export',
  trailingSlash: true,
  // GitHub Pages serves the site under the repo name; update to your repo path
  basePath: process.env.NODE_ENV === 'production' ? '/my-portfolio' : '',
  assetPrefix: process.env.NODE_ENV === 'production' ? '/my-portfolio/' : '',
  images: {
    unoptimized: true,
  },
  compress: false,
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
};

module.exports = nextConfig;
