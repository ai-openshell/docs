#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
// Write static redirect pages for hosts without redirect rules (GitHub Pages).
// The latest release of each docset is published at /<mount>/<page>, with no
// version segment. Reads <dist>/versions.json (written by the assembler):
//   /                        -> newest OpenShell release, when it has no home page
//   /<mount>/latest/<page>   -> /<mount>/<page>
//   /<mount>/<latest>/<page> -> /<mount>/<page>, so links pinned to the newest
//                               release keep working until the next one ships
//   /<mount>/<version>/      -> that version's first page, when it has no home page
//   /<prefix>/<old page>   -> /<prefix>/<new page>, from `redirects:` in docset.yml
//                             (and Fern section URLs without an overview page)
// Existing pages are never overwritten. A production host would use edge
// rules instead (and could also negotiate Markdown).
// Usage: node scripts/redirects.mjs site/dist
import fs from 'node:fs';
import path from 'node:path';

const dist = path.resolve(process.argv[2] ?? 'site/dist');
const { base, home, docsets } = JSON.parse(fs.readFileSync(path.join(dist, 'versions.json'), 'utf8'));
const join = (...p) => p.filter(Boolean).join('/');
const href = (slug) => base + (slug ? `${slug}/` : '');
let written = 0;
const redirect = (from, to) => {
  const file = path.join(dist, from, 'index.html');
  if (fs.existsSync(file)) return;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const t = JSON.stringify(to);
  fs.writeFileSync(
    file,
    `<!doctype html><meta charset="utf-8"><title>Redirecting</title><meta name="robots" content="noindex">` +
      `<link rel="canonical" href=${t}><meta http-equiv="refresh" content="0; url=${to}">` +
      `<script>location.replace(${t} + location.hash)</script><a href=${t}>${to}</a>\n`,
  );
  written++;
};

redirect('', home);
for (const d of Object.values(docsets)) {
  const latest = d.versions.find((v) => v.name === d.latest);
  for (const alias of ['latest', latest.name]) {
    redirect(join(d.mount, alias), href(latest.pages.includes('') ? latest.prefix : latest.first));
    for (const key of latest.pages) if (key) redirect(join(d.mount, alias, key), href(join(latest.prefix, key)));
  }
  for (const v of d.versions) {
    if (!v.pages.includes('')) redirect(v.prefix, href(v.first));
    for (const [from, to] of Object.entries(v.redirects ?? {}))
      redirect(join(v.prefix, from), href(join(v.prefix, to)));
  }
}
console.log(`wrote ${written} redirect pages`);
