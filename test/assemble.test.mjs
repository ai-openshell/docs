// SPDX-License-Identifier: Apache-2.0

// Runs the assembler end to end against two small git repos (alpha and beta),
// each with a v1.0 tag and a main branch. Fetching works offline: a source's
// `repo` can be any git URL, including a local path.
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const assembler = path.join(here, '..', 'assembler', 'assemble.mjs');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'docs-assemble-'));
const repo = (name) => path.join(tmp, 'repos', name);

const git = (cwd, ...args) =>
  execFileSync('git', ['-c', 'user.name=test', '-c', 'user.email=test@example.com', ...args], {
    cwd,
    stdio: 'pipe',
    // ignore the user's git config (signing, hooks, default branch)
    env: { ...process.env, GIT_CONFIG_GLOBAL: os.devNull, GIT_CONFIG_NOSYSTEM: '1' },
  });

// main adds links that break: a missing heading and a missing page.
const BROKEN = '\nAlso see [a missing heading](/guide#missing) and [a missing page](/nowhere).\n';

function makeRepo(name) {
  const dir = repo(name);
  fs.cpSync(path.join(here, 'fixtures', name), dir, { recursive: true });
  git(dir, 'init', '-q', '-b', 'main');
  git(dir, 'add', '.');
  git(dir, 'commit', '-q', '-m', 'v1.0');
  git(dir, 'tag', 'v1.0');
  if (name === 'alpha') {
    fs.appendFileSync(path.join(dir, 'docs', 'index.mdx'), BROKEN);
    git(dir, 'commit', '-q', '-am', 'break links on main');
  }
}

function sourcesYml() {
  const source = (name, mount) =>
    `  ${name}:\n    mount: "${mount}"\n    repo: ${repo(name)}\n    path: docs\n    dev: { ref: main }\n    versions:\n      - { name: "1.0", ref: v1.0 }\n`;
  const file = path.join(tmp, 'sources.yml');
  fs.writeFileSync(
    file,
    `site:\n  title: Test\ntopics:\n  - id: core\n    label: Core\n    sources: [alpha]\n  - id: libs\n    label: Libraries\n    description: Client libraries.\n    sources: [beta]\nsources:\n${source('alpha', '')}${source('beta', 'beta')}`,
  );
  return file;
}

function assemble(name, ...extra) {
  const out = path.join(tmp, name);
  const r = spawnSync(
    process.execPath,
    [
      assembler,
      '--base',
      '/docs/',
      '--sources',
      sourcesYml(),
      '--out',
      out,
      '--cache',
      path.join(tmp, 'cache'),
      ...extra,
    ],
    { encoding: 'utf8', env: { ...process.env, GITHUB_ACTIONS: '' } },
  );
  const read = (f) => fs.readFileSync(path.join(out, f), 'utf8');
  return { status: r.status, log: r.stdout + r.stderr, read, json: (f) => JSON.parse(read(f)) };
}

before(() => {
  makeRepo('alpha');
  makeRepo('beta');
});
after(() => fs.rmSync(tmp, { recursive: true, force: true }));

describe('full build from fetched sources', () => {
  let build;
  before(() => {
    build = assemble('full');
  });

  test('succeeds and records the commit of every version', () => {
    assert.equal(build.status, 0, build.log);
    const lock = build.json('sources.lock.json');
    assert.deepEqual(Object.keys(lock).sort(), ['alpha@1.0', 'alpha@dev', 'beta@1.0', 'beta@dev']);
    for (const v of Object.values(lock)) assert.match(v.sha, /^[0-9a-f]{40}$/);
  });

  test('publishes each version under its mount, with the newest release as latest', () => {
    const nav = build.json('nav.json');
    assert.equal(nav.docsets.alpha.latest, '1.0');
    assert.deepEqual(
      nav.docsets.beta.versions.map((v) => v.prefix),
      ['beta/dev', 'beta/1.0'],
    );
    assert.match(build.read('content/1.0/guide.mdx'), /## Setup/);
  });

  test('a topic with a description gets an overview page, even with one docset', () => {
    const nav = build.json('nav.json');
    assert.deepEqual(
      nav.topics.map((t) => [t.id, t.landing]),
      [
        ['core', undefined],
        ['libs', 'libs'],
      ],
    );
    assert.match(build.read('content/libs/index.mdx'), /<Card title="Beta"/);
  });

  test('rewrites root-relative links within the release and follows redirects', () => {
    const page = build.read('content/1.0/index.mdx');
    assert.match(page, /\]\(\/docs\/1\.0\/guide\/#setup\)/);
    assert.match(page, /\[old guide\]\(\/docs\/1\.0\/guide\/\)/);
  });

  test('repo:// links go to the latest release, or to dev from a dev page', () => {
    assert.match(build.read('content/1.0/index.mdx'), /\[beta\]\(\/docs\/beta\/1\.0\/intro\/\)/);
    assert.match(build.read('content/dev/index.mdx'), /\[beta\]\(\/docs\/beta\/dev\/intro\/\)/);
    assert.match(build.read('content/beta/dev/intro.mdx'), /\[alpha\]\(\/docs\/dev\/guide\/#setup\)/);
  });

  test('broken links in a fetched version only warn, and fall back', () => {
    assert.match(build.log, /alpha@dev: index\.mdx: missing heading "\/guide#missing"/);
    assert.match(build.log, /alpha@dev: index\.mdx: broken link "\/nowhere"/);
    const page = build.read('content/dev/index.mdx');
    assert.match(page, /\[a missing heading\]\(\/docs\/dev\/guide\/\)/);
    assert.match(page, /\[a missing page\]\(\/docs\/dev\/\)/);
  });

  test('writes a Markdown copy of every page and llms.txt', () => {
    assert.match(build.read('public/1.0/guide.md'), /^# Guide$/m);
    assert.match(build.read('public/dev/guide.md'), /development version/);
    assert.match(build.read('public/llms.txt'), /### Alpha 1\.0/);
  });

  test('writes the host alias table for /<mount>/latest/', () => {
    const versions = build.json('public/versions.json');
    assert.equal(versions.home, '/docs/1.0/');
    assert.equal(versions.docsets.beta.latest, '1.0');
  });
});

describe('build with a --local checkout', () => {
  test('broken links in the checkout fail the build', () => {
    const build = assemble('local', '--local', `alpha=${repo('alpha')}`);
    assert.equal(build.status, 1, build.log);
    assert.match(build.log, /2 error\(s\)/);
    assert.match(build.log, /alpha@dev: index\.mdx: missing heading/);
  });

  test('a clean checkout builds', () => {
    const build = assemble('local-clean', '--local', `beta=${repo('beta')}`);
    assert.equal(build.status, 0, build.log);
    assert.equal(build.json('sources.lock.json')['beta@dev'].sha, 'working-tree');
  });
});
