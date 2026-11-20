#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
// Assemble the website: the landing page at / and the docs build at /docs/.
// The docs build must use BASE_PATH=/docs/ so its links resolve under /docs/.
// Usage: node scripts/website.mjs site/dist build/website
import fs from 'node:fs';
import path from 'node:path';

const MOUNT = 'docs';
const [docs = 'site/dist', out = 'build/website'] = process.argv.slice(2).map((p) => path.resolve(p));
const repo = path.resolve(import.meta.dirname, '..');

const { base } = JSON.parse(fs.readFileSync(path.join(docs, 'versions.json'), 'utf8'));
if (base !== `/${MOUNT}/`) {
  console.error(`${docs} was built with base ${base}; rebuild it with BASE_PATH=/${MOUNT}/`);
  process.exit(1);
}

fs.rmSync(out, { recursive: true, force: true });
fs.cpSync(path.join(repo, 'landing'), out, { recursive: true });
fs.copyFileSync(path.join(repo, 'theme/tokens.css'), path.join(out, 'tokens.css'));
for (const f of ['favicon.svg', 'apple-touch-icon.png', 'cncf'])
  fs.cpSync(path.join(repo, 'site/static', f), path.join(out, f), { recursive: true });
fs.cpSync(docs, path.join(out, MOUNT), { recursive: true });
// Hosts serve /404.html for any missing path. The docs one links its assets
// absolutely (/docs/_astro/...), so it works at the root too.
fs.copyFileSync(path.join(docs, '404.html'), path.join(out, '404.html'));
console.log(`website -> ${path.relative(process.cwd(), out)} (landing at /, docs at /${MOUNT}/)`);
