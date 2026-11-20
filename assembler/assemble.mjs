#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
// Assemble the OpenShell docs from several repos.
//
// Full build (reads sources.yml):
//   node assembler/assemble.mjs [--base /docs/] [--local core=../OpenShell]
//     [--sources sources.yml] [--out build/assembled] [--cache .cache/sources]
//
//   1. Resolves every listed ref (release tags, plus each source's `dev`
//      branch) to a commit and fetches only the docs directory at that commit
//      (cached by commit in .cache/sources/). Nothing is copied into this repo.
//   2. Reads each checkout in its own format (adapters.mjs): native
//      docset.yml, Fern index.yml or mdBook SUMMARY.md.
//   3. Publishes each source's latest release under /<mount>/ and every other
//      version under /<mount>/<version>/, rewrites and checks every link, and
//      writes the site inputs, Markdown for agents, llms.txt and the host's
//      alias table.
//
// Links: root-relative links (/how-it-works/x) stay in their release.
// repo://path links (core://about/installation) go to the target's latest
// release, or to its dev version from a dev page. Problems in a fetched
// version, dev branches included, only warn, and the link falls back to the
// page or the release's first page: the site build must never be blocked by
// another repo. Problems in a --local checkout (a repo checking its own
// change) or in this repo's own pages fail the build.
//
// Output (build/assembled/):
//   content/**        pages for the site generator
//   public/**         assets, Markdown pages (<slug>.md), llms.txt,
//                     versions.json
//   nav.json          topics, docsets, versions and each version's sidebar
//   pages.json        every page with its docset and version
//   sources.lock.json the commit each version was built from

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import GithubSlugger from 'github-slugger';
import remarkFrontmatter from 'remark-frontmatter';
import remarkGfm from 'remark-gfm';
import remarkMdx from 'remark-mdx';
import remarkParse from 'remark-parse';
import remarkStringify from 'remark-stringify';
import { unified } from 'unified';
import { visit } from 'unist-util-visit';
import YAML from 'yaml';
import { join, pageKey, parseFrontmatter, read } from './adapters.mjs';
import { checkout } from './fetch.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const argv = process.argv.slice(2);
const args = {};
const locals = {};
for (let i = 0; i < argv.length; i++) {
  if (!argv[i].startsWith('--')) continue;
  const k = argv[i].slice(2);
  const v = argv[i + 1];
  if (k === 'local') {
    const [id, p] = v.split('=');
    locals[id] = path.resolve(p);
  } else args[k] = v;
  i++;
}
const out = path.resolve(args.out ?? path.join(root, 'build', 'assembled'));
const cache = path.resolve(args.cache ?? path.join(root, '.cache/sources'));
const BASE = `/${args.base ?? process.env.BASE_PATH ?? '/'}/`.replace(/\/+/g, '/');
const url = (slug, hash = '') => `${BASE}${slug ? `${slug}/` : ''}${hash}`;
const errors = [];
const warnings = [];
fs.rmSync(out, { recursive: true, force: true });

// ---------- 0. what to build ----------
const manifest = YAML.parse(fs.readFileSync(path.resolve(args.sources ?? path.join(root, 'sources.yml')), 'utf8'));
const allIds = Object.keys(manifest.sources);

// One entry per (source, version). dev (if any) first, then releases newest first.
// latest = the newest release; a docset with only a dev version uses dev.
const wanted = [];
for (const [id, src] of Object.entries(manifest.sources)) {
  if (src.dev) {
    const local = locals[id];
    wanted.push({
      id,
      src,
      name: 'dev',
      dev: true,
      repo: src.dev.repo ?? src.repo,
      ref: src.dev.ref,
      subdir: src.dev.path ?? src.path,
      local,
    });
  }
  for (const v of src.versions)
    wanted.push({
      id,
      src,
      name: v.name ?? v.ref.replace(/^v/, ''),
      dev: false,
      repo: v.repo ?? src.repo,
      ref: v.ref,
      subdir: v.path ?? src.path,
    });
  const own = wanted.filter((w) => w.id === id);
  (own.find((w) => !w.dev) ?? own[0]).latest = true;
}

