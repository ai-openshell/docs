#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
// Assemble the website: the files in www/ at / and the docs build at /docs/.
// www/index.html is the landing page. Each other www/<name>.md is rendered
// into the landing page's shell (header, footer, scripts) at /<name>/, with
// its Markdown copy at /<name>.md, like the docs pages.
// The docs build must use BASE_PATH=/docs/ so its links resolve under /docs/.
// Usage: node scripts/website.mjs site/dist build/website
import fs from 'node:fs';
import path from 'node:path';
import rehypeStringify from 'rehype-stringify';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';
import YAML from 'yaml';

const MOUNT = 'docs';
const [docs = 'site/dist', out = 'build/website'] = process.argv.slice(2).map((p) => path.resolve(p));
const repo = path.resolve(import.meta.dirname, '..');
const www = path.join(repo, 'www');

const { base } = JSON.parse(fs.readFileSync(path.join(docs, 'versions.json'), 'utf8'));
if (base !== `/${MOUNT}/`) {
  console.error(`${docs} was built with base ${base}; rebuild it with BASE_PATH=/${MOUNT}/`);
  process.exit(1);
}

fs.rmSync(out, { recursive: true, force: true });
fs.cpSync(www, out, { recursive: true, filter: (f) => path.extname(f) !== '.md' });
fs.copyFileSync(path.join(repo, 'theme/tokens.css'), path.join(out, 'tokens.css'));
for (const f of ['favicon.svg', 'apple-touch-icon.png', 'cncf'])
  fs.cpSync(path.join(repo, 'site/static', f), path.join(out, f), { recursive: true });
fs.cpSync(docs, path.join(out, MOUNT), { recursive: true });
// Hosts serve /404.html for any missing path. The docs one links its assets
// absolutely (/docs/_astro/...), so it works at the root too.
fs.copyFileSync(path.join(docs, '404.html'), path.join(out, '404.html'));

const htmlEscape = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const swap = (html, re, to, what) => {
  if (!re.test(html)) throw new Error(`www/index.html has no ${what}`);
  return html.replace(re, () => to);
};

// The header links come from theme/nav.json, which the docs header also reads.
const nav = JSON.parse(fs.readFileSync(path.join(repo, 'theme/nav.json'), 'utf8'));
const withNav = (html, current) => {
  const links = nav.links
    .map(
      (l) =>
        `<a href="${htmlEscape(l.href)}" class="nav-link"${l.href === current ? ' aria-current="page"' : ''}>${htmlEscape(l.label)}</a>`,
    )
    .join('');
  html = swap(html, /<!-- nav-links -->/, links, '<!-- nav-links --> placeholder');
  return swap(html, /\{\{github\}\}/, htmlEscape(nav.github), '{{github}} placeholder');
};

// The landing page.
const shell = fs.readFileSync(path.join(www, 'index.html'), 'utf8');
fs.writeFileSync(path.join(out, 'index.html'), withNav(shell, '/'));

// Markdown pages.
const render = unified().use(remarkParse).use(remarkGfm).use(remarkRehype).use(rehypeStringify);
const pages = fs.readdirSync(www).filter((f) => f.endsWith('.md'));
for (const file of pages) {
  const name = path.basename(file, '.md');
  const src = fs.readFileSync(path.join(www, file), 'utf8');
  const m = src.match(/^---\n([\s\S]*?)\n---\n/);
  const meta = m ? YAML.parse(m[1]) : {};
  if (!meta?.title || !meta.description)
    throw new Error(`www/${file} needs a title and description in its front matter`);
  const body = src.slice(m[0].length).trim();
  const main = `<main class="page">\n<h1>${htmlEscape(meta.title)}</h1>\n${String(render.processSync(body))}\n</main>`;
  let html = swap(shell, /<title>[^<]*<\/title>/, `<title>${htmlEscape(meta.title)} · OpenShell</title>`, '<title>');
  html = swap(
    html,
    /<meta name="description" content="[^"]*" \/>/,
    `<meta name="description" content="${htmlEscape(meta.description)}" />`,
    'description meta tag',
  );
  html = withNav(swap(html, /<main>[\s\S]*<\/main>/, main, '<main>'), `/${name}/`);
  fs.mkdirSync(path.join(out, name), { recursive: true });
  fs.writeFileSync(path.join(out, name, 'index.html'), html);
  fs.writeFileSync(path.join(out, `${name}.md`), `# ${meta.title}\n\n${body}\n`);
}

console.log(
  `website -> ${path.relative(process.cwd(), out)} (landing at /, ${pages.length} Markdown pages, docs at /${MOUNT}/)`,
);
