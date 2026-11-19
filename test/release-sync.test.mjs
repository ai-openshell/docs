// SPDX-License-Identifier: Apache-2.0

// Tests for scripts/release-sync.mjs. The end-to-end tests run the script
// against small local git repos with release and pre-release tags, so they
// need no network: a source's `repo` can be any git URL, including a path.
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe as group, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { describe, insertVersions, newReleases, sync } from '../scripts/release-sync.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const script = path.join(here, '..', 'scripts', 'release-sync.mjs');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'docs-release-sync-'));

const git = (cwd, ...args) =>
  execFileSync('git', ['-c', 'user.name=test', '-c', 'user.email=test@example.com', ...args], {
    cwd,
    stdio: 'pipe',
    // ignore the user's git config (signing, hooks, default branch)
    env: { ...process.env, GIT_CONFIG_GLOBAL: os.devNull, GIT_CONFIG_NOSYSTEM: '1' },
  });

function makeRepo(name, tags) {
  const dir = path.join(tmp, 'repos', name);
  fs.mkdirSync(dir, { recursive: true });
  git(dir, 'init', '-q', '-b', 'main');
  for (const tag of tags) {
    git(dir, 'commit', '-q', '--allow-empty', '-m', tag);
    // annotated and lightweight tags both count
    if (tag.endsWith('.0')) git(dir, 'tag', '-a', '-m', tag, tag);
    else git(dir, 'tag', tag);
  }
  return dir;
}

const yml = (alpha, beta) => `# SPDX-License-Identifier: Apache-2.0

# Comments and layout survive.
site:
  title: Test

sources:
  alpha:
    title: Alpha
    mount: ""
    repo: ${alpha}
    path: docs
    dev: { ref: main }
    versions:
      # newest first
      - { name: "1.1.0", ref: v1.1.0 }
      - { name: "1.0.0", ref: v1.0.0 }

  beta:
    mount: beta
    repo: ${beta}
    path: docs
    versions:
      - { name: "2.0.0", ref: v2.0.0 }
`;

