// SPDX-License-Identifier: Apache-2.0
// The site bar shared by every page: wordmark, site links, search, GitHub, and
// the theme toggle, plus the search dialog. The docs header
// (docs/src/components/overrides/Header.astro) and the website pages
// (scripts/website.mjs) both render it from here, with the same styles
// (site-bar.css) and scripts (search.js, theme-toggle.js), so the bar can't
// differ between them.
import nav from './nav.json' with { type: 'json' };

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const WORDMARK = `<svg viewBox="14 7 72 87" aria-hidden="true"><path d="M50 9 L84 23 V51 C84 72 69 86 50 92 C31 86 16 72 16 51 V23 Z" fill="#76B900"/><g fill="none" stroke="#FFFFFF" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"><path d="M37 41 L49 50 L37 59"/><path d="M55 59 H67"/></g></svg>`;
const SEARCH = `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" stroke-width="1.75"/><path d="m16 16 4 4" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/></svg>`;
const GITHUB = `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 .3a12 12 0 0 0-3.8 23.38c.6.12.83-.26.83-.57L9 21.07c-3.34.72-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.08-.74.09-.73.09-.73 1.2.09 1.83 1.24 1.83 1.24 1.07 1.83 2.81 1.3 3.5 1 .1-.78.42-1.31.76-1.6-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.14-.3-.54-1.52.1-3.18 0 0 1-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.28-1.55 3.29-1.23 3.29-1.23.64 1.66.24 2.88.12 3.18a4.65 4.65 0 0 1 1.23 3.22c0 4.61-2.8 5.63-5.48 5.92.42.36.81 1.1.81 2.22l-.01 3.29c0 .31.2.69.82.57A12 12 0 0 0 12 .3"/></svg>`;
// Cycled by theme-toggle.js: auto (system), light, dark.
const THEME = `<button type="button" class="icon-button theme-toggle" aria-label="Theme: auto. Switch theme" title="Theme: auto"><svg viewBox="0 0 24 24" aria-hidden="true" class="theme-toggle__auto"><rect x="3" y="4.5" width="18" height="12" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.75"/><path d="M8 20h8M12 16.5V20" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/></svg><svg viewBox="0 0 24 24" aria-hidden="true" class="theme-toggle__light"><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="1.75"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/></svg><svg viewBox="0 0 24 24" aria-hidden="true" class="theme-toggle__dark"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linejoin="round"/></svg></button>`;
const CLOSE = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/></svg>`;

/**
 * @param {object} opts
 * @param {string} [opts.current] href of the current site link (e.g. '/docs/'), marked as the current page
 * @param {{ bundlePath: string, baseUrl: string, merge?: string }} opts.search
 *   the Pagefind index to search, and optionally a second index to merge
 *   (the website pages' /pagefind-website/)
 */
export function siteBar({ current, search }) {
  const links = nav.links
    .map(
      (l) =>
        `<a href="${esc(l.href)}" class="site-bar__link"${l.href === current ? ' aria-current="page"' : ''}>${esc(l.label)}</a>`,
    )
    .join('');
  const data = [
    ['bundle', search.bundlePath],
    ['base-url', search.baseUrl],
    ['merge', search.merge],
  ]
    .filter(([, v]) => v)
    .map(([k, v]) => ` data-${k}="${esc(v)}"`)
    .join('');
  return `<div class="site-bar">
<a href="/" class="site-bar__wordmark" translate="no">${WORDMARK}<span>OpenShell</span></a>
<nav class="site-bar__links" aria-label="Site">${links}</nav>
<button type="button" class="search-button" data-search-open>${SEARCH}<span class="search-button__label">Search</span><kbd class="search-button__kbd">Ctrl K</kbd></button>
<div class="site-bar__end">
<a href="${esc(nav.github)}" class="icon-button"><span class="sr-only">GitHub</span>${GITHUB}</a>
${THEME}
</div>
</div>
<dialog class="search-dialog" aria-label="Search"${data}>
<div class="search-dialog__frame">
<button type="button" class="search-dialog__close" data-search-close aria-label="Close search">${CLOSE}</button>
<div id="site-search"></div>
</div>
</dialog>`;
}