// ---------- 1. fetch ----------
const t0 = Date.now();
await Promise.all(
  wanted.map(async (w) => {
    if (w.local) {
      w.dir = path.join(w.local, w.subdir);
      w.sha = 'working-tree';
    } else Object.assign(w, await checkout(w, cache));
  }),
);
console.log(`fetched ${wanted.length} versions in ${((Date.now() - t0) / 1000).toFixed(1)}s`);

// ---------- 2. read ----------
const parserMdx = unified().use(remarkParse).use(remarkMdx).use(remarkGfm).use(remarkFrontmatter);
const parserMd = unified().use(remarkParse).use(remarkGfm).use(remarkFrontmatter);
const textOf = (n) =>
  n.type === 'text' || n.type === 'inlineCode' ? n.value : (n.children ?? []).map(textOf).join('');
// Apply fn to the parts of a page outside code (fenced blocks and inline code).
const outsideCode = (body, fn) =>
  body
    .split(/(^[ \t]*(?:```|~~~)[^\n]*\n[\s\S]*?^[ \t]*(?:```|~~~)[ \t]*$|`[^`\n]+`)/m)
    .map((part, i) => (i % 2 ? part : fn(part)))
    .join('');
// Fern's custom heading ids ("## Title {#id}") aren't MDX: keep the id as an anchor.
const fernIds = (body, ids = []) =>
  outsideCode(body, (part) =>
    part.replace(/^(#{1,6}\s.*?)\s*\{#([\w-]+)\}\s*$/gm, (_, h, id) => {
      ids.push(id);
      return `${h} <a id="${id}"></a>`;
    }),
  );
// Heading ids, as Astro/Starlight generate them (github-slugger).
function anchorsOf(body, ext) {
  const slugger = new GithubSlugger();
  const ids = [];
  try {
    visit((ext === 'md' ? parserMd : parserMdx).parse(body), 'heading', (h) => {
      ids.push(slugger.slug(textOf(h)));
    });
  } catch {
    for (const m of body.matchAll(/^#{1,6}\s+(.*)$/gm)) ids.push(slugger.slug(m[1].replace(/`/g, '')));
  }
  return ids;
}

const releases = [];
const releasesOf = Object.fromEntries(allIds.map((id) => [id, []]));
const pages = [];
const bySlug = new Map();
const strict = (rel) => !!(rel.local || rel.strict);
const report = (rel, msg) => (strict(rel) ? errors : warnings).push(`${rel.name}: ${msg}`);
for (const w of wanted) {
  const name = `${w.id}@${w.name}`;
  const problems = [];
  let docs;
  try {
    docs = read(w.dir, problems);
  } catch (e) {
    errors.push(`${name}: ${e.message}`);
    continue;
  }
  const rel = {
    id: w.id,
    version: w.name,
    dev: w.dev,
    latest: !!w.latest,
    local: !!w.local,
    ref: w.ref,
    sha: w.sha,
    repo: w.repo,
    path: w.subdir,
    mount: w.src.mount,
    // The latest release has no version segment, so /<mount>/<page> always
    // shows the newest docs without a redirect.
    prefix: w.latest ? w.src.mount : join(w.src.mount, w.name),
    name,
    format: docs.format,
    title: docs.meta.title ?? w.src.title ?? w.id,
    description: docs.meta.description ?? w.src.description,
    redirects: docs.meta.redirects ?? {},
    nav: docs.nav,
    pages: [],
    assets: new Set(docs.assets),
  };
  for (const p of problems) report(rel, p);
  const seen = new Set();
  for (const p of docs.pages) {
    if (seen.has(p.key)) {
      report(rel, `two pages publish at "${p.key}"; keeping the first`);
      continue;
    }
    seen.add(p.key);
    const ids = [];
    p.body = fernIds(p.body, ids);
    const page = { ...p, rel, slug: join(rel.prefix, p.key), anchors: [...anchorsOf(p.body, p.ext), ...ids] };
    // The latest release shares /<mount>/ with the version directories, so a
    // page there can take another version's URL (a page named "dev/...").
    const taken = bySlug.get(page.slug);
    if (taken) {
      errors.push(`${name}: ${p.relPath} publishes at /${page.slug}, already used by ${taken.rel.name}`);
      continue;
    }
    bySlug.set(page.slug, page);
    page.data.title ??= p.label ?? p.key;
    pages.push(page);
    rel.pages.push(page);
  }
  for (const a of rel.assets) {
    const dest = path.join(out, 'public', rel.prefix, a);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(path.join(w.dir, a), dest);
  }
  releases.push(rel);
  releasesOf[w.id].push(rel);
}
const latestOf = (id) => releasesOf[id].find((r) => r.latest) ?? releasesOf[id][0];
const devOf = (id) => releasesOf[id].find((r) => r.dev);