function run(file, ...extra) {
  const r = spawnSync(process.execPath, [script, '--sources', file, ...extra], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout;
}

let alpha;
let beta;
before(() => {
  // alpha: two new stable releases, pre-releases around them, and an old
  // patch release of a line that's already behind the newest listed one.
  alpha = makeRepo('alpha', [
    'v1.0.0',
    'v1.0.1',
    'v1.1.0',
    'v1.2.0-rc.1',
    'v1.2.0',
    'v1.10.0-pre.1',
    'v1.10.0',
    'docs-snapshot',
  ]);
  // beta: nothing new
  beta = makeRepo('beta', ['v1.9.0', 'v2.0.0', 'v2.1.0-pre.0']);
});
after(() => fs.rmSync(tmp, { recursive: true, force: true }));

group('newReleases', () => {
  const versions = [{ name: '0.1.9', ref: 'v0.1.9' }, { ref: 'v0.1.8' }];

  test('picks stable tags newer than the newest version, newest first', () => {
    const tags = ['v0.1.8', 'v0.1.9', 'v0.1.10', 'v0.2.0', 'v0.1.11-pre.1', 'v0.3.0-rc1', 'v0.1.7', 'latest'];
    assert.deepEqual(newReleases(versions, tags), [
      { name: '0.2.0', ref: 'v0.2.0' },
      { name: '0.1.10', ref: 'v0.1.10' },
    ]);
  });

  test('compares numerically, not as strings', () => {
    assert.deepEqual(newReleases([{ name: '0.9.0', ref: 'v0.9.0' }], ['v0.10.0', 'v0.8.9']), [
      { name: '0.10.0', ref: 'v0.10.0' },
    ]);
  });

  test('keeps the v tag when a release is tagged both ways', () => {
    assert.deepEqual(newReleases(versions, ['0.2.0', 'v0.2.0']), [{ name: '0.2.0', ref: 'v0.2.0' }]);
  });

  test('skips sources without a listed release', () => {
    assert.deepEqual(newReleases([], ['v1.0.0']), []);
    assert.deepEqual(newReleases([{ ref: 'main' }], ['v1.0.0']), []);
  });
});

group('insertVersions', () => {
  test('rejects a flow list', () => {
    const text = 'sources:\n  a:\n    versions: [{ name: "1.0.0", ref: v1.0.0 }]\n';
    assert.throws(() => insertVersions(text, 'a', [{ name: '1.1.0', ref: 'v1.1.0' }]), /block list/);
  });

  test('copies the indentation of the existing items', () => {
    const text = 'sources:\n  a:\n    versions:\n    - name: "1.0.0"\n      ref: v1.0.0\n';
    assert.equal(
      insertVersions(text, 'a', [{ name: '1.1.0', ref: 'v1.1.0' }]),
      'sources:\n  a:\n    versions:\n    - { name: "1.1.0", ref: v1.1.0 }\n    - name: "1.0.0"\n      ref: v1.0.0\n',
    );
  });
});

test('describe names every added version', () => {
  const { title, body } = describe([
    { source: 'core', title: 'OpenShell', repo: 'NVIDIA/OpenShell', name: '0.1.10', ref: 'v0.1.10' },
    { source: 'sdk-go', title: 'Go SDK', repo: 'ai-openshell/sdk-go', name: '0.1.9', ref: 'v0.1.9' },
  ]);
  assert.equal(title, 'chore(sources): publish core 0.1.10, sdk-go 0.1.9');
  assert.match(
    body,
    /OpenShell 0\.1\.10: \[`v0\.1\.10`\]\(https:\/\/github\.com\/NVIDIA\/OpenShell\/releases\/tag\/v0\.1\.10\)/,
  );
  assert.match(body, /Go SDK 0\.1\.9/);
});

group('end to end', () => {
  test('adds new releases to the local repos, keeping the rest of the file', async () => {
    const file = path.join(tmp, 'sources.yml');
    fs.writeFileSync(file, yml(alpha, beta));
    const out = run(file, '--json', path.join(tmp, 'out.json'));
    assert.equal(out, 'alpha: add 1.10.0 (v1.10.0)\nalpha: add 1.2.0 (v1.2.0)\n');
    assert.equal(
      fs.readFileSync(file, 'utf8'),
      yml(alpha, beta).replace(
        '      # newest first\n',
        '      # newest first\n      - { name: "1.10.0", ref: v1.10.0 }\n      - { name: "1.2.0", ref: v1.2.0 }\n',
      ),
    );
    const json = JSON.parse(fs.readFileSync(path.join(tmp, 'out.json'), 'utf8'));
    assert.equal(json.title, 'chore(sources): publish alpha 1.10.0, alpha 1.2.0');
    assert.equal(json.added.length, 2);
  });

  test('is idempotent', () => {
    const file = path.join(tmp, 'sources.yml');
    const before = fs.readFileSync(file, 'utf8');
    assert.equal(run(file, '--json', path.join(tmp, 'again.json')), 'No new releases.\n');
    assert.equal(fs.readFileSync(file, 'utf8'), before);
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(tmp, 'again.json'), 'utf8')), { added: [] });
  });

  test('--dry-run writes nothing', () => {
    const file = path.join(tmp, 'dry.yml');
    fs.writeFileSync(file, yml(alpha, beta));
    assert.match(run(file, '--dry-run'), /alpha: add 1\.10\.0/);
    assert.equal(fs.readFileSync(file, 'utf8'), yml(alpha, beta));
  });

  test('sync reads tags from any lister', async () => {
    const { text, added } = await sync(yml('a', 'b'), async (repo) => (repo === 'b' ? ['v2.0.1'] : []));
    assert.deepEqual(
      added.map((a) => `${a.source} ${a.name}`),
      ['beta 2.0.1'],
    );
    assert.match(text, /versions:\n {6}- \{ name: "2\.0\.1", ref: v2\.0\.1 \}\n {6}- \{ name: "2\.0\.0"/);
  });
});
