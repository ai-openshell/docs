// SPDX-License-Identifier: Apache-2.0
// Search for the site bar (site-bar.mjs), on every page. The dialog's data
// attributes say which Pagefind index to search (data-bundle, data-base-url)
// and, on the full website, which index to merge (data-merge: the website
// pages in <root>pagefind-website/, and data-merge-base-url: their root). The Pagefind UI loads on first open.
const dialog = document.querySelector('.search-dialog');
const container = dialog?.querySelector('#site-search');
const kbd = document.querySelector('.search-button__kbd');
if (kbd && /Mac|iPhone|iPad/.test(navigator.platform)) kbd.textContent = '⌘ K';

// Starlight's default ranking, so results rank as they did with its search.
const ranking = { pageLength: 0.1, termFrequency: 0.1, termSaturation: 2, termSimilarity: 9, diacriticSimilarity: 0.8 };

let ready;
const load = () =>
  (ready ??= new Promise((resolve, reject) => {
    const { bundle, baseUrl, merge, mergeBaseUrl } = dialog.dataset;
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = `${bundle}pagefind-ui.css`;
    document.head.append(css);
    const js = document.createElement('script');
    js.src = `${bundle}pagefind-ui.js`;
    js.onload = () => {
      new window.PagefindUI({
        element: '#site-search',
        bundlePath: bundle,
        baseUrl,
        // Website pages count half, so a short page doesn't outrank the docs.
        mergeIndex: merge ? [{ bundlePath: merge, baseUrl: mergeBaseUrl, indexWeight: 0.5, ranking }] : [],
        showSubResults: true,
        showImages: false,
        ranking,
      });
      resolve();
    };
    js.onerror = reject;
    document.head.append(js);
  }));

// Pagefind lists extra metadata as "Section: Go SDK" tags; show just the value,
// as a label next to the result title.
if (container)
  new MutationObserver(() => {
    for (const tag of container.querySelectorAll('.pagefind-ui__result-tag[data-pagefind-ui-meta="section"]')) {
      const value = tag.textContent.replace(/^Section:\s*/, '');
      if (tag.textContent !== value) tag.textContent = value;
    }
  }).observe(container, { childList: true, subtree: true, characterData: true });

async function open() {
  if (dialog.open) return;
  dialog.showModal();
  await load();
  dialog.querySelector('.pagefind-ui__search-input')?.focus();
}

if (dialog) {
  // Arrow keys move between the search field and the results (pages, their
  // sections, and the "Load more" button); Enter opens the focused result.
  dialog.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const input = dialog.querySelector('.pagefind-ui__search-input');
    const items = [...dialog.querySelectorAll('.pagefind-ui__result-link, .pagefind-ui__button')];
    if (!items.length) return;
    const i = items.indexOf(document.activeElement);
    const next = e.key === 'ArrowDown' ? items[Math.min(i + 1, items.length - 1)] : i <= 0 ? input : items[i - 1];
    e.preventDefault();
    next.focus();
    next
      .closest('.pagefind-ui__result-nested, .pagefind-ui__result-inner, .pagefind-ui__button')
      ?.scrollIntoView({ block: 'nearest' });
  });
  for (const b of document.querySelectorAll('[data-search-open]')) b.addEventListener('click', open);
  dialog.querySelector('[data-search-close]')?.addEventListener('click', () => dialog.close());
  // A click on the backdrop closes the dialog; Esc closes it natively.
  dialog.addEventListener('click', (e) => e.target === dialog && dialog.close());
  addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      dialog.open ? dialog.close() : open();
    }
  });
}
