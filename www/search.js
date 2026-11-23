// SPDX-License-Identifier: Apache-2.0
// Search on the pages in www/. It uses the same two Pagefind indexes as the
// docs search: the docs index (/docs/pagefind/) merged with the website pages
// (/pagefind-www/, written by scripts/website.mjs). The search UI loads on
// first open.
const dialog = document.querySelector('.search-dialog');
const kbd = document.querySelector('.search-button__kbd');
if (kbd && /Mac|iPhone|iPad/.test(navigator.platform)) kbd.textContent = '⌘ K';

let ready;
// Starlight's default ranking, applied to both indexes as the docs search does,
// so results here match it.
const ranking = { pageLength: 0.1, termFrequency: 0.1, termSaturation: 2, termSimilarity: 9, diacriticSimilarity: 0.8 };

const load = () =>
  (ready ??= new Promise((resolve, reject) => {
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = '/docs/pagefind/pagefind-ui.css';
    document.head.append(css);
    const js = document.createElement('script');
    js.src = '/docs/pagefind/pagefind-ui.js';
    js.onload = () => {
      new window.PagefindUI({
        element: '#site-search',
        bundlePath: '/docs/pagefind/',
        baseUrl: '/docs/',
        // Website pages count half, as in site/astro.config.mjs.
        mergeIndex: [{ bundlePath: '/pagefind-www/', baseUrl: '/', indexWeight: 0.5, ranking }],
        showSubResults: true,
        showImages: false,
        // Starlight's default ranking, so results match the docs search.
        ranking: {
          pageLength: 0.1,
          termFrequency: 0.1,
          termSaturation: 2,
          termSimilarity: 9,
          diacriticSimilarity: 0.8,
        },
      });
      resolve();
    };
    js.onerror = reject;
    document.head.append(js);
  }));

async function open() {
  if (dialog.open) return;
  dialog.showModal();
  await load();
  dialog.querySelector('.pagefind-ui__search-input')?.focus();
}

for (const b of document.querySelectorAll('[data-search-open]')) b.addEventListener('click', open);
document.querySelector('[data-search-close]')?.addEventListener('click', () => dialog.close());
// A click on the backdrop closes the dialog.
dialog.addEventListener('click', (e) => e.target === dialog && dialog.close());
addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault();
    dialog.open ? dialog.close() : open();
  }
});
