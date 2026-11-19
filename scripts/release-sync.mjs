#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
// Add new release tags of each source to sources.yml.
//
// Usage: node scripts/release-sync.mjs [--sources sources.yml] [--dry-run]
//          [--json out.json]
//
// For every source, lists the tags of its `repo` with `git ls-remote` and
// picks the stable releases (vX.Y.Z or X.Y.Z, no pre-release suffix) newer
// than the newest entry in its `versions`. Each one is inserted at the top of
// `versions`, newest first, as `{ name: "X.Y.Z", ref: <tag> }`. Older tags are
// never added, so a version removed by hand stays removed.
//
// sources.yml is edited as text, so its comments and layout are kept. Running
// it again changes nothing. --dry-run prints the changes and writes nothing.
// --json writes { added, title, body } for the release-sync workflow, which
// turns it into a pull request.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { listTags } from '../assembler/fetch.mjs';

/** [major, minor, patch] for a stable release tag or name, else null. */
export function parseRelease(tag) {
  const m = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(tag);
  return m ? m.slice(1).map(Number) : null;
}

export const compare = (a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];

/** The release tags newer than every listed version, newest first. */
export function newReleases(versions, tags) {
  const listed = versions.map((v) => parseRelease(v.name ?? v.ref)).filter(Boolean);
  if (!listed.length) return [];
  const newest = listed.reduce((a, b) => (compare(a, b) >= 0 ? a : b));
  const seen = new Set();
  return tags
    .map((tag) => ({ tag, v: parseRelease(tag) }))
    .filter(({ v }) => v && compare(v, newest) > 0)
    .sort((a, b) => compare(b.v, a.v) || (a.tag.startsWith('v') ? -1 : 1))
    .filter(({ v }) => {
      // v1.2.3 and 1.2.3 are the same release; keep the v tag.
      const key = v.join('.');
      return !seen.has(key) && seen.add(key);
    })
    .map(({ tag, v }) => ({ name: v.join('.'), ref: tag }));
}

/** Insert `releases` (newest first) at the top of a source's `versions` list. */
export function insertVersions(text, id, releases) {
  if (!releases.length) return text;
  const doc = YAML.parseDocument(text);
  const seq = doc.getIn(['sources', id, 'versions'], true);
  if (!YAML.isSeq(seq) || seq.flow || !seq.items.length)
    throw new Error(`sources.${id}.versions must be a non-empty block list`);
  const start = seq.items[0].range[0];
  const lineStart = text.lastIndexOf('\n', start - 1) + 1;
  const prefix = text.slice(lineStart, start);
  if (!/^[ ]*-[ ]+$/.test(prefix)) throw new Error(`sources.${id}.versions: unexpected layout`);
  const lines = releases.map((r) => `${prefix}{ name: "${r.name}", ref: ${r.ref} }\n`).join('');
  return text.slice(0, lineStart) + lines + text.slice(lineStart);
}

const releaseUrl = (repo, tag) =>
  /^[\w.-]+\/[\w.-]+$/.test(repo) ? `https://github.com/${repo}/releases/tag/${tag}` : `${repo} ${tag}`;

/** Pull request title and body for the added versions. */
export function describe(added) {
  const title = `chore(sources): publish ${added.map((a) => `${a.source} ${a.name}`).join(', ')}`;
  const body = [
    'New releases of the sources in `sources.yml`:',
    '',
    ...added.map((a) => `- ${a.title ?? a.source} ${a.name}: [\`${a.ref}\`](${releaseUrl(a.repo, a.ref)})`),
    '',
    'Opened by the `Release sync` workflow (`scripts/release-sync.mjs`), which',
    'updates this pull request in place when more releases appear. The `Site`',
    'check builds each new version; fix broken links in the source repository.',
  ].join('\n');
  return { title, body };
}

/** Adds every new release to the sources.yml text. Returns { text, added }. */
export async function sync(original, tagsOf = listTags) {
  const { sources } = YAML.parse(original);
  let text = original;
  const added = [];
  for (const [id, src] of Object.entries(sources)) {
    if (!src.versions?.length) continue;
    const releases = newReleases(src.versions, await tagsOf(src.repo));
    text = insertVersions(text, id, releases);
    for (const r of releases) added.push({ source: id, title: src.title, repo: src.repo, ...r });
  }
  return { text, added };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2);
  const opt = (k) => {
    const i = argv.indexOf(`--${k}`);
    return i < 0 ? undefined : argv[i + 1];
  };
  const dryRun = argv.includes('--dry-run');
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const file = path.resolve(opt('sources') ?? path.join(root, 'sources.yml'));
  const { text, added } = await sync(fs.readFileSync(file, 'utf8'));
  for (const a of added) console.log(`${a.source}: add ${a.name} (${a.ref})`);
  if (!added.length) console.log('No new releases.');
  else if (!dryRun) fs.writeFileSync(file, text);
  const json = opt('json');
  if (json) fs.writeFileSync(json, `${JSON.stringify({ added, ...(added.length ? describe(added) : {}) }, null, 2)}\n`);
}
