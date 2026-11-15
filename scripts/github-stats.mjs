#!/usr/bin/env node
/**
 * Regenerates public/stats/github-stats.svg — the About page's GitHub Stats
 * card, generated in-repo instead of depending on a third-party service
 * (github-readme-stats deployments pause/sleep and break the page).
 *
 * Usage:  node scripts/github-stats.mjs
 *         GITHUB_TOKEN=ghp_... node scripts/github-stats.mjs   (optional, raises the API limit)
 *
 * The layout follows the classic github-readme-stats "transparent" card:
 * no border, transparent background, indigo title/icons (#818CF8), white
 * text, regular weight. Numbers come from the public GitHub API and are
 * baked in — re-run this script to refresh, then commit the new SVG.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const USERNAME = "Vidu1999";
const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "stats", "github-stats.svg");

const headers = { Accept: "application/vnd.github+json", "User-Agent": "vkj-portfolio-stats" };
if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

const api = async (path) => {
  const res = await fetch(`https://api.github.com${path}`, { headers });
  if (!res.ok) throw new Error(`GitHub API ${path} → HTTP ${res.status}`);
  return res.json();
};

// ── data ────────────────────────────────────────────────────────────────
const user = await api(`/users/${USERNAME}`);
const repos = (await api(`/users/${USERNAME}/repos?per_page=100`)).filter((r) => !r.fork);
const totalStars = repos.reduce((sum, r) => sum + r.stargazers_count, 0);
const prs = (await api(`/search/issues?q=author:${USERNAME}+type:pr`)).total_count;
const issues = (await api(`/search/issues?q=author:${USERNAME}+type:issue`)).total_count;

let totalCommits = 0;
for (const repo of repos) {
  try {
    const contributors = await api(`/repos/${USERNAME}/${repo.name}/contributors`);
    totalCommits += contributors
      .filter((c) => c.login.toLowerCase() === USERNAME.toLowerCase())
      .reduce((sum, c) => sum + c.contributions, 0);
  } catch {
    // empty or disabled stats repos contribute 0
  }
}

const rows = [
  { icon: "star", label: "Total Stars:", value: String(totalStars) },
  { icon: "commit", label: "Total Commits:", value: String(totalCommits) },
  { icon: "pr", label: "Total PRs:", value: String(prs) },
  { icon: "issue", label: "Total Issues:", value: String(issues) },
  { icon: "people", label: "Followers:", value: String(user.followers) },
];

// ── icons (15×15, indigo) ───────────────────────────────────────────────
const C = "#818CF8";
const icons = {
  star: `<path d="M7.5 0.5l2.05 4.15 4.58 0.67-3.31 3.23 0.78 4.56L7.5 10.96 3.4 13.11l0.78-4.56L0.87 5.32l4.58-0.67z" fill="${C}"/>`,
  commit: `<circle cx="7.5" cy="7.5" r="3" fill="${C}"/><rect x="0" y="6.6" width="4" height="1.8" fill="${C}"/><rect x="11" y="6.6" width="4" height="1.8" fill="${C}"/>`,
  pr: `<circle cx="3.4" cy="3.4" r="2.2" fill="none" stroke="${C}" stroke-width="1.6"/><circle cx="3.4" cy="11.6" r="2.2" fill="none" stroke="${C}" stroke-width="1.6"/><rect x="2.6" y="5" width="1.6" height="4.6" fill="${C}"/><path d="M7 3.4h2.4v2.2M7 3.4l2 2M12 8.2v4.2M10.2 10.8l1.8 1.8 1.8-1.8" fill="none" stroke="${C}" stroke-width="1.5" stroke-linecap="round"/>`,
  issue: `<circle cx="7.5" cy="7.5" r="6.2" fill="none" stroke="${C}" stroke-width="1.6"/><circle cx="7.5" cy="7.5" r="1.7" fill="${C}"/>`,
  people: `<circle cx="5.2" cy="5" r="2.6" fill="${C}"/><path d="M0.8 14c0-2.6 2-4.2 4.4-4.2s4.4 1.6 4.4 4.2" fill="${C}"/><circle cx="11.4" cy="5.4" r="2.1" fill="none" stroke="${C}" stroke-width="1.5"/><path d="M10 9.9c2.3-0.3 4.2 1.2 4.2 3.6" fill="none" stroke="${C}" stroke-width="1.5"/>`,
};

// ── layout (classic 450×195, transparent) ───────────────────────────────
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/'/g, "&#39;");
const rowYs = [80, 105, 130, 155, 180];

const rowsSvg = rows
  .map(
    (r, i) => `
  <g transform="translate(40 ${rowYs[i] - 11})">${icons[r.icon]}</g>
  <text x="64" y="${rowYs[i]}" font-size="15" fill="#FFFFFF" fill-opacity="0.75">${esc(r.label)}<tspan dx="7" fill="#FFFFFF" fill-opacity="1">${esc(r.value)}</tspan></text>`
  )
  .join("");

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="450" height="195" viewBox="0 0 450 195" role="img" aria-label="${esc(USERNAME)}'s GitHub Stats">
  <title>${esc(USERNAME)}&#39;s GitHub Stats</title>
  <g font-family="'Segoe UI', Ubuntu, sans-serif" font-weight="400">
  <text x="40" y="46" font-size="21" fill="${C}">${esc(USERNAME)}&#39;s GitHub Stats</text>
  <text x="412" y="94" font-size="12" text-anchor="end" fill="#FFFFFF" fill-opacity="0.4">github.com/${esc(USERNAME)}</text>
  <text x="412" y="112" font-size="12" text-anchor="end" fill="#FFFFFF" fill-opacity="0.4">member since ${esc(user.created_at.slice(0, 4))}</text>
  ${rowsSvg}
  </g>
</svg>
`;

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, svg);
console.log(`wrote ${OUT}`);
console.log(rows.map((r) => `${r.label} ${r.value}`).join(" | "));