// ---------- 3. links ----------
function firstOf(rel) {
  const walkNav = (items) => {
    for (const it of items) {
      if (it.type === 'page') return join(rel.prefix, it.key);
      const s = it.items && walkNav(it.items);
      if (s !== undefined) return s;
    }
  };
  return walkNav(rel.nav) ?? rel.prefix;
}
function checked(slug, anchor, original, page, rel) {
  const t = bySlug.get(slug);
  const soft = !strict(page.rel);
  if (!t) {
    const msg = `${page.relPath}: broken link "${original}" -> /${slug}`;
    if (!soft) {
      errors.push(`${page.rel.name}: ${msg}`);
      return original;
    }
    warnings.push(`${page.rel.name}: ${msg}; using the first page of ${rel.name}`);
    return url(firstOf(rel));
  }
  if (anchor && !t.anchors.includes(anchor)) {
    const msg = `${page.relPath}: missing heading "${original}" -> /${slug}#${anchor}`;
    if (!soft) errors.push(`${page.rel.name}: ${msg}`);
    else warnings.push(`${page.rel.name}: ${msg}; linking the page`);
    return url(slug);
  }
  return url(slug, anchor ? `#${anchor}` : '');
}
function resolveLink(raw, page) {
  if (/^(https?:|mailto:|tel:|data:|#|\/\/)/i.test(raw)) return raw;
  const [p, anchor] = raw.split('#');
  const rel = page.rel;
  const scheme = p.match(/^([a-z0-9-]+):\/\/(.*)$/);
  if (scheme) {
    const [, id, rest] = scheme;
    if (!releasesOf[id]?.length) {
      report(rel, `${page.relPath}: unknown docset in "${raw}"`);
      return raw;
    }
    const t = id === rel.id ? rel : (rel.dev && devOf(id)) || latestOf(id);
    const key = t.redirects?.[pageKey(rest)] ?? pageKey(rest);
    return checked(join(t.prefix, key), anchor, raw, page, t);
  }
  if (p.startsWith('/')) {
    const key = pageKey(p.slice(1).replace(/\/$/, ''));
    return checked(join(rel.prefix, rel.redirects[key] ?? key), anchor, raw, page, rel);
  }
  if (!p) return raw;
  // relative to the page's file
  const abs = path.posix.normalize(path.posix.join(path.posix.dirname(page.relPath), p));
  if (!/\.mdx?$/.test(abs) && /\.[a-z0-9]+$/i.test(abs)) {
    if (!rel.assets.has(abs)) report(rel, `${page.relPath}: missing file "${raw}"`);
    return BASE + join(rel.prefix, abs);
  }
  const byFile = rel.pages.find((x) => x.relPath.replace(/\.mdx?$/, '') === abs.replace(/\.mdx?$/, ''));
  return checked(join(rel.prefix, byFile ? byFile.key : pageKey(abs)), anchor, raw, page, rel);
}
const rewrite = (body, fn) =>
  outsideCode(body, (part) =>
    part
      .replace(/\]\(([^)\s*[\]{}]+)\)/g, (_, t) => `](${fn(t)})`)
      .replace(/\b(href|src)="([^"]+)"/g, (_, a, t) => `${a}="${fn(t)}"`),
  );
