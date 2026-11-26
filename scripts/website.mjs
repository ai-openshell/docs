#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
// Assemble the website: the files in website/ at / and the docs build at /docs/.
// website/index.html is the landing page. Each other website/<name>.md is rendered
// into the landing page's shell (header, footer, scripts) at /<name>/, with
// its Markdown copy at /<name>.md, like the docs pages. /llms.txt links the
// docs index and lists the website pages.
// The docs build must use BASE_PATH=<root>docs/ so its links resolve under
// <root>docs/. The root is / on Netlify and /<repo>/ on GitHub Pages; links in
// the website pages are written from / and get the root prepended here.
// Usage: node scripts/website.mjs docs/dist build/website
import fs from 'node:fs';
import path from 'node:path';
import * as pagefind from 'pagefind';
import rehypeStringify from 'rehype-stringify';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';
import YAML from 'yaml';
import { siteBar } from '../theme/site-bar.mjs';

const MOUNT = 'docs';
const [docs = 'docs/dist', out = 'build/website'] = process.argv.slice(2).map((p) => path.resolve(p));
const repo = path.resolve(import.meta.dirname, '..');
const pagesDir = path.join(repo, 'website');

const { base } = JSON.parse(fs.readFileSync(path.join(docs, 'versions.json'), 'utf8'));
if (!base.endsWith(`/${MOUNT}/`)) {
  console.error(`${docs} was built with base ${base}; rebuild it with BASE_PATH=<root>${MOUNT}/, such as /${MOUNT}/`);
  process.exit(1);
}
const root = base.slice(0, -`${MOUNT}/`.length);
// Root-relative links and assets in the website pages, served under root.
const rooted = (html) => (root === '/' ? html : html.replace(/(\s(?:href|src)=")\/(?!\/)/g, `$1${root}`));

fs.rmSync(out, { recursive: true, force: true });
fs.cpSync(pagesDir, out, {
  recursive: true,
  filter: (f) => path.extname(f) !== '.md' && !f.startsWith(path.join(pagesDir, 'icons')),
});
for (const f of ['tokens.css', 'site-bar.css', 'search.js', 'theme-toggle.js'])
  fs.copyFileSync(path.join(repo, 'theme', f), path.join(out, f));
for (const f of ['favicon.svg', 'apple-touch-icon.png', 'cncf'])
  fs.cpSync(path.join(repo, 'docs/static', f), path.join(out, f), { recursive: true });
fs.cpSync(docs, path.join(out, MOUNT), { recursive: true });
// Hosts serve /404.html for any missing path. The docs one links its assets
// absolutely (<root>docs/_astro/...), so it works at the root too.
fs.copyFileSync(path.join(docs, '404.html'), path.join(out, '404.html'));

const htmlEscape = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const swap = (html, re, to, what) => {
  if (!re.test(html)) throw new Error(`website/index.html has no ${what}`);
  return html.replace(re, () => to);
};

// The site bar (theme/site-bar.mjs), the same one the docs header renders.
// Search covers the docs index and the website pages' index written below.
const withNav = (html, current) =>
  swap(
    html,
    /<!-- site-bar -->/,
    siteBar({
      root,
      current,
      search: { bundlePath: `${base}pagefind/`, baseUrl: base, merge: `${root}pagefind-website/` },
    }),
    '<!-- site-bar --> placeholder',
  );

// The landing page.
const shell = fs.readFileSync(path.join(pagesDir, 'index.html'), 'utf8');
fs.writeFileSync(path.join(out, 'index.html'), withNav(rooted(shell), root));

// Markdown pages.
const render = unified().use(remarkParse).use(remarkGfm).use(remarkRehype).use(rehypeStringify);
// Icon shortcodes: :name: in a website/*.md page becomes website/icons/<name>.svg in
// the HTML, and is dropped from the Markdown copy.
const ICON = /:([a-z][a-z0-9-]*):/g;
// Links to other sites, such as GitHub and Slack, open in a new tab.
const EXTERNAL = /(<a href="https?:\/\/[^"]*")/g;
const icon = (name) => {
  const f = path.join(pagesDir, 'icons', `${name}.svg`);
  if (!fs.existsSync(f)) throw new Error(`no icon website/icons/${name}.svg for :${name}:`);
  return fs
    .readFileSync(f, 'utf8')
    .replace(/<!--[\s\S]*?-->\s*/g, '')
    .trim();
};
const pages = fs.readdirSync(pagesDir).filter((f) => f.endsWith('.md'));
const rendered = [];
const listed = [];
for (const file of pages) {
  const name = path.basename(file, '.md');
  const src = fs.readFileSync(path.join(pagesDir, file), 'utf8');
  const m = src.match(/^---\n([\s\S]*?)\n---\n/);
  const meta = m ? YAML.parse(m[1]) : {};
  if (!meta?.title || !meta.description)
    throw new Error(`website/${file} needs a title and description in its front matter`);
  const body = src.slice(m[0].length).trim();
  const main = `<main class="page" data-pagefind-body data-pagefind-meta="section:${htmlEscape(meta.title)}">\n<h1>${htmlEscape(meta.title)}</h1>\n${String(
    render.processSync(body),
  )
    .replace(ICON, (_, n) => icon(n))
    .replace(EXTERNAL, '$1 target="_blank" rel="noopener"')}\n</main>`;
  let html = swap(shell, /<title>[^<]*<\/title>/, `<title>${htmlEscape(meta.title)} · OpenShell</title>`, '<title>');
  html = swap(
    html,
    /<meta name="description" content="[^"]*" \/>/,
    `<meta name="description" content="${htmlEscape(meta.description)}" />`,
    'description meta tag',
  );
  // Agents that fetch the HTML find the page's Markdown copy, as on the docs pages.
  html = swap(
    html,
    /<link rel="alternate" type="text\/markdown" [^>]*\/>/,
    `<link rel="alternate" type="text/markdown" href="/${name}.md" />`,
    'Markdown alternate link',
  );
  html = withNav(rooted(swap(html, /<main>[\s\S]*<\/main>/, main, '<main>')), `${root}${name}/`);
  fs.mkdirSync(path.join(out, name), { recursive: true });
  fs.writeFileSync(path.join(out, name, 'index.html'), html);
  // Pagefind URLs are relative to the index's baseUrl (the root, see search.js).
  rendered.push([`/${name}/`, html]);
  fs.writeFileSync(path.join(out, `${name}.md`), `# ${meta.title}\n\n${body.replace(/:[a-z][a-z0-9-]*: /g, '')}\n`);
  listed.push(`- [${meta.title}](${root}${name}.md): ${meta.description}`);
}

// /llms.txt: a link to the docs index (/docs/llms.txt) and the website pages.
// The docs index lists every docs page, so this one stays short as docsets grow.
const description = shell.match(/<meta name="description" content="([^"]*)" \/>/)?.[1];
if (!description) throw new Error('website/index.html has no description meta tag');
if (!fs.existsSync(path.join(docs, 'llms.txt'))) throw new Error(`${docs} has no llms.txt`);
fs.writeFileSync(
  path.join(out, 'llms.txt'),
  [
    '# OpenShell',
    '',
    `> ${description}`,
    '',
    'Every page is also available as Markdown at its URL plus .md.',
    '',
    '## Docs',
    '',
    `- [OpenShell documentation](${base}llms.txt): Index of every docs page, latest release of each docset first.`,
    '',
    '## Website',
    '',
    ...listed,
    '',
  ].join('\n'),
);

// Search: index the Markdown pages into <root>pagefind-website/, which the site
// bar's search merges with the docs index (theme/search.js).
const { index } = await pagefind.createIndex();
for (const [url, content] of rendered) await index.addHTMLFile({ url, content });
await index.writeFiles({ outputPath: path.join(out, 'pagefind-website') });
await pagefind.close();

console.log(
  `website -> ${path.relative(process.cwd(), out)} (landing at ${root}, ${pages.length} Markdown pages, docs at ${base})`,
);
