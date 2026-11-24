// SPDX-License-Identifier: Apache-2.0
// Theme toggle in the site bar (markup in site-bar.mjs). Each click cycles
// auto -> light -> dark. The choice is stored where Starlight keeps it
// (localStorage starlight-theme, '' for auto), so it carries between the landing page and the docs, and Starlight's own
// theme select in the docs mobile menu stays in sync.
const KEY = 'starlight-theme';
const ORDER = ['auto', 'light', 'dark'];
const light = matchMedia('(prefers-color-scheme: light)');

const stored = () => {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : 'auto';
  } catch {
    return undefined;
  }
};
let choice = stored() ?? 'auto';

function apply() {
  const root = document.documentElement;
  root.dataset.themeChoice = choice;
  root.dataset.theme = choice === 'auto' ? (light.matches ? 'light' : 'dark') : choice;
  for (const b of document.querySelectorAll('.theme-toggle')) {
    b.title = `Theme: ${choice}`;
    b.setAttribute('aria-label', `Theme: ${choice}. Switch theme`);
  }
  window.StarlightThemeProvider?.updatePickers(choice);
}

document.addEventListener('click', (e) => {
  if (!(e.target instanceof Element) || !e.target.closest('.theme-toggle')) return;
  choice = ORDER[(ORDER.indexOf(stored() ?? choice) + 1) % ORDER.length];
  try {
    localStorage.setItem(KEY, choice === 'auto' ? '' : choice);
  } catch {}
  apply();
});
light.addEventListener('change', () => choice === 'auto' && apply());
// Follow Starlight's select in the docs mobile menu, and other tabs.
const sync = () => {
  choice = stored() ?? choice;
  apply();
};
document.addEventListener(
  'change',
  (e) => e.target instanceof Element && e.target.closest('starlight-theme-select') && sync(),
);
addEventListener('storage', (e) => e.key === KEY && sync());
apply();