for (const page of pages) page.body = rewrite(page.body, (t) => resolveLink(t, page));

// ---------- 4. site content ----------
// <llms-only> blocks exist only in the Markdown output; <llms-ignore> only on the site.
const siteBody = (body) =>
  body
    .replace(/<llms-only>[\s\S]*?<\/llms-only>\n?/g, '')
    .replace(/<\/?llms-ignore>\n?/g, '')
    // Fern-era pages import their custom components; the site provides them
    .replace(/^import\s+[^;\n]*from\s+["']\.[^"']*_components[^"']*["'];?\s*$/gm, '');
const writeFile = (rel, text) => {
  const dest = path.join(out, rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, text);
};
for (const page of pages) {
  const { rel } = page;
  const fm = {
    title: String(page.data.title),
    description: page.data.description,
    docset: rel.id,
    version: rel.version,
    source: `${rel.repo}@${rel.ref} (${String(rel.sha).slice(0, 12)}):${rel.path}/${page.relPath}`,
  };
  for (const k of Object.keys(fm)) if (fm[k] === undefined) delete fm[k];
  page.outRel = `${page.key ? page.slug : join(rel.prefix, 'index')}.${page.ext}`;
  writeFile(path.join('content', page.outRel), `---\n${YAML.stringify(fm)}---\n${siteBody(page.body)}`);
}

// "Edit this page": the same page on the source's dev branch (a tag can't be
// edited, and fixes land on the branch). No link when the dev branch no longer
// has the page.
function editUrl(page) {
  const dev = devOf(page.rel.id);
  if (!dev || !/^[\w.-]+\/[\w.-]+$/.test(dev.repo)) return undefined;
  const same = dev.pages.find((x) => x.key === page.key);
  return same && `https://github.com/${dev.repo}/edit/${dev.ref}/${join(dev.path, same.relPath)}`;
}

// ---------- 5. nav.json + pages.json ----------
const navItems = (items, rel) =>
  items.map((it) =>
    it.type === 'group'
      ? { type: 'group', label: it.label, items: navItems(it.items, rel) }
      : it.type === 'link'
        ? { type: 'link', label: it.label, href: it.href }
        : { type: 'page', label: it.label, slug: join(rel.prefix, it.key) },
  );
const versionEntry = (rel) => ({
  name: rel.version,
  ref: rel.ref,
  sha: rel.sha,
  prefix: rel.prefix,
  latest: !!rel.latest,
  dev: !!rel.dev,
  first: firstOf(rel),
  redirects: rel.redirects,
  pages: rel.pages.map((p) => p.key),
  items: navItems(rel.nav, rel),
});
const docsets = {};
for (const id of allIds) {
  const rels = releasesOf[id];
  if (!rels.length) continue;
  const latest = latestOf(id);
  docsets[id] = {
    title: latest.title,
    description: latest.description,
    mount: latest.mount,
    repo: rels[0].repo,
    path: manifest.sources[id].path,
    latest: latest.version,
    versions: rels.map(versionEntry),
  };
}

// Topic overview pages (/sdks/, /drivers/): an optional hand-written intro
// from the site repo, then one card per docset linking its latest release.
// A topic gets one when it has a description or several docsets; otherwise
// its tab goes straight to its only docset (Core).
const landings = [];
function introFor(t) {
  if (!t.intro) return '';
  const file = path.join(root, t.intro);
  if (!fs.existsSync(file)) {
    errors.push(`topic ${t.id}: intro ${t.intro} not found`);
    return '';
  }
  const page = {
    rel: { id: 'site', version: 'topics', name: `topic ${t.id}`, strict: true, redirects: {} },
    relPath: t.intro,
    key: t.id,
  };
  return rewrite(parseFrontmatter(fs.readFileSync(file, 'utf8')).body.trim(), (x) => {
    if (/^(https?:|mailto:|#)/.test(x)) return x;
    if (!/^[a-z0-9-]+:\/\//.test(x)) {
      errors.push(`${t.intro}: link "${x}" must be a repo:// link`);
      return x;
    }
    return resolveLink(x, page);
  });
}
for (const t of manifest.topics) {
  if (!t.description && t.sources.length < 2) continue;
  const intro = introFor(t);
  const cards = t.sources.map((id) => {
    const d = docsets[id];
    const latest = d.versions.find((v) => v.name === d.latest);
    return `<Card title="${d.title}" href="${url(latest.first)}">\n\n${d.description ?? ''}\n\nLatest: ${latest.name}\n\n</Card>`;
  });
  const body = [
    ...(intro ? [intro, `## Available ${/^[A-Z][a-z]/.test(t.label) ? t.label.toLowerCase() : t.label}`] : []),
    `<Cards>\n\n${cards.join('\n\n')}\n\n</Cards>`,
  ].join('\n\n');
  if (bySlug.has(t.id))
    errors.push(`topic ${t.id}: its overview page /${t.id}/ is already used by ${bySlug.get(t.id).rel.name}`);
  const outRel = `${t.id}/index.mdx`;
  writeFile(
    path.join('content', outRel),
    `---\n${YAML.stringify({ title: t.label, description: t.description })}---\n${body}\n`,
  );
  landings.push({ topic: t.id, slug: t.id, outRel, title: t.label, description: t.description, body });
}
const landingOf = (t) => landings.find((l) => l.topic === t.id)?.slug;
const nav = {
  title: manifest.site.title,
  base: BASE,
  topics: manifest.topics.map((t) => ({ id: t.id, label: t.label, sources: t.sources, landing: landingOf(t) })),
  docsets,
};
writeFile('nav.json', JSON.stringify(nav, null, 2));
writeFile(
  'pages.json',
  JSON.stringify(
    pages
      .map((p) => ({
        slug: p.slug,
        file: p.outRel,
        title: p.data.title,
        source: p.rel.id,
        version: p.rel.version,
        latest: !!p.rel.latest,
        dev: !!p.rel.dev,
        key: p.key,
        edit: editUrl(p),
      }))
      .concat(
        landings.map((l) => ({
          slug: l.slug,
          file: l.outRel,
          title: l.title,
          source: null,
          topic: l.topic,
          latest: true,
          key: '',
        })),
      ),
    null,
    2,
  ),
);
writeFile(
  'sources.lock.json',
  JSON.stringify(
    Object.fromEntries(
      releases.map((r) => [r.name, { repo: r.repo, ref: r.ref, sha: r.sha, path: r.path, format: r.format }]),
    ),
    null,
    2,
  ),
);

// ---------- 6. Markdown for agents ----------
const attr = (node, name) => {
  const a = node.attributes?.find((x) => x.name === name);
  if (!a) return undefined;
  if (a.value === null) return true;
  return typeof a.value === 'string' ? a.value : a.value?.value;
};
const text = (value) => ({ type: 'text', value });
const strong = (...children) => ({ type: 'strong', children });
const para = (...children) => ({ type: 'paragraph', children });
const CALLOUTS = { Note: 'Note', Tip: 'Tip', Info: 'Info', Warning: 'Warning', Error: 'Danger', Check: 'Check' };
function convert(node, where) {
  if (!node.children) return [node];
  node.children = node.children.flatMap((c) => convert(c, where));
  if (node.type === 'mdxjsEsm' || node.type === 'mdxFlowExpression') return [];
  if (node.type !== 'mdxJsxFlowElement' && node.type !== 'mdxJsxTextElement') return [node];
  const kids = node.children;
  if (CALLOUTS[node.name]) {
    const title = attr(node, 'title');
    const label = strong(text(title ? `${CALLOUTS[node.name]}: ${title}` : `${CALLOUTS[node.name]}:`));
    const [first, ...rest] = kids;
    return [
      {
        type: 'blockquote',
        children:
          first?.type === 'paragraph' ? [para(label, text(' '), ...first.children), ...rest] : [para(label), ...kids],
      },
    ];
  }
  switch (node.name) {
    case 'Tabs':
    case 'Steps':
    case 'AccordionGroup':
    case 'llms-only':
    case 'div':
    case 'span':
      return kids;
    case 'Tab':
    case 'Accordion':
      return [para(strong(text(attr(node, 'title') ?? ''))), ...kids];
    case 'Cards':
      return [{ type: 'list', ordered: false, spread: false, children: kids.filter((k) => k.type === 'listItem') }];
    case 'Card': {
      const desc = kids
        .filter((k) => k.type === 'paragraph')
        .map(textOf)
        .join(' ')
        .trim();
      const link = { type: 'link', url: attr(node, 'href') ?? '#', children: [text(attr(node, 'title') ?? '')] };
      return [{ type: 'listItem', spread: false, children: [para(link, ...(desc ? [text(`: ${desc}`)] : []))] }];
    }
    case 'Badge':
      return node.type === 'mdxJsxTextElement' ? [text(`[${textOf(node)}]`)] : [para(text(`[${textOf(node)}]`))];
    case 'ParamField': {
      const meta = [];
      const push = (...n) => meta.push(...(meta.length ? [text(', ')] : []), ...n);
      if (attr(node, 'type')) push({ type: 'inlineCode', value: attr(node, 'type') });
      if (attr(node, 'default')) push(text('default '), { type: 'inlineCode', value: attr(node, 'default') });
      if (attr(node, 'required')) push(text('required'));
      return [
        para(
          strong({ type: 'inlineCode', value: attr(node, 'path') ?? '' }),
          ...(meta.length ? [text(' ('), ...meta, text(')')] : []),
        ),
        ...kids,
      ];
    }
    case 'CommandTerminal':
      return [{ type: 'code', lang: 'shell', value: attr(node, 'command') ?? '' }];
    case 'a': // anchors kept from Fern heading ids carry no text
      return attr(node, 'href') ? [{ type: 'link', url: attr(node, 'href'), children: kids }] : kids;
    case 'BadgeLinks':
    case 'llms-ignore':
      return [];
    default:
      warnings.push(`${where}: no Markdown mapping for <${node.name}>`);
      return kids;
  }
}
const stringify = { bullet: '-', fences: true, rule: '-' };
const mdx2md = unified()
  .use(remarkParse)
  .use(remarkMdx)
  .use(remarkGfm)
  .use(remarkFrontmatter)
  .use(remarkStringify, stringify);
const md2md = unified().use(remarkParse).use(remarkGfm).use(remarkFrontmatter).use(remarkStringify, stringify);
// The Markdown copy of a page sits at its path plus .md; the site's root page
// (the latest core release's home) has no path, so it uses index.md.
const mdFile = (slug) => `${slug || 'index'}.md`;
const mdUrl = (slug) => BASE + mdFile(slug);
const llmsUrl = (prefix) => BASE + join(prefix, 'llms.txt');
const toMarkdown = (body, ext, where) => {
  const proc = ext === 'md' ? md2md : mdx2md;
  try {
    const tree = proc.parse(body);
    convert(tree, where);
    return proc.stringify(tree);
  } catch (e) {
    warnings.push(`${where}: Markdown conversion failed (${e.message.split('\n')[0]}); publishing the source`);
    return body;
  }
};
for (const page of pages) {
  const { rel } = page;
  const latest = latestOf(rel.id);
  const latestEntry = docsets[rel.id].versions.find((v) => v.name === latest.version);
  const latestSlug = latestEntry.pages.includes(page.key) ? join(latest.prefix, page.key) : latestEntry.first;
  const latestMd = mdUrl(latestSlug);
  const status =
    rel.dev && !rel.latest
      ? `> These docs are for the development version (${rel.repo}@${rel.ref}). Latest released version (${latest.version}): ${latestMd}`
      : rel.latest
        ? null
        : `> This is not the latest version. Latest (${latest.version}): ${latestMd}`;
  const header = [
    '---',
    YAML.stringify({
      title: page.data.title,
      description: page.data.description,
      url: url(page.slug),
      docset: rel.id,
      version: rel.version,
      latest_version: latest.version,
      source: `${rel.repo}@${rel.ref}:${rel.path}/${page.relPath}`,
    }).trim(),
    '---',
    '',
    `> Documentation index: ${llmsUrl(rel.prefix)}. This page is for ${rel.title} ${rel.version}.`,
    ...(status ? [status] : []),
    '',
    `# ${page.data.title}`,
    '',
    '',
  ].join('\n');
  writeFile(
    path.join('public', mdFile(page.slug)),
    header + toMarkdown(page.body, page.ext, `${rel.name}/${page.relPath}`),
  );
}
for (const l of landings) {
  const header = [
    '---',
    YAML.stringify({ title: l.title, description: l.description, url: url(l.slug) }).trim(),
    '---',
    '',
    `> Documentation index: ${BASE}llms.txt.`,
    '',
    `# ${l.title}`,
    '',
    '',
  ].join('\n');
  writeFile(path.join('public', mdFile(l.slug)), header + toMarkdown(l.body, 'mdx', l.outRel));
}

// ---------- 7. llms.txt, versions.json ----------
const entry = (p) => `- [${p.data.title}](${mdUrl(p.slug)})${p.data.description ? `: ${p.data.description}` : ''}`;
const llms = [
  `# ${manifest.site.title}`,
  '',
  '> Each section lists the latest release of one docset; other versions follow it. Every page is also available as Markdown at its URL plus .md.',
  '',
];
for (const t of manifest.topics) {
  llms.push(`## ${t.label}`, '');
  for (const id of t.sources) {
    const latest = latestOf(id);
    llms.push(`### ${latest.title} ${latest.version}`, '', ...latest.pages.map(entry), '');
    const others = releasesOf[id].filter((r) => r !== latest);
    if (others.length)
      llms.push(`Other versions: ${others.map((r) => `[${r.version}](${llmsUrl(r.prefix)})`).join(', ')}`, '');
  }
}
writeFile('public/llms.txt', llms.join('\n'));
// A release at the site root (the latest core release) is covered by the
// site's own llms.txt above.
for (const rel of releases.filter((r) => r.prefix))
  writeFile(
    path.join('public', rel.prefix, 'llms.txt'),
    [`# ${rel.title} ${rel.version}`, '', ...rel.pages.map(entry), ''].join('\n'),
  );

const home = latestOf(manifest.topics[0].sources[0]);
// Alias table for the host: /<mount>/latest/<page> and /<mount>/<newest>/<page>
// -> /<mount>/<page>.
writeFile(
  'public/versions.json',
  JSON.stringify(
    {
      base: BASE,
      home: url(home.pages.some((p) => !p.key) ? home.prefix : firstOf(home)),
      docsets: Object.fromEntries(
        Object.entries(docsets).map(([id, d]) => [
          id,
          {
            mount: d.mount,
            latest: d.latest,
            versions: d.versions.map((v) => ({
              name: v.name,
              prefix: v.prefix,
              first: v.first,
              pages: v.pages,
              redirects: v.redirects,
            })),
          },
        ]),
      ),
    },
    null,
    2,
  ),
);

// ---------- report ----------
console.log(
  `assembled ${pages.length} pages from ${releases.length} versions -> ${path.relative(process.cwd(), out)} (base ${BASE})`,
);
for (const rel of releases)
  console.log(`  ${rel.name.padEnd(22)} ${rel.format.padEnd(7)} ${String(rel.sha).slice(0, 12)}  ${url(rel.prefix)}`);
if (warnings.length)
  console.warn(
    `\n${warnings.length} warning(s) (fetched versions never block the build; fix them in their repo):\n- ` +
      warnings.join('\n- '),
  );
// In GitHub Actions, also show each warning as an annotation on the run.
if (process.env.GITHUB_ACTIONS)
  for (const w of warnings)
    console.log(`::warning title=Docs::${w.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A')}`);
if (errors.length) {
  console.error(`\n${errors.length} error(s):\n- ${errors.join('\n- ')}`);
  process.exit(1);
}
