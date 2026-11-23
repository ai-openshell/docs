// SPDX-License-Identifier: Apache-2.0

// @ts-check

import starlight from '@astrojs/starlight';
import { defineConfig } from 'astro/config';
import siteNav from '../theme/nav.json' with { type: 'json' };

// BASE_PATH is the path the site is served under (GitHub Pages: /<repo>/).
export default defineConfig({
  site: process.env.SITE_URL ?? 'https://ai-openshell.github.io',
  base: process.env.BASE_PATH ?? '/',
  trailingSlash: 'always',
  integrations: [
    starlight({
      title: 'OpenShell',
      description: 'The safe, private runtime for autonomous AI agents.',
      favicon: '/favicon.svg',
      social: [{ icon: 'github', label: 'GitHub', href: siteNav.github }],
      customCss: ['./src/styles/tokens.css', './src/styles/site-bar.css', './src/styles/theme.css'],
      head: [
        // Mark the stored theme choice before paint so the header's theme toggle
        // (theme/site-bar.mjs) shows the right icon; Starlight sets data-theme.
        {
          tag: 'script',
          content:
            "try{const t=localStorage.getItem('starlight-theme');document.documentElement.dataset.themeChoice=t==='light'||t==='dark'?t:'auto'}catch{}",
        },
        {
          tag: 'link',
          attrs: { rel: 'apple-touch-icon', href: `${process.env.BASE_PATH ?? '/'}apple-touch-icon.png` },
        },
        { tag: 'link', attrs: { rel: 'preconnect', href: 'https://fonts.googleapis.com' } },
        { tag: 'link', attrs: { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' } },
        {
          tag: 'link',
          attrs: {
            rel: 'stylesheet',
            href: 'https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500&display=swap',
          },
        },
      ],
      components: {
        Header: './src/components/overrides/Header.astro',
        Sidebar: './src/components/overrides/Sidebar.astro',
        PageTitle: './src/components/overrides/PageTitle.astro',
        Footer: './src/components/overrides/Footer.astro',
      },
      expressiveCode: {
        themes: ['github-dark-default', 'github-light'],
        styleOverrides: {
          borderRadius: 'var(--os-radius)',
          borderColor: 'var(--os-border)',
          codeFontFamily: 'var(--os-font-mono)',
          uiFontFamily: 'var(--os-font-sans)',
          codeFontSize: '0.8125rem',
          codeBackground: 'var(--os-surface)',
          frames: {
            shadowColor: 'transparent',
            editorTabBarBackground: 'var(--os-surface)',
            terminalTitlebarBackground: 'var(--os-surface)',
            terminalTitlebarBorderBottomColor: 'var(--os-border)',
            terminalBackground: 'var(--os-surface)',
            terminalTitlebarDotsOpacity: '0.35',
          },
        },
      },
      // Sidebar, pagination, topic tabs and the version picker all follow the
      // version context of the current page; see src/versioning.ts.
      routeMiddleware: './src/routeData.ts',
      // Starlight builds the Pagefind index; the site bar's search
      // (theme/search.js) shows it instead of Starlight's search box.
      pagefind: true,
    }),
  ],
});
